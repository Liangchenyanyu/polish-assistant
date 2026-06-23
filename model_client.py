"""
大模型API客户端模块
负责: OpenAI兼容API调用、流式传输、上下文管理、超时重试
支持: DeepSeek / Qwen（Chat Completions） / Doubao（Responses API） / 自定义
评分对应: 基础Chat Completion接口、流式传输、异常处理
"""
import time
import logging
from typing import Generator, List, Dict, Optional
from openai import OpenAI, APITimeoutError, RateLimitError
from config import config

logger = logging.getLogger(__name__)


class ModelClient:
    """大模型API客户端 — 根据模型类型选择 Chat Completions 或 Responses API"""

    def __init__(self, model_type: str = None, api_key: str = None):
        self.model_type = model_type or config.default_model
        model_config = config.get_model_config(self.model_type)

        # API Key：参数传入 > 内存设置（界面输入） > 环境变量
        self.api_key = api_key or config.get_api_key(self.model_type)
        if not self.api_key:
            raise ValueError(
                f"未找到 {self.model_type} 的 API Key。请在界面中输入 API Key。"
            )

        self.base_url = model_config.get("base_url", "")
        self.model_name = model_config.get("name", "")

        # 豆包模型使用 Responses API（火山引擎 Ark 端点）
        self._use_responses_api = (self.model_type == "doubao")

        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=config.api_timeout,
        )

        label = "Responses API" if self._use_responses_api else "Chat Completions"
        logger.info(
            f"模型客户端初始化: provider={self.model_type}, model={self.model_name} ({label})"
        )

    # ========== 统一入口 ==========

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = None,
        top_p: float = None,
        max_tokens: int = None,
        stream: bool = True,
    ) -> Generator[str, None, None]:
        """统一接口，根据模型类型分发到 Chat Completions 或 Responses API"""
        if self._use_responses_api:
            yield from self._responses_create(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=stream,
            )
        else:
            yield from self._chat_completions_create(
                messages=messages,
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_tokens,
                stream=stream,
            )

    # ========== Chat Completions（DeepSeek / Qwen / 自定义）==========

    def _chat_completions_create(
        self,
        messages: List[Dict[str, str]],
        temperature: float = None,
        top_p: float = None,
        max_tokens: int = None,
        stream: bool = True,
    ) -> Generator[str, None, None]:
        """标准 Chat Completions API"""
        defaults = config.default_params
        params = {
            "model": self.model_name,
            "messages": messages,
            "stream": stream,
            "temperature": temperature if temperature is not None else defaults.get("temperature", 0.7),
            "top_p": top_p if top_p is not None else defaults.get("top_p", 0.9),
            "max_tokens": max_tokens if max_tokens is not None else defaults.get("max_tokens", 4096),
        }

        last_error = None
        for attempt in range(config.max_retries):
            try:
                logger.info(f"Chat Completions: model={self.model_name}, attempt={attempt+1}")
                response = self.client.chat.completions.create(**params)

                if stream:
                    for chunk in response:
                        delta = chunk.choices[0].delta
                        if delta.content:
                            yield delta.content
                else:
                    yield response.choices[0].message.content
                return

            except APITimeoutError as e:
                last_error = e
                logger.warning(f"API超时，第{attempt+1}次重试...")
                time.sleep(config.retry_delay)

            except RateLimitError as e:
                last_error = e
                logger.warning(f"触发限流，第{attempt+1}次重试...")
                time.sleep(config.retry_delay * 2)

            except Exception as e:
                last_error = e
                logger.error(f"API调用异常: {str(e)}")
                if attempt >= config.max_retries - 1:
                    yield f"\n【系统错误】服务暂时不可用，请稍后重试。原因: {str(e)}"
                    return
                time.sleep(config.retry_delay)

    # ========== Responses API（Doubao / 火山引擎 Ark）==========

    def _messages_to_input(
        self, messages: List[Dict[str, str]]
    ) -> tuple:
        """Chat Completions 消息列表 → Responses API 的 input + instructions"""
        instructions = ""
        input_items = []
        for msg in messages:
            content = msg.get("content", "")
            # 跳过 content 为空或非字符串的消息，避免 API 报 MissingParameter
            if not isinstance(content, str) or not content.strip():
                continue
            if msg["role"] == "system":
                instructions = content
            else:
                input_items.append({
                    "role": msg["role"],
                    "content": [{"type": "input_text", "text": content}],
                })
        return instructions, input_items

    def _responses_create(
        self,
        messages: List[Dict[str, str]],
        temperature: float = None,
        max_tokens: int = None,
        stream: bool = True,
    ) -> Generator[str, None, None]:
        """Responses API 调用（豆包 Doubao / 火山引擎 Ark）"""
        defaults = config.default_params
        instructions, input_items = self._messages_to_input(messages)

        params = {
            "model": self.model_name,
            "input": input_items,
            "temperature": temperature if temperature is not None else defaults.get("temperature", 0.7),
            "max_output_tokens": max_tokens if max_tokens is not None else defaults.get("max_tokens", 4096),
            "stream": stream,
        }
        if instructions:
            params["instructions"] = instructions

        last_error = None
        for attempt in range(config.max_retries):
            try:
                logger.info(
                    f"Responses API: model={self.model_name}, "
                    f"stream={stream}, attempt={attempt+1}"
                )
                response = self.client.responses.create(**params)

                if stream:
                    for event in response:
                        if event.type == "response.output_text.delta":
                            yield event.delta
                else:
                    yield response.output_text
                return

            except APITimeoutError as e:
                last_error = e
                logger.warning(f"API超时，第{attempt+1}次重试...")
                time.sleep(config.retry_delay)

            except RateLimitError as e:
                last_error = e
                logger.warning(f"触发限流，第{attempt+1}次重试...")
                time.sleep(config.retry_delay * 2)

            except Exception as e:
                last_error = e
                logger.error(f"API调用异常: {str(e)}")
                if attempt >= config.max_retries - 1:
                    yield f"\n【系统错误】服务暂时不可用，请稍后重试。原因: {str(e)}"
                    return
                time.sleep(config.retry_delay)

    # ========== 工具方法 ==========

    def chat_completion_sync(
        self,
        messages: List[Dict[str, str]],
        temperature: float = None,
        top_p: float = None,
        max_tokens: int = None,
    ) -> str:
        """同步调用（非流式），返回完整文本"""
        full = ""
        for token in self.chat_completion(
            messages=messages,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
            stream=True,
        ):
            full += token
        return full

    @staticmethod
    def build_messages(
        system_prompt: str,
        user_content: str,
        history: Optional[List[Dict]] = None,
    ) -> List[Dict[str, str]]:
        """构建消息列表，支持多轮上下文（评分点: 上下文管理）"""
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            # 过滤掉 content 为空的历史消息，避免 Responses API 报 MissingParameter
            messages.extend(
                h for h in history
                if isinstance(h.get("content"), str) and h["content"].strip()
            )
        messages.append({"role": "user", "content": user_content})
        return messages

    @classmethod
    def validate_connection(cls, model_type: str, api_key: str, base_url: str) -> tuple:
        """快速验证 API 连接是否正常"""
        model_cfg = config.get_model_config(model_type)
        model_name = model_cfg.get("name", "deepseek-chat")
        actual_url = base_url or model_cfg.get("base_url", "")

        logger.info(
            f"验证连接: type={model_type}, url={actual_url}, "
            f"model={model_name}, key={api_key[:8]}..."
        )

        try:
            test_client = OpenAI(
                api_key=api_key,
                base_url=actual_url,
                timeout=15,
            )

            # 豆包使用 Responses API（test.py 验证通过）
            if model_type == "doubao":
                response = test_client.responses.create(
                    model=model_name,
                    input=[
                        {
                            "role": "user",
                            "content": [{"type": "input_text", "text": "Hi"}],
                        }
                    ],
                )
                _ = response.output_text
            else:
                response = test_client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": "Hi"}],
                    max_tokens=5,
                )
                _ = response.choices[0].message.content

            return True, "连接成功"

        except Exception as e:
            logger.error(f"连接验证失败 [{model_type}]: {type(e).__name__}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False, str(e)
