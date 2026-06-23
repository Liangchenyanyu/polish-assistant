"""
文本智能分析模块
提供: 可读性评分、语病检测、重复度检测、敏感词筛查、段落评价、关键词提取、摘要生成
纯Python实现，零网络依赖
"""
import re
import math
from typing import Dict, List, Tuple
from collections import Counter


# ========== 敏感词库（示例，实际应用可扩展） ==========
SENSITIVE_WORDS: Dict[str, str] = {
    # 广告法违禁词
    "最": "广告法极限词，建议改为'显著的''突出的'",
    "第一": "广告法极限词，建议改为'领先的'",
    "唯一": "广告法极限词，建议改为'少有的''独特的'",
    "顶级": "广告法极限词，建议改为'高端的'",
    "极致": "广告法极限词，建议改为'出色的'",
    "绝对": "广告法极限词，建议改为'相当'",
    "全网": "广告法极限词，建议改为'广泛的'",
    "首选": "广告法极限词，建议改为'推荐的'",
    "国家级": "需官方认证，建议核实后使用",
    "世界级": "需官方认证，建议核实后使用",
    # 常见敏感表述
    "保证": "可能涉及承诺，建议改为'致力于''努力实现'",
    "100%": "绝对化表述，建议改为'高比例''绝大多数'",
    "永久": "绝对化表述，建议改为'长期'",
    "永不": "绝对化表述，建议改为'持续'",
    "彻底": "绝对化表述，建议保留但注意语境",
    # 不文明用语
    "傻逼": "不文明用语，建议删除或替换",
    "卧槽": "不文明用语，建议删除或替换",
    "妈的": "不文明用语，建议删除或替换",
    "垃圾": "贬义词汇，建议替换为中性表达",
    "废物": "贬义词汇，建议替换为中性表达",
}

# ========== 常见语病模式 ==========
ERROR_PATTERNS: List[Tuple[str, str, str]] = [
    # (正则模式, 错误描述, 修改建议)
    (r"通过[^，,\n]{3,30}使", "「通过...使」缺少主语", "去除'通过'或'使'，保留一个即可。例：'通过学习使我进步' → '学习使我进步'"),
    (r"之所以[^，,\n]{3,50}是因为", "「之所以...是因为」句式冗余", "可简化为'因为...所以...'或直接陈述原因"),
    (r"因为[^，,\n]{3,30}的原因", "「因为...的原因」语义重复", "'因为'和'的原因'择一使用即可"),
    (r"由于[^，,\n]{3,30}的缘故", "「由于...的缘故」语义重复", "'由于'和'的缘故'择一使用即可"),
    (r"大约[^，,\n]{1,20}左右", "「大约...左右」语义重复", "'大约'和'左右'择一使用即可"),
    (r"超过[^，,\n]{1,20}以上", "「超过...以上」语义重复", "'超过'和'以上'择一使用即可"),
    (r"并非是?", "「并非是」中'是'多余", "建议改为'并非'"),
    (r"可以[能可]", "「可以能/可以可」重复", "建议改为'可以'或'能'"),
    (r"的的", "连续的'的'可能为错别字", "检查是否需要删除重复的'的'"),
    (r"了了", "连续的'了'可能为错别字", "检查是否需要删除重复的'了'"),
    (r"不仅[^，,\n]{3,30}而且[也还]", "「不仅...而且也/还」关联词冗余", "'而且'后无需再加'也/还'"),
    (r"这是?[一]?[个项种件][^，,\n]{1,10}的[问题|情况|现象]", "「这是一个...的问题」句式冗余", "可简化为直接陈述，去掉'这是一个...的问题'的包装"),
    (r"进行[了]?[一]?[个次项]", "「进行了/了一个」动词弱化", "建议使用更直接的动词。例：'进行了研究' → '研究了'"),
]

# ========== 文本分析函数 ==========

def calculate_readability(text: str) -> Dict:
    """
    计算中文文本可读性指标
    
    使用改编的中文可读性公式：
    - 平均句长（字/句）
    - 平均词长（字/词，中文近似）
    - 难词比例（少见字比例）
    - 综合可读性评分（0-100，越高越难）
    """
    if not text or len(text.strip()) < 10:
        return {"error": "文本过短，无法分析"}

    # 基本统计
    chars = len(text.replace('\n', '').replace(' ', ''))
    
    # 分句（中英文句号、问号、感叹号、换行）
    sentences = re.split(r'[。！？!?\n]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 2]
    sentence_count = len(sentences)
    if sentence_count == 0:
        sentence_count = 1
    
    avg_sentence_len = chars / sentence_count if sentence_count > 0 else chars

    # 估计词数（中文按约1.5字/词估算）
    estimated_words = chars / 1.5
    if estimated_words == 0:
        estimated_words = 1

    # 段落数
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    paragraph_count = len(paragraphs)

    # 标点统计
    punctuation = len(re.findall(r'[，。！？、；：""''（）《》【】…—\-,.!?;:()"]', text))

    # 汉字中罕见字比例（简化估算：笔画数>15的汉字视为难字）
    # 这里用字符的Unicode范围粗略判断
    han_chars = re.findall(r'[\u4e00-\u9fff]', text)
    rare_chars = [c for c in han_chars if ord(c) > 0x8000]  # Unicode高位汉字
    rare_ratio = len(rare_chars) / len(han_chars) if han_chars else 0

    # 综合可读性评分 (0-100)
    # 句长 > 30 → 偏难；句长 < 15 → 偏易
    # 罕见字比例 > 5% → 偏难
    sentence_score = min(avg_sentence_len / 40 * 60, 60)
    rare_score = min(rare_ratio * 100, 30)
    punct_score = max(0, 10 - min(punctuation / max(chars, 1) * 200, 10))
    readability_score = min(round(sentence_score + rare_score + punct_score), 100)

    # 难度等级
    if readability_score < 25:
        level = "非常容易"
        grade = "小学低年级"
    elif readability_score < 40:
        level = "容易"
        grade = "小学高年级"
    elif readability_score < 55:
        level = "中等"
        grade = "初中水平"
    elif readability_score < 70:
        level = "偏难"
        grade = "高中/大学"
    else:
        level = "困难"
        grade = "专业学术"

    return {
        "readability_score": readability_score,
        "level": level,
        "grade": grade,
        "details": {
            "total_chars": chars,
            "total_sentences": sentence_count,
            "total_paragraphs": paragraph_count,
            "avg_sentence_length": round(avg_sentence_len, 1),
            "estimated_words": round(estimated_words),
            "punctuation_count": punctuation,
            "rare_char_ratio": round(rare_ratio * 100, 1),
        }
    }


def detect_errors(text: str) -> Dict:
    """检测文本中的常见语病"""
    if not text or len(text.strip()) < 10:
        return {"total": 0, "errors": []}

    errors = []
    for pattern, desc, suggestion in ERROR_PATTERNS:
        matches = list(re.finditer(pattern, text))
        for match in matches:
            # 获取上下文
            start = max(0, match.start() - 10)
            end = min(len(text), match.end() + 10)
            context = text[start:end].replace('\n', ' ')
            errors.append({
                "type": "语病",
                "description": desc,
                "suggestion": suggestion,
                "matched_text": match.group(),
                "context": f"...{context}...",
                "position": match.start(),
            })

    return {
        "total": len(errors),
        "errors": errors,
    }


def detect_repetition(text: str) -> Dict:
    """检测文本中的重复内容（n-gram 分析）"""
    if not text or len(text.strip()) < 20:
        return {"total": 0, "repetitions": []}

    # 提取有效文本（去除标点）
    clean = re.sub(r'[，。！？、；：""''（）《》【】\s\n]', '', text)
    
    repetitions = []
    # 检测2-gram重复（连续两个字的重复）
    n = 4  # 使用4-gram检测短语重复
    if len(clean) < n:
        return {"total": 0, "repetitions": []}

    ngrams = {}
    for i in range(len(clean) - n + 1):
        gram = clean[i:i+n]
        if gram not in ngrams:
            ngrams[gram] = []
        ngrams[gram].append(i)

    for gram, positions in ngrams.items():
        if len(positions) >= 3:  # 出现3次及以上的4字短语
            # 找到该短语在原文中的上下文
            examples = []
            for pos in positions[:3]:
                s = max(0, pos - 15)
                e = min(len(text), pos + n + 15)
                examples.append(text[s:e].replace('\n', ' '))
            
            repetitions.append({
                "phrase": gram,
                "count": len(positions),
                "examples": examples,
            })

    # 按重复次数排序
    repetitions.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total": len(repetitions),
        "repetitions": repetitions[:10],  # 最多返回10个
    }


def screen_sensitive_words(text: str) -> Dict:
    """筛查文本中的敏感词/违规词"""
    if not text or len(text.strip()) < 5:
        return {"total": 0, "words": []}

    found = []
    for word, warning in SENSITIVE_WORDS.items():
        if word in text:
            # 找到所有出现位置
            positions = [m.start() for m in re.finditer(re.escape(word), text)]
            for pos in positions:
                s = max(0, pos - 10)
                e = min(len(text), pos + len(word) + 10)
                found.append({
                    "word": word,
                    "warning": warning,
                    "context": f"...{text[s:e].replace(chr(10), ' ')}...",
                    "position": pos,
                })

    # 按位置排序
    found.sort(key=lambda x: x["position"])

    return {
        "total": len(found),
        "words": found,
    }


def generate_keywords(text: str, top_k: int = 10) -> Dict:
    """
    简单的关键词提取（基于TF-IDF启发式）
    使用词频统计 + 停用词过滤
    """
    if not text or len(text.strip()) < 20:
        return {"keywords": []}

    # 中文停用词
    stop_words = set("的了吗呢吧啊嗯哦在是和有这那我也他她它不都就也还要可以会能没被把让给从到对为以所而及与或但若因所以如果虽然但是因为因此然而于是然后接着之后之前之后此外另外同时并且以及不过只是其中之一这种那种一种各个每个所有任何自己它们我们你们他们她们大家各位什么怎么怎样为什么哪里哪儿多少几时时候已经正在将要曾经一直总是经常偶尔突然终于最后第一第二第三".split())

    # 提取中文词（简单按字符切分不够，用2-gram短语代替）
    # 这里用简单方法：提取连续中文字符，用2-3字窗口滑动
    clean = re.sub(r'[^\u4e00-\u9fff]', '', text)
    
    # 使用2-gram和3-gram统计
    word_freq = Counter()
    for n in [2, 3]:
        for i in range(len(clean) - n + 1):
            gram = clean[i:i+n]
            if not any(w in stop_words for w in [gram[:1], gram[-1:]]):
                word_freq[gram] += 1

    # 过滤低频词（至少出现2次）+ 去重包含关系
    keywords = []
    for word, freq in word_freq.most_common(top_k * 3):
        if freq < 2 and len(clean) > 100:
            continue
        # 去掉包含在其他已选关键词中的
        is_sub = any(w != word and word in w for w, _ in keywords)
        if not is_sub:
            keywords.append((word, freq))
        if len(keywords) >= top_k:
            break

    return {
        "keywords": [{"word": w, "frequency": f} for w, f in keywords],
    }


def generate_summary(text: str, max_sentences: int = 3) -> Dict:
    """
    简单的摘要生成（基于位置和关键词密度）
    选取开头和关键词密度最高的句子
    """
    if not text or len(text.strip()) < 50:
        return {"summary": text, "method": "文本较短，无需摘要"}

    sentences = re.split(r'[。！？!?\n]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 5]
    
    if len(sentences) <= max_sentences:
        return {"summary": "。".join(sentences), "method": "全文即摘要"}

    # 提取关键词
    kw_result = generate_keywords(text, top_k=5)
    keywords = [k["word"] for k in kw_result.get("keywords", [])]

    # 计算每个句子与关键词的相关度
    scored = []
    for i, sent in enumerate(sentences):
        score = 0
        for kw in keywords:
            if kw in sent:
                score += 1
        # 开头的句子加分
        if i < len(sentences) * 0.2:
            score += 1
        # 结尾的句子加分
        if i > len(sentences) * 0.8:
            score += 0.5
        scored.append((sent, score, i))

    # 按分数排序
    scored.sort(key=lambda x: x[1], reverse=True)
    # 按原顺序取top句
    top = scored[:max_sentences]
    top.sort(key=lambda x: x[2])  # 恢复原顺序

    summary = "。".join(s[0] for s in top) + "。"

    return {
        "summary": summary,
        "method": f"基于关键词匹配度从{len(sentences)}句中选取{max_sentences}句",
    }


def analyze_text(text: str) -> Dict:
    """
    综合文本分析入口
    返回所有分析结果
    """
    if not text or len(text.strip()) < 10:
        return {"error": "文本过短（至少10个字符）"}

    return {
        "readability": calculate_readability(text),
        "errors": detect_errors(text),
        "repetition": detect_repetition(text),
        "sensitive_words": screen_sensitive_words(text),
        "keywords": generate_keywords(text),
        "summary": generate_summary(text),
    }
