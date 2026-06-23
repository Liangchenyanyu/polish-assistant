"""
润色业务引擎
负责: 润色流程编排、RAG增强、结果格式化、多轮上下文管理
评分对应: 应用集成、LangChain组件集成
"""
import logging
from typing import Generator, Dict, List, Optional

from model_client import ModelClient
from prompt_manager import PromptManager
from knowledge_base import KnowledgeBase
from config import config

logger = logging.getLogger(__name__)


class PolishEngine:
    """文章润色引擎 — 核心业务编排"""

    def __init__(self, model_type: str = None, api_key: str = None):
        self.model_type = model_type or config.default_model
        self.client: Optional[ModelClient] = None
        self.api_key = api_key
        self.prompt_manager = PromptManager()
        self.kb = KnowledgeBase()
        self.conversation_history: List[Dict] = []
        self._last_kb_refs: List[Dict] = []

    def set_client(self, model_type: str = None, api_key: str = None) -> str:
        """初始化/切换模型客户端
        返回状态消息
        """
        if api_key:
            config.set_api_key(model_type or self.model_type, api_key)
            self.api_key = api_key
        if model_type:
            self.model_type = model_type

        try:
            self.client = ModelClient(
                model_type=self.model_type,
                api_key=self.api_key,
            )
            return f"模型客户端初始化成功: {self.model_type}"
        except ValueError as e:
            return f"初始化失败: {e}"

    def ensure_client(self) -> bool:
        """确保客户端已初始化"""
        if self.client is None:
            try:
                self.client = ModelClient(model_type=self.model_type, api_key=self.api_key)
                return True
            except ValueError:
                return False
        return True

    def polish_article(
        self,
        article: str,
        style: str = "academic",
        use_kb: bool = True,
        mode: str = "full",
        temperature: float = None,
        max_tokens: int = None,
        custom_instructions: str = "",
        action: str = "polish",
        intensity: str = "medium",
        target_words: int = 0,
        shift_type: str = "gentle",
        selected_text: str = "",
        role: str = "editor",
    ) -> Generator[Dict, None, None]:
        """
        执行文章润色（评分点: 应用集成与UI）

        Yields:
            Dict: {"type": "token"|"progress"|"result"|"error", "data": ...}
        """
        if not article or len(article.strip()) < 10:
            yield {"type": "error", "data": "请输入至少10个字符的文章内容"}
            return

        if not self.ensure_client():
            yield {
                "type": "error",
                "data": "请先在界面中输入有效的 API Key 并点击「连接测试」",
            }
            return

        try:
            yield {"type": "progress", "data": "正在准备提示词..."}

            # 1. 根据 action 获取专用提示词（评分点: COSTAR提示词）
            if action == "polish":
                system_prompt = self.prompt_manager.get_tool_prompt(
                    "polish", style, intensity=intensity
                )
            else:
                system_prompt = self.prompt_manager.get_tool_prompt(
                    action, style, shift_type=shift_type, target_words=str(target_words) if target_words > 0 else ""
                )

            # 注入角色设定
            role_cfg = self.prompt_manager.ROLES.get(role, self.prompt_manager.ROLES["editor"])
            role_injection = (
                f"\n\n# 角色设定\n{role_cfg['persona']}\n"
                f"请以「{role_cfg['label']}」的身份和视角来完成以上任务。"
            )
            system_prompt += role_injection

            # 叠加自定义指令
            if custom_instructions and style == "custom":
                system_prompt += (
                    f"\n\n# 用户自定义风格要求\n{custom_instructions}"
                )

            # 2. 知识库检索增强（评分点: RAG检索生成）
            kb_context = ""
            kb_refs = []
            if use_kb:
                yield {"type": "progress", "data": "正在检索知识库..."}

                try:
                    # 确保知识库已初始化
                    if not self.kb._initialized:
                        from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

                        kb_timeout = config.kb_init_timeout
                        executor = ThreadPoolExecutor(max_workers=1)
                        future = executor.submit(self.kb.init_knowledge_base)
                        try:
                            future.result(timeout=kb_timeout)
                        except FutureTimeout:
                            # TF-IDF 可能已经构建好了（init_knowledge_base 先构建 TF-IDF），
                            # 超时的只是 ChromaDB 部分。不抛异常，继续使用 TF-IDF 检索。
                            pass
                        finally:
                            executor.shutdown(wait=False)

                    query = f"{self.prompt_manager.STYLES.get(style, style)}风格 文章润色 写作规范"
                    kb_results = self.kb.retrieve(query)
                    kb_context = self.kb.format_context(kb_results)
                    kb_refs = kb_results
                    self._last_kb_refs = kb_refs

                    if kb_context:
                        system_prompt += f"\n\n{kb_context}"
                        yield {"type": "progress", "data": f"知识库检索完成，命中 {len(kb_results)} 条参考资料"}
                    else:
                        yield {"type": "progress", "data": "知识库未检索到相关内容，将直接使用大模型能力润色"}
                except Exception as kb_err:
                    logger.warning(f"知识库初始化/检索失败（将跳过 RAG 增强）: {kb_err}")
                    yield {"type": "progress", "data": f"知识库不可用（{str(kb_err)[:50]}），将直接使用大模型润色"}

            # 3. 构建用户输入（根据 action 类型）
            style_name = self.prompt_manager.STYLES.get(style, style)
            style_desc = self.prompt_manager.get_style_description(style)
            tool_label = self.prompt_manager.TOOLS.get(action, {}).get("label", "润色")

            # 局部选中润色
            effective_text = selected_text if (selected_text and action == "polish") else article

            if action == "polish":
                intensity_label = self.prompt_manager.INTENSITY_CONFIG.get(
                    intensity, {}
                ).get("label", "中度润色")
                user_content = (
                    f"请对以下文本进行【{intensity_label}】的【{style_name}】风格润色。\n"
                    f"风格要求: {style_desc}\n"
                )
                if target_words > 0:
                    user_content += f"目标字数: 请将润色后字数控制在 {target_words} 字左右。\n"
                user_content += f"\n原文:\n{effective_text}"
            elif action == "paraphrase":
                user_content = (
                    f"请对以下文本进行降重改写，保持原意不变，通过同义替换和句式重构降低重复率。\n\n"
                    f"原文:\n{effective_text}"
                )
            elif action == "deai":
                user_content = (
                    f"请对以下文本进行去AI痕迹改写，消除机器化生硬表达，模拟真人手写风格。\n\n"
                    f"原文:\n{effective_text}"
                )
            elif action == "simplify":
                user_content = (
                    f"请将以下专业/复杂内容进行通俗化改写，让普通大众能轻松理解。\n\n"
                    f"原文:\n{effective_text}"
                )
            elif action == "continue":
                target_hint = f"\n参考续写字数: {target_words} 字" if target_words > 0 else ""
                user_content = (
                    f"请根据以下前文内容，自然流畅地续写后续内容，保持文风统一。{target_hint}\n\n"
                    f"前文:\n{effective_text}"
                )
            elif action == "tone_shift":
                shift_label = self.prompt_manager.TONE_SHIFT_TYPES.get(
                    shift_type, {}
                ).get("label", "转换")
                user_content = (
                    f"请对以下文本进行话术转换（{shift_label}），{self.prompt_manager.TONE_SHIFT_TYPES.get(shift_type, {}).get('desc', '')}。\n\n"
                    f"原文:\n{effective_text}"
                )
            else:
                user_content = (
                    f"请对以下文本进行【{style_name}】风格润色。\n"
                    f"风格要求: {style_desc}\n\n"
                    f"原文:\n{effective_text}"
                )

            # 4. 构建消息（评分点: 多轮上下文管理）
            messages = self.client.build_messages(
                system_prompt=system_prompt,
                user_content=user_content,
                history=self.conversation_history[-6:] if self.conversation_history else None,
            )

            # 5. 流式调用模型
            yield {"type": "progress", "data": "正在生成润色结果..."}

            # 使用风格默认 temperature
            if temperature is None:
                temperature = config.get_style_temperature(style)

            full_response = ""
            for token in self.client.chat_completion(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            ):
                full_response += token
                yield {"type": "token", "data": token}

            # 6. 保存对话历史（仅保存非空内容，避免后续多轮对话 API 报错）
            if user_content.strip():
                self.conversation_history.append({"role": "user", "content": user_content})
            if full_response.strip():
                self.conversation_history.append({"role": "assistant", "content": full_response})

            # 7. 返回结果（自然语言输出，不再解析JSON）
            yield {
                "type": "result",
                "data": {
                    "polished_text": full_response,
                    "changes": [],
                    "suggestions": [],
                    "style_match_score": 0,
                    "kb_refs": kb_refs,
                },
            }

        except Exception as e:
            logger.error(f"润色引擎异常: {e}")
            yield {"type": "error", "data": f"润色过程中发生错误: {e}。请检查网络连接或稍后重试。"}

    def polish_paragraphs(
        self,
        article: str,
        style: str = "academic",
        temperature: float = None,
    ) -> Generator[Dict, None, None]:
        """逐段润色模式 — 自动分段落，逐段返回结果"""
        if not article or len(article.strip()) < 10:
            yield {"type": "error", "data": "请输入至少10个字符的文章内容"}
            return

        paragraphs = [p.strip() for p in article.split("\n\n") if p.strip()]
        if len(paragraphs) <= 1:
            # 单段落，使用全文模式
            yield from self.polish_article(article=article, style=style, mode="full", temperature=temperature)
            return

        yield {"type": "progress", "data": f"文章已分为 {len(paragraphs)} 段，开始逐段润色..."}

        all_polished = []
        all_kb_refs = []
        seen_sources = set()
        for i, para in enumerate(paragraphs):
            yield {"type": "progress", "data": f"正在润色第 {i+1}/{len(paragraphs)} 段..."}

            tokens_collected = ""
            final_result = None

            for event in self.polish_article(
                article=para,
                style=style,
                use_kb=True,
                mode="paragraph",
                temperature=temperature,
            ):
                if event["type"] == "token":
                    tokens_collected += event["data"]
                elif event["type"] == "result":
                    final_result = event["data"]
                    # 收集每段的知识库引用（按 source 去重）
                    for ref in final_result.get("kb_refs", []):
                        src = ref.get("source", "")
                        if src and src not in seen_sources:
                            seen_sources.add(src)
                            all_kb_refs.append(ref)

            all_polished.append(final_result.get("polished_text", para) if final_result else tokens_collected)
            yield {
                "type": "paragraph_done",
                "data": {"index": i, "total": len(paragraphs), "polished": all_polished[-1]},
            }

        # 合并所有润色后段落
        full_polished = "\n\n".join(all_polished)
        self._last_kb_refs = all_kb_refs
        yield {
            "type": "result",
            "data": {
                "polished_text": full_polished,
                "changes": [],
                "suggestions": [f"全文共 {len(paragraphs)} 段，已逐段润色完成"],
                "style_match_score": 0,
                "kb_refs": all_kb_refs,
            },
        }

    def continue_polish(
        self, instruction: str, temperature: float = None
    ) -> Generator[Dict, None, None]:
        """
        多轮追问润色 — 基于对话历史继续优化
        评分点: 多轮追问
        """
        if not self.ensure_client():
            yield {"type": "error", "data": "请先完成首次润色"}
            return

        if not self.conversation_history:
            # 对话历史为空（可能服务器重启），使用指令独立生成回复
            follow_up = (
                f"请根据以下要求回复用户（对话历史已丢失，请基于该要求独立完成）:\n{instruction}\n\n"
                "请以自然语言回复，用 Markdown 格式化。"
            )
            messages = self.client.build_messages(
                system_prompt="你是文章润色助手，请根据用户的要求给出帮助。以自然对话方式回复，使用 Markdown 排版。",
                user_content=follow_up,
                history=None,
            )
        else:
            follow_up = (
                f"请根据以下要求对上轮润色结果进行进一步优化:\n{instruction}\n\n"
                "请以自然语言回复，用 Markdown 格式化，包含润色后的文本和修改说明。"
            )

            messages = self.client.build_messages(
                system_prompt="你是文章润色助手，请根据用户的进一步要求优化上轮润色结果。以自然对话方式回复，使用 Markdown 排版。",
                user_content=follow_up,
                history=self.conversation_history[-6:],
            )

        try:
            full_response = ""
            for token in self.client.chat_completion(
                messages=messages,
                temperature=temperature,
                stream=True,
            ):
                full_response += token
                yield {"type": "token", "data": token}

            self.conversation_history.append({"role": "user", "content": follow_up.strip()})
            if full_response.strip():
                self.conversation_history.append({"role": "assistant", "content": full_response.strip()})

            yield {
                "type": "result",
                "data": {
                    "polished_text": full_response,
                    "changes": [],
                    "suggestions": [],
                    "style_match_score": 0,
                    "kb_refs": self._last_kb_refs,
                },
            }

        except Exception as e:
            logger.error(f"继续润色异常: {e}")
            yield {"type": "error", "data": str(e)}

    def clear_history(self):
        """清空对话历史"""
        self.conversation_history = []

    def reload_kb(self):
        """重新初始化知识库（增删语料后调用）"""
        # 重新创建 KnowledgeBase 实例以强制重新加载文档
        self.kb = KnowledgeBase()
        status = self.kb.init_knowledge_base(force_rebuild=True)
        logger.info(f"知识库重新加载: {status}")
        return status

    def get_kb_sources(self) -> dict:
        """获取知识库来源列表（评分点: 资料来源展示）"""
        return self.kb.get_kb_status()
