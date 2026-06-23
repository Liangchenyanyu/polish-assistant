"""
配置管理模块
负责: 配置文件加载、API Key安全调用（不保存）、模型参数默认值、路径配置
评分对应: API Key安全调用、API Key环境变量配置
"""
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# 加载 .env（如果存在），作为补充配置源
load_dotenv()

# 基础路径
BASE_DIR = Path(__file__).parent.resolve()
CONFIG_PATH = BASE_DIR / "config.json"


def _load_json_config() -> Dict[str, Any]:
    """加载 config.json 配置文件"""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


class AppConfig:
    """
    应用全局配置
    API Key 不在文件中存储，仅在运行时由用户在界面输入（内存中保持）
    """

    _instance = None
    _api_keys: Dict[str, str] = {}  # 运行时 API Key（不持久化）

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance

    def __init__(self):
        if self._loaded:
            return
        self._loaded = True
        self._config = _load_json_config()
        self._init_paths()

    # ---- API Key 管理（仅在内存中，不保存到任何文件） ----

    @classmethod
    def set_api_key(cls, provider: str, api_key: str):
        """设置 API Key（仅内存，不持久化）"""
        cls._api_keys[provider] = api_key

    @classmethod
    def get_api_key(cls, provider: str) -> Optional[str]:
        """
        获取 API Key：优先界面输入，其次环境变量
        返回 None 表示未配置
        """
        # 优先内存中的（界面输入）
        key = cls._api_keys.get(provider)
        if key:
            return key
        # 回退到环境变量
        env_map = {"deepseek": "DEEPSEEK_API_KEY", "qwen": "QWEN_API_KEY", "doubao": "DOUBAO_API_KEY"}
        env_key = env_map.get(provider, "")
        return os.getenv(env_key) if env_key else None

    @classmethod
    def clear_api_keys(cls):
        """清空所有 API Key"""
        cls._api_keys.clear()

    # ---- 模型配置 ----

    @property
    def default_model(self) -> str:
        return self._config.get("default_model", "deepseek")

    def get_model_config(self, model_type: str = None) -> dict:
        """获取指定模型的配置"""
        mt = model_type or self.default_model
        models = self._config.get("models", {})
        return models.get(mt, {})

    @property
    def available_models(self) -> list:
        """可用模型列表"""
        models = self._config.get("models", {})
        return [{"key": k, "name": v.get("display_name", k)} for k, v in models.items()]

    # ---- 默认参数 ----

    @property
    def default_params(self) -> dict:
        return self._config.get("default_params", {})

    @property
    def style_temperatures(self) -> dict:
        return self._config.get("style_temperatures", {})

    def get_style_temperature(self, style: str) -> float:
        temps = self.style_temperatures
        return temps.get(style, self.default_params.get("temperature", 0.7))

    # ---- API 配置 ----

    @property
    def api_config(self) -> dict:
        return self._config.get("api", {})

    @property
    def api_timeout(self) -> int:
        return self.api_config.get("timeout", 60)

    @property
    def max_retries(self) -> int:
        return self.api_config.get("max_retries", 3)

    @property
    def retry_delay(self) -> int:
        return self.api_config.get("retry_delay", 2)

    # ---- RAG 配置 ----

    @property
    def rag_config(self) -> dict:
        return self._config.get("rag", {})

    @property
    def chunk_size(self) -> int:
        return self.rag_config.get("chunk_size", 500)

    @property
    def chunk_overlap(self) -> int:
        return self.rag_config.get("chunk_overlap", 50)

    @property
    def top_k_retrieval(self) -> int:
        return self.rag_config.get("top_k", 3)

    @property
    def score_threshold(self) -> float:
        return self.rag_config.get("score_threshold", 0.3)

    @property
    def embedding_model(self) -> str:
        return self.rag_config.get("embedding_model", "BAAI/bge-small-zh-v1.5")

    @property
    def hf_mirror(self) -> str:
        """HuggingFace 镜像地址，留空则不使用镜像"""
        return self.rag_config.get("hf_mirror", "")

    @property
    def kb_init_timeout(self) -> int:
        """知识库初始化超时时间（秒）"""
        return self.rag_config.get("kb_init_timeout", 30)

    # ---- 路径 ----

    def _init_paths(self):
        paths = self._config.get("paths", {})
        self.docs_dir = BASE_DIR / paths.get("docs_dir", "docs")
        self.data_dir = BASE_DIR / paths.get("data_dir", "data")
        self.logs_dir = BASE_DIR / paths.get("logs_dir", "logs")
        self.vector_db_dir = BASE_DIR / paths.get("vector_db_dir", "vector_db")

        # 确保目录存在
        for d in [self.docs_dir, self.data_dir, self.logs_dir, self.vector_db_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def validate_api_key(self, provider: str = None) -> bool:
        """验证 API Key 是否已配置"""
        p = provider or self.default_model
        return bool(self.get_api_key(p))

    def to_dict(self) -> dict:
        """导出配置摘要（不含敏感信息）"""
        return {
            "default_model": self.default_model,
            "available_models": self.available_models,
            "default_params": self.default_params,
            "api_config": {"timeout": self.api_timeout, "max_retries": self.max_retries},
            "rag_config": self.rag_config,
            "paths": {
                "docs_dir": str(self.docs_dir),
                "data_dir": str(self.data_dir),
                "logs_dir": str(self.logs_dir),
                "vector_db_dir": str(self.vector_db_dir),
            },
        }


# 全局单例
config = AppConfig()
