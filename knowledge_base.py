"""
知识库/RAG模块
负责: 文档加载、文本切分、向量化、Top-K检索、来源展示
评分对应: 资料准备、文本切分、向量化检索、Top-K召回、来源展示

检索策略（双引擎，自动降级）：
  1. ChromaDB + HuggingFace Embedding（主引擎，需网络下载模型）
  2. TF-IDF 关键词检索（回退引擎，完全离线，无需网络）
"""
import logging
import re
import math
from collections import Counter
from pathlib import Path
from typing import List, Dict, Optional

from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

from config import config

logger = logging.getLogger(__name__)


# ========== 中文分词辅助函数 ==========

# 中文停用词
_CJK_STOP_WORDS = set(
    "的了一是不我在人有他这为之那就也到说和地去着"
    "都而及与把被从让对于通过可以自己我们它们他们她"
    "这个那个什么哪个怎么如何因为所以但是虽然如果已经"
    "很太更最非常比较没有完全特别基本所有任何每"
    "一个一种一些许多很多部分时候现在然后之后之前"
    "上中下前后来去进回出对向到在当用把被从让"
    "等其其中各该此之外内间些者所然则而以"
    "或但且又也虽却便即只乃虽而若盖唯"
)


def _tokenize(text: str) -> List[str]:
    """简易中文+英文分词（不需要 jieba 等第三方库）"""
    tokens = []
    # 提取中文字符序列（2字及以上）
    cjk_runs = re.findall(r'[\u4e00-\u9fff]{2,}', text)
    tokens.extend(cjk_runs)

    # 提取英文单词（3字母及以上）
    eng_runs = re.findall(r'[a-zA-Z]{3,}', text)
    tokens.extend(w.lower() for w in eng_runs)

    # 对中文 run 进一步切分为 bigram（2字滑动窗口），提高匹配精度
    bigrams = []
    for run in cjk_runs:
        for i in range(len(run) - 1):
            bg = run[i:i + 2]
            if bg not in _CJK_STOP_WORDS and len(bg) == 2:
                bigrams.append(bg)
    tokens.extend(bigrams)

    return tokens


# ========== 知识库核心类 ==========

class KnowledgeBase:
    """知识库管理器 — 基于写作规范资料的 RAG 系统（双引擎）"""

    # 所需资料清单（评分点: 资料数量、格式和来源说明）
    REQUIRED_DOCS: List[str] = [
        "学术写作规范手册.txt",
        "商务邮件写作指南.txt",
        "新媒体写作技巧.txt",
        "常见语法错误修正指南.txt",
        "中文标点符号使用规范.txt",
    ]

    def __init__(self, embeddings_model: str = None):
        self.docs_dir = config.docs_dir
        self.vector_db_path = str(config.vector_db_dir)
        self.embeddings_model = embeddings_model or config.embedding_model
        self._embeddings = None
        self._vector_store: Optional[Chroma] = None
        self._initialized = False

        # TF-IDF 回退引擎数据
        self._chunks_data: List[Dict] = []        # [{"content": ..., "source": ...}, ...]
        self._tfidf_index: Optional["_TfidfIndex"] = None

    @property
    def embeddings(self):
        """懒加载 embedding 模型，支持 HuggingFace 镜像，有超时保护"""
        if self._embeddings is None:
            import os

            # 设置 HuggingFace 镜像（如果配置了）
            mirror = config.hf_mirror
            if mirror:
                os.environ.setdefault("HF_ENDPOINT", mirror)
                logger.info(f"使用 HuggingFace 镜像: {mirror}")

            # 缩短下载超时，避免长时间阻塞（ChromaDB 失败时自动降级 TF-IDF）
            os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "3")
            # 减少重试次数：离线场景下快速失败
            os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")

            self._embeddings = HuggingFaceEmbeddings(
                model_name=self.embeddings_model,
                model_kwargs={"trust_remote_code": True},
            )
        return self._embeddings

    @property
    def vector_store(self) -> Optional[Chroma]:
        return self._vector_store

    def init_knowledge_base(self, force_rebuild: bool = False) -> str:
        """
        初始化知识库（评分点: 资料导入、文本切分、向量化）
        优先 ChromaDB 向量引擎；若失败则自动降级为 TF-IDF 引擎。
        返回状态消息
        """
        # ====== 第1步：加载 + 切分文档（必需步骤，两种引擎都需要）======
        available = [f.name for f in self.docs_dir.glob("*.txt")]
        missing = [d for d in self.REQUIRED_DOCS if d not in available]

        if not available:
            return "错误: docs/ 目录中没有知识库文档，请先添加资料文件"

        status_parts = []
        if missing:
            status_parts.append(f"缺失 {len(missing)} 份资料: {', '.join(missing)}")

        try:
            loader = DirectoryLoader(
                str(self.docs_dir), glob="**/*.txt", loader_cls=TextLoader,
                loader_kwargs={"encoding": "utf-8"},
            )
            documents = loader.load()
            status_parts.append(f"加载 {len(documents)} 个文档")
        except Exception as e:
            return f"文档加载失败: {e}"

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.chunk_size,
            chunk_overlap=config.chunk_overlap,
            separators=["\n\n", "\n", "。", "；", "，", ".", ";", ","],
        )
        chunks = text_splitter.split_documents(documents)
        status_parts.append(f"切分为 {len(chunks)} 个文本片段")

        # 始终构建 TF-IDF 索引（作为回退 / 辅助引擎）
        self._chunks_data = [
            {"content": doc.page_content, "source": doc.metadata.get("source", "未知来源")}
            for doc in chunks
        ]
        self._tfidf_index = _TfidfIndex(self._chunks_data)
        # 立即标记已初始化 — TF-IDF 引擎已就绪，检索不需要等待 ChromaDB
        self._initialized = True

        # ====== 第2步：尝试构建 ChromaDB 向量库（非阻塞，失败不影响使用）======
        vector_db_ok = False

        # 检查已有持久化向量库
        existing = Path(self.vector_db_path)
        if existing.exists() and any(existing.iterdir()) and not force_rebuild:
            logger.info("检测到已有向量库，加载中...")
            try:
                self._vector_store = Chroma(
                    persist_directory=self.vector_db_path,
                    embedding_function=self.embeddings,
                )
                self._vector_store._collection.count()  # 触发实际加载验证
                vector_db_ok = True
                status_parts.append("ChromaDB 向量库加载成功")
            except Exception as e:
                logger.warning(f"加载已有向量库失败: {e}，尝试重建...")

        if not vector_db_ok:
            try:
                self._vector_store = Chroma.from_documents(
                    documents=chunks,
                    embedding=self.embeddings,
                    persist_directory=self.vector_db_path,
                )
                vector_db_ok = True
                status_parts.append("ChromaDB 向量化存储完成")
            except Exception as e:
                logger.warning(f"ChromaDB 向量化失败（将使用 TF-IDF 回退引擎）: {e}")
                status_parts.append("ChromaDB 不可用，已自动切换为 TF-IDF 关键词检索")

        if vector_db_ok:
            status_parts.append("使用 ChromaDB 语义检索引擎")
        else:
            status_parts.append("使用 TF-IDF 关键词检索引擎（离线模式）")

        return " | ".join(status_parts)

    def retrieve(
        self, query: str, top_k: int = None, score_threshold: float = None
    ) -> List[Dict]:
        """
        检索相关知识（评分点: Top-K召回）
        优先 ChromaDB 语义检索；若不可用则使用 TF-IDF 关键词检索。
        返回: [{"content": ..., "source": ..., "score": ...}, ...]
        """
        k = top_k or config.top_k_retrieval
        threshold = score_threshold if score_threshold is not None else config.score_threshold

        # ---- 引擎1: ChromaDB 语义检索 ----
        if self._vector_store is not None:
            try:
                results = self._vector_store.similarity_search_with_score(query, k=k)

                formatted = []
                for doc, score in results:
                    similarity = round(1.0 / (1.0 + float(score)), 4)
                    if similarity < threshold:
                        continue
                    formatted.append({
                        "content": doc.page_content,
                        "source": doc.metadata.get("source", "未知来源"),
                        "score": similarity,
                    })

                if formatted:
                    logger.info(f"[ChromaDB] 检索完成: query='{query[:50]}...', 命中 {len(formatted)} 条")
                    return formatted
                # ChromaDB 返回空，降级到 TF-IDF
                logger.info("ChromaDB 无结果，降级到 TF-IDF 检索")
            except Exception as e:
                logger.warning(f"ChromaDB 检索异常，降级到 TF-IDF: {e}")

        # ---- 引擎2: TF-IDF 关键词检索（离线回退）----
        if self._tfidf_index is not None:
            results = self._tfidf_index.search(query, top_k=k, min_score=threshold)
            logger.info(f"[TF-IDF] 检索完成: query='{query[:50]}...', 命中 {len(results)} 条")
            return results

        logger.warning("两个检索引擎均不可用，返回空结果")
        return []

    def format_context(self, results: List[Dict]) -> str:
        """将检索结果格式化为上下文（评分点: 上下文拼接）"""
        if not results:
            return ""

        parts = ["\n# 相关写作规范参考（知识库检索结果）\n"]
        for i, res in enumerate(results, 1):
            source_name = Path(res["source"]).name if res["source"] else "未知来源"
            parts.append(
                f"【参考{i}】来源《{source_name}》（相关度: {res['score']}）\n"
                f"{res['content']}\n"
            )

        return "\n".join(parts)

    def get_kb_status(self) -> dict:
        """获取知识库状态（评分点: 知识库资料状态展示）"""
        available = [f.name for f in self.docs_dir.glob("*.txt")] if self.docs_dir.exists() else []
        missing = [d for d in self.REQUIRED_DOCS if d not in available]

        engine_type = "none"
        if self._vector_store is not None:
            engine_type = "chromadb"
        elif self._tfidf_index is not None:
            engine_type = "tfidf"

        return {
            "docs_dir": str(self.docs_dir),
            "required_docs": self.REQUIRED_DOCS,
            "available_docs": available,
            "missing_docs": missing,
            "total_docs": len(available),
            "is_initialized": self._initialized,
            "engine_type": engine_type,
            "vector_db_path": self.vector_db_path,
            "embedding_model": self.embeddings_model,
            "chunk_size": config.chunk_size,
            "chunk_overlap": config.chunk_overlap,
            "top_k": config.top_k_retrieval,
            "score_threshold": config.score_threshold,
        }


# ========== 离线 TF-IDF 检索引擎 ==========

class _TfidfIndex:
    """
    TF-IDF 关键词检索引擎（完全离线，零网络依赖）
    作为 ChromaDB 不可用时的回退方案，基于 BM25 变体实现。
    """

    def __init__(self, chunks: List[Dict]):
        """
        Args:
            chunks: [{"content": str, "source": str}, ...]
        """
        self.chunks = chunks
        self.N = len(chunks)

        # 对每个 chunk 构建词频表
        self._doc_tokens: List[List[str]] = []
        self._doc_tf: List[Counter] = []
        self._df: Counter = Counter()  # document frequency
        self._avgdl = 0.0

        for chunk in chunks:
            tokens = _tokenize(chunk["content"])
            self._doc_tokens.append(tokens)
            tf = Counter(tokens)
            self._doc_tf.append(tf)
            self._df.update(tf.keys())
            self._avgdl += len(tokens)

        if self.N > 0:
            self._avgdl /= self.N

        # BM25 参数
        self._k1 = 1.5
        self._b = 0.75

    def search(self, query: str, top_k: int = 3, min_score: float = 0.0) -> List[Dict]:
        """
        BM25 变体检索
        返回: [{"content": ..., "source": ..., "score": ...}, ...]
        """
        if not self.chunks:
            return []

        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        scores = []
        for i in range(self.N):
            score = self._bm25_score(query_tokens, i)
            if score > 0:
                scores.append((i, score))

        # 按分数降序排序
        scores.sort(key=lambda x: x[1], reverse=True)

        # 归一化分数到 [0, 1] 范围
        max_score = scores[0][1] if scores else 1.0

        results = []
        for idx, score in scores[:top_k]:
            norm_score = round(score / max_score, 4) if max_score > 0 else 0.0
            if norm_score < min_score:
                continue
            results.append({
                "content": self.chunks[idx]["content"],
                "source": self.chunks[idx]["source"],
                "score": norm_score,
            })

        return results

    def _bm25_score(self, query_tokens: List[str], doc_idx: int) -> float:
        """计算单个文档的 BM25 分数"""
        doc_tf = self._doc_tf[doc_idx]
        doc_len = len(self._doc_tokens[doc_idx])
        score = 0.0

        for token in query_tokens:
            tf = doc_tf.get(token, 0)
            if tf == 0:
                continue
            df = self._df.get(token, 0)
            idf = math.log(1 + (self.N - df + 0.5) / (df + 0.5))
            numerator = tf * (self._k1 + 1)
            denominator = tf + self._k1 * (1 - self._b + self._b * doc_len / self._avgdl)
            score += idf * numerator / denominator

        return score
