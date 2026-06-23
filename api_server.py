"""
FastAPI 后端 API 服务器
负责: RESTful API + SSE流式传输 + CORS
将现有业务逻辑以 API 方式暴露给 React 前端
"""
import os
# 在导入 langchain 相关模块之前设置 HF 超时，避免冷启动时长时间挂起
os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "3")
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")

import sys
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional
from io import BytesIO
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# 确保项目根目录在 sys.path 中
sys.path.insert(0, str(Path(__file__).parent))

from polish_engine import PolishEngine
from model_client import ModelClient
from config import config
from utils import setup_logging, save_polish_result, standardize_format, export_to_word, export_to_pdf
from text_analyzer import analyze_text
from quotes_library import match_quotes_by_text, get_quotes_by_theme

# ---------- 初始化 ----------
logger = setup_logging()
engine = PolishEngine()

# 前端构建产物目录：polish-assistant/frontend/dist（单服务模式下由后端直接 serve）
FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "=" * 50)
    print("  AI文章润色助手 已启动 (单服务模式)")
    print("  访问: http://127.0.0.1:8000")
    has_frontend = (FRONTEND_DIST / "index.html").exists()
    if has_frontend:
        print("  前端: 已集成 (frontend/dist)")
    else:
        print("  前端: 未构建 (请运行: cd frontend && npm install && npm run build)")
    print("  文档: http://127.0.0.1:8000/docs")
    print("=" * 50 + "\n")
    yield

app = FastAPI(
    title="AI文章润色助手 API",
    description="基于大模型的智能文章润色服务",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — 允许前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- 请求模型 ----------

class PolishRequest(BaseModel):
    text: str = Field(..., min_length=10, description="待润色文章内容")
    style: str = Field(default="academic", description="润色风格")
    mode: str = Field(default="full", description="润色模式: full / paragraph")
    temperature: Optional[float] = Field(default=None, ge=0.1, le=1.5)
    max_tokens: Optional[int] = Field(default=None, ge=512, le=8192)
    use_kb: bool = Field(default=True, description="是否启用知识库增强")
    custom_instructions: str = Field(default="", description="自定义风格说明")
    action: str = Field(default="polish", description="润色操作: polish/paraphrase/deai/simplify/continue/tone_shift")
    intensity: str = Field(default="medium", description="润色强度: light/medium/deep")
    target_words: int = Field(default=0, description="目标字数（0=不限制）")
    shift_type: str = Field(default="gentle", description="话术转换子类型: gentle/persuasive/positive/formal/casual")
    selected_text: str = Field(default="", description="局部选中文本（空=全文）")
    role: str = Field(default="editor", description="润色角色: editor/teacher/business/academic")

class ContinuePolishRequest(BaseModel):
    instruction: str = Field(..., min_length=1, description="进一步优化要求")
    temperature: Optional[float] = Field(default=None, ge=0.1, le=1.5)

class ConnectionTestRequest(BaseModel):
    model_type: str = Field(default="deepseek")
    api_key: str = Field(..., min_length=1)
    base_url: Optional[str] = None

class ExportRequest(BaseModel):
    original: str = Field(..., min_length=1)
    polished: str = Field(..., min_length=1)
    style: str = Field(default="academic")
    format: str = Field(default="markdown", description="导出格式: markdown / text / word / pdf")

class AnalysisRequest(BaseModel):
    text: str = Field(..., min_length=10, description="待分析文本")

class FormatStandardizeRequest(BaseModel):
    text: str = Field(..., min_length=10, description="待标准化文本")

class QuotesRequest(BaseModel):
    text: str = Field(default="", min_length=0, description="用于匹配金句的文本（空=随机推荐）")
    theme: str = Field(default="", description="指定主题")
    count: int = Field(default=5, ge=1, le=20, description="返回数量")

# ---------- API 端点 ----------

@app.get("/")
async def root():
    """根路径 — 优先返回前端页面；若前端未构建则返回 API 信息"""
    index_html = FRONTEND_DIST / "index.html"
    if index_html.exists():
        return FileResponse(index_html)
    return {
        "service": "AI文章润色助手 API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
        "hint": "前端未构建，请先运行: cd frontend && npm install && npm run build",
    }

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "model": config.default_model,
        "has_api_key": config.validate_api_key(),
    }

@app.post("/api/connection/test")
async def test_connection(req: ConnectionTestRequest):
    """测试大模型 API 连接"""
    base_url = req.base_url or config.get_model_config(req.model_type).get("base_url", "")
    logger.info(
        f"连接测试: model_type={req.model_type}, base_url={base_url}, "
        f"api_key={req.api_key[:8]}..."
    )

    success, message = ModelClient.validate_connection(
        model_type=req.model_type,
        api_key=req.api_key,
        base_url=base_url,
    )

    if not success:
        logger.error(f"连接测试失败 [{req.model_type}]: {message}")

    if success:
        config.set_api_key(req.model_type, req.api_key)
        try:
            engine.set_client(model_type=req.model_type, api_key=req.api_key)
        except Exception:
            pass
    return {"success": success, "message": message}

@app.post("/api/polish")
async def polish_article(req: PolishRequest):
    """流式润色文章 — SSE (Server-Sent Events)"""

    async def event_stream():
        stream = engine.polish_article(
            article=req.text,
            style=req.style,
            use_kb=req.use_kb,
            mode=req.mode,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            custom_instructions=req.custom_instructions,
            action=req.action,
            intensity=req.intensity,
            target_words=req.target_words,
            shift_type=req.shift_type,
            selected_text=req.selected_text,
            role=req.role,
        )

        for event in stream:
            event_type = event.get("type", "unknown")
            event_data = event.get("data", "")

            if event_type == "token":
                yield f"data: {json.dumps({'type': 'token', 'data': event_data}, ensure_ascii=False)}\n\n"
            elif event_type == "progress":
                yield f"data: {json.dumps({'type': 'progress', 'data': event_data}, ensure_ascii=False)}\n\n"
            elif event_type == "result":
                yield f"data: {json.dumps({'type': 'result', 'data': event_data}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            elif event_type == "paragraph_done":
                yield f"data: {json.dumps({'type': 'paragraph_done', 'data': event_data}, ensure_ascii=False)}\n\n"
            elif event_type == "error":
                yield f"data: {json.dumps({'type': 'error', 'data': event_data}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@app.post("/api/polish/continue")
async def continue_polish(req: ContinuePolishRequest):
    """多轮追问润色 — SSE 流式"""

    async def event_stream():
        for event in engine.continue_polish(
            instruction=req.instruction,
            temperature=req.temperature,
        ):
            event_type = event.get("type", "unknown")
            event_data = event.get("data", "")

            if event_type == "token":
                yield f"data: {json.dumps({'type': 'token', 'data': event_data}, ensure_ascii=False)}\n\n"
            elif event_type == "result":
                yield f"data: {json.dumps({'type': 'result', 'data': event_data}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            elif event_type == "error":
                yield f"data: {json.dumps({'type': 'error', 'data': event_data}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传文件并读取内容"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="未选择文件")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".txt", ".md"):
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {suffix}")

    try:
        content = await file.read()
        text = content.decode("utf-8")
        return {"filename": file.filename, "content": text, "size": len(text)}
    except UnicodeDecodeError:
        try:
            text = content.decode("gbk")
            return {"filename": file.filename, "content": text, "size": len(text)}
        except Exception:
            raise HTTPException(status_code=400, detail="文件编码不支持，请使用 UTF-8 编码")

@app.post("/api/export")
async def export_result(req: ExportRequest):
    """导出润色结果 — 支持 markdown/text/word/pdf"""
    if req.format == "word":
        filepath = export_to_word(req.original, req.polished, req.style)
        return FileResponse(
            filepath,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=Path(filepath).name,
        )
    elif req.format == "pdf":
        filepath = export_to_pdf(req.original, req.polished, req.style)
        media = "application/pdf" if filepath.endswith('.pdf') else "text/plain"
        return FileResponse(
            filepath,
            media_type=media,
            filename=Path(filepath).name,
        )

    # markdown / text
    filepath = save_polish_result(
        original=req.original,
        polished=req.polished,
        style=req.style,
    )

    if req.format == "text":
        txt_path = Path(filepath).with_suffix(".txt")
        txt_content = f"原文:\n{req.original}\n\n---\n\n润色后:\n{req.polished}"
        txt_path.write_text(txt_content, encoding="utf-8")
        return FileResponse(
            str(txt_path),
            media_type="text/plain",
            filename=txt_path.name,
        )

    return FileResponse(
        filepath,
        media_type="text/markdown",
        filename=Path(filepath).name,
    )

@app.post("/api/clear")
async def clear_history():
    """清空对话历史"""
    engine.clear_history()
    return {"success": True, "message": "对话历史已清空"}

@app.get("/api/kb/status")
async def get_kb_status():
    """获取知识库状态"""
    kb_status = engine.get_kb_sources()
    return kb_status

@app.post("/api/analysis")
async def analyze_article(req: AnalysisRequest):
    """文本智能分析 — 可读性、语病、重复度、敏感词、关键词、摘要"""
    try:
        result = analyze_text(req.text)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"文本分析失败: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/format")
async def format_standardize(req: FormatStandardizeRequest):
    """格式标准化 — 统一标点、段落、缩进、去除多余空行"""
    try:
        result = standardize_format(req.text)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"格式标准化失败: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/quotes")
async def get_quotes(req: QuotesRequest):
    """获取金句推荐 — 根据文本自动匹配或按主题查询"""
    try:
        if req.theme:
            quotes = get_quotes_by_theme(req.theme, req.count)
            return {"success": True, "data": {"quotes": quotes, "theme": req.theme}}
        elif req.text:
            result = match_quotes_by_text(req.text, req.count)
            return {"success": True, "data": result}
        else:
            quotes = get_quotes_by_theme("", req.count)
            return {"success": True, "data": {"quotes": quotes, "theme": "随机"}}
    except Exception as e:
        logger.error(f"金句推荐失败: {e}")
        return {"success": False, "error": str(e)}


# ========== 语料库管理 API ==========

class CorpusAddRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100, description="语料库标题（将作为文件名）")
    content: str = Field(..., min_length=10, description="语料库内容（至少10个字符）")


@app.get("/api/corpus/list")
async def list_corpus():
    """获取语料库文件列表（含文件大小、创建时间）"""
    docs_dir = config.docs_dir
    corpus_list = []
    for f in sorted(docs_dir.glob("*.txt")):
        stat = f.stat()
        corpus_list.append({
            "filename": f.name,
            "display_name": f.stem,
            "size": stat.st_size,
            "size_display": _format_file_size(stat.st_size),
            "chars": _count_chars(f),
            "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return {"corpus": corpus_list, "total": len(corpus_list), "docs_dir": str(docs_dir)}


@app.post("/api/corpus/add")
async def add_corpus(req: CorpusAddRequest):
    """添加自定义语料库（保存为 .txt 文件到 docs/ 目录）"""
    docs_dir = config.docs_dir
    # 清理文件名：移除非法字符，限制长度
    safe_name = _sanitize_filename(req.title)
    if not safe_name:
        raise HTTPException(status_code=400, detail="标题无效，无法生成文件名")
    filepath = docs_dir / f"{safe_name}.txt"
    if filepath.exists():
        raise HTTPException(status_code=409, detail=f"语料库 '{safe_name}' 已存在，请使用其他名称")
    try:
        filepath.write_text(req.content, encoding="utf-8")
        logger.info(f"语料库已添加: {filepath.name} ({len(req.content)} 字符)")
        return {
            "success": True,
            "message": f"语料库 '{safe_name}' 添加成功",
            "filename": filepath.name,
            "chars": len(req.content),
            "need_reload": True,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@app.delete("/api/corpus/{filename:path}")
async def delete_corpus(filename: str):
    """删除指定语料库文件"""
    # 安全校验：不允许路径遍历攻击
    safe_name = Path(filename).name
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="无效的文件名")
    filepath = config.docs_dir / safe_name
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"语料库 '{safe_name}' 不存在")
    if not filepath.suffix.lower() == ".txt":
        raise HTTPException(status_code=400, detail="只能删除 .txt 语料库文件")
    try:
        size = filepath.stat().st_size
        filepath.unlink()
        logger.info(f"语料库已删除: {safe_name}")
        return {
            "success": True,
            "message": f"语料库 '{safe_name}' 已删除",
            "need_reload": True,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@app.post("/api/corpus/reload")
async def reload_corpus():
    """重新初始化知识库（增删语料后调用）"""
    try:
        engine.reload_kb()
        logger.info("知识库已重新加载")
        return {
            "success": True,
            "message": "知识库已重新加载，新增语料已生效",
        }
    except Exception as e:
        logger.error(f"知识库重新加载失败: {e}")
        raise HTTPException(status_code=500, detail=f"重新加载失败: {str(e)}")


# ========== 辅助函数 ==========

def _format_file_size(size: int) -> str:
    """格式化文件大小"""
    if size < 1024:
        return f"{size} B"
    elif size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    else:
        return f"{size / 1024 / 1024:.1f} MB"


def _count_chars(filepath: Path) -> int:
    """统计文件字符数（UTF-8 编码）"""
    try:
        return len(filepath.read_text(encoding="utf-8"))
    except Exception:
        return 0


def _sanitize_filename(name: str) -> str:
    """清理文件名，移除不安全字符"""
    import re
    # 只保留中文、英文、数字、下划线、连字符
    safe = re.sub(r'[^\w\u4e00-\u9fff\-]', '_', name.strip())
    # 移除连续下划线
    safe = re.sub(r'_+', '_', safe)
    # 限制长度
    return safe[:50].strip('_')

@app.get("/api/config")
async def get_config():
    """获取应用配置（不含敏感信息）"""
    return config.to_dict()

# ---------- 前端静态资源挂载 + SPA 回退 ----------

# 仅当前端已构建时启用静态服务（开发模式可单独跑 Vite，无需构建）
if FRONTEND_DIST.exists():
    # 挂载 Vite 构建产物中的资源目录（JS / CSS 分片）
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    # 挂载 public 目录下的根级静态文件（如 favicon、vite.svg 等）
    public_dir = FRONTEND_DIST
    if public_dir.exists():
        app.mount("/static", StaticFiles(directory=public_dir), name="frontend-public")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str, request: Request):
        """SPA 路由回退：
        - /api/* 未匹配的路径 → 404（避免把 API 错误吞掉当成前端路由）
        - 其它路径：若对应静态文件存在则返回文件，否则返回 index.html
        """
        # API 路径未命中已定义端点 → 404
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail=f"API endpoint not found: /{full_path}")

        # 命中根级静态文件（如 favicon.ico / vite.svg）
        candidate = FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)

        # 其余一律返回 index.html，交给前端路由处理
        index_html = FRONTEND_DIST / "index.html"
        if index_html.exists():
            return FileResponse(index_html)
        raise HTTPException(status_code=404, detail="Frontend not built")

# ---------- 启动 ----------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
