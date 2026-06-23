# CLAUDE.md — AI 文章润色助手

> AI 可读项目上下文文档。修改功能/样式/业务逻辑时，先读这里。

---

## 1. 项目概述

**基于大模型的智能文章润色应用**，支持多风格润色（学术/商务/自媒体/简洁/自定义）、段落/全文两种模式、知识库增强（RAG）、多轮对话优化。

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Python FastAPI + Uvicorn (端口 8000)
- **通信**: RESTful API + SSE 流式传输
- **AI 模型**: DeepSeek-V3 / Qwen-Max（OpenAI 兼容接口）
- **RAG**: LangChain + ChromaDB + BGE 中文嵌入模型

---

## 2. 项目目录结构

```
polish-assistant/
├── api_server.py          ← 后端入口，FastAPI 服务器（10 个 API 端点）
├── config.py              ← 单例配置（API Key 优先级：内存 > .env）
├── model_client.py        ← OpenAI 兼容客户端（流式 + 重试）
├── prompt_manager.py      ← COSTAR 提示词工程（V1/V2 + 6大工具 + 角色系统 + 强度控制）
├── polish_engine.py       ← 核心润色引擎（编排 RAG→提示词→API→解析，支持 action/role/intensity）
├── knowledge_base.py      ← RAG 知识库（ChromaDB + bge-small-zh）
├── text_analyzer.py       ← ★ 文本智能分析（可读性/语病/重复度/敏感词/关键词/摘要）
├── quotes_library.py      ← ★ 金句素材库（10大主题 + 自动匹配）
├── utils.py               ← 工具函数（日志/文件解析/结果导出/格式标准化/Word/PDF导出）
├── requirements.txt       ← Python 依赖
├── docs/                  ← 5 份写作规范 .txt（知识库资料）
├── vector_db/             ← ChromaDB 持久化向量库
│
└── frontend/              ← React 前端
    ├── src/
    │   ├── App.tsx                     ← 根组件（状态管理+多对话+数据流派发）
    │   ├── main.tsx                    ← ReactDOM 入口
    │   ├── index.css                   ← Tailwind + 全局样式 + 动画
    │   ├── types/index.ts              ← 类型定义 + STYLE_CONFIG + Conversation + KbReference 接口
    │   ├── services/api.ts             ← 后端 API 请求封装
    │   ├── hooks/
    │   │   ├── usePolish.ts            ← 润色 Hook（SSE 流式解析 + loadHistory）
    │   │   ├── useApiConfig.ts         ← API 配置 Hook
    │   │   └── useConversations.ts     ← ★ 多对话管理 Hook（localStorage 持久化）
    │   ├── components/
    │   │   ├── ChatInputBar.tsx        ← ★ 底部输入栏（工具选择+风格+角色+强度+字数控制）
    │   │   ├── ResultPanel.tsx         ← 聊天消息区（对话气泡+对比+引用来源 Tab）
    │   │   ├── AnalysisPanel.tsx       ← ★ 文本智能分析弹窗（6维度分析+展开/折叠）
    │   │   ├── Sidebar.tsx             ← ★ 侧边栏（折叠/搜索/新建/切换/清空/删除对话，连接状态点击打开API设置）
    │   │   ├── Header.tsx              ← 顶栏（导出+侧边栏展开）
    │   │   ├── ApiConfigModal.tsx      ← API 配置弹窗
    │   │   ├── Popover.tsx             ← Portal 弹出层组件
    │   │   ├── StyleSelector.tsx       ← 风格选择器（辅助，已被替代）
    │   │   └── ParamSettings.tsx       ← 参数设置面板（辅助，已被替代）
    │   └── lib/utils.ts               ← cn() 类名合并工具
    ├── tailwind.config.js              ← 主题色 primary: blue
    ├── vite.config.ts                  ← Vite 配置（/api 代理到 8000）
    └── package.json
```

---

## 3. 数据流全景

```
┌─────────────────────────────────────────────────────────────┐
│  前端 ChatInputBar                                           │
│  用户输入 → handleSendMessage(fileContent?)                  │
│    ├─ 有历史? → continuePolish(instruction)                  │
│    └─ 无历史? → startPolish({text, style, mode, ...})       │
└──────────────────────┬──────────────────────────────────────┘
                       │ POST /api/polish (SSE)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  后端 PolishEngine                                           │
│  1. KnowledgeBase.retrieve(query) → RAG 检索写作规范         │
│  2. PromptManager.get_prompt(style) → COSTAR 系统提示词      │
│  3. ModelClient.chat_completion() → 流式调用大模型 API       │
│  4. 自然语言响应 → 包含润色文本 + 修改说明 + 改进建议     │
│  5. kb_refs（来源/片段/相关度分数）→ result 事件透传前端  │
└──────────────────────┬──────────────────────────────────────┘
                       │ SSE events: progress → token* → result → done
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  前端 usePolish Hook (ReadableStream 解析)                    │
│  → polishedText 逐字累加 → ResultPanel 实时渲染              │
│  → kb_refs → 引用来源 Tab 展示（文件名+相关度+可展开片段）   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 修改指南：改哪里？

### 改输入框 UI（按钮、布局、快捷操作）

→ **`frontend/src/components/ChatInputBar.tsx`**

关键区域标注：
| 行区域 | 内容 |
|--------|------|
| 约 165-180 | `quickActions` 快捷提示词数组 |
| 约 200-260 | 模型切换 Popover 内容 |
| 约 265-330 | 更多设置 Popover 内容 |
| 约 350-370 | 文件卡片渲染 |
| 约 375-390 | 快捷提示词按钮渲染 |
| 约 430-460 | 底部工具栏（上传/模型切换/模式/更多按钮） |
| 约 460-470 | 发送按钮 |

### 改聊天消息区 UI（气泡、Markdown、Tab）

→ **`frontend/src/components/ResultPanel.tsx`**

| 行区域 | 内容 |
|--------|------|
| 约 40-170 | `ChatBubble` 子组件（头像/气泡体/Markdown/KB引用） |
| 约 86-147 | Markdown 自定义渲染组件 |
| 约 275-300 | 对话 Tab 内容区 |
| 约 300-315 | 对比 Tab 内容区 |
| 约 466-540 | 引用来源 Tab 内容区（KB 引用卡片+展开/折叠交互） |

### 改整体布局结构

→ **`frontend/src/App.tsx`** — flex 横向布局（侧边栏 + 主内容区）+ 多对话状态管理  
→ **`frontend/src/index.css`** — 全局样式、滚动条、动画

### 改侧边栏/对话管理 UI

→ **`frontend/src/components/Sidebar.tsx`** — 侧边栏（折叠/搜索/对话列表/操作按钮）  
→ **`frontend/src/hooks/useConversations.ts`** — 多对话状态 + localStorage 持久化  
→ **`frontend/src/App.tsx`** — `handleNewConversation` / `handleSwitchConversation` / `handleClearConversation` / `handleDeleteConversation`

对话数据流：
- 持久化：`localStorage` key `polish-assistant-conversations`
- 保存时机：抛光完成时自动保存（监听 `isPolishing` 的 `true→false` 转换）
- 恢复时机：初始加载 + 切换对话时调用 `polish.loadHistory(messages)`
- 后端同步：切换/新建对话时调用 `POST /api/clear` 清空后端 `conversation_history`

### 改弹出层定位/裁剪问题

→ **`frontend/src/components/Popover.tsx`** — Portal 渲染到 body，自动计算位置  
→ **`frontend/src/index.css`** 第 29 行 `html, body, #root { overflow-hidden }` — 会裁剪非 Portal 弹出层

### 改后端润色业务逻辑

→ **`polish_engine.py`** — `polish_article()` / `polish_paragraphs()` / `continue_polish()`；管理 `_last_kb_refs` 缓存  
→ **`prompt_manager.py`** — COSTAR 提示词、风格定义、负向约束  
→ **`knowledge_base.py`** — RAG 检索策略

### 改 API 端点

→ **`api_server.py`** — FastAPI 路由定义（约 10 个端点）

### 改类型定义

→ **`frontend/src/types/index.ts`** — `PolishStyle`, `PolishMode`, `PolishResult`, `ChatMessage` 等  
→ `STYLE_CONFIG` 常量（5 种风格的颜色/图标/描述）

### 改 API 配置/Key 管理

→ **`config.py`** — 后端单例配置（API Key 优先级）  
→ **`frontend/src/hooks/useApiConfig.ts`** — 前端 API 配置状态  
→ **`frontend/src/components/ApiConfigModal.tsx`** — API 配置弹窗 UI  
→ **`frontend/src/components/Sidebar.tsx`** — 连接状态指示器（点击打开设置弹窗）

---

## 5. 常用命令

```bash
# === 单服务模式（推荐，仅运行后端即可）===
cd polish-assistant
venv\Scripts\python.exe api_server.py        # 启动服务 → http://127.0.0.1:8000
# 访问 http://127.0.0.1:8000 即为前端页面；/api/* 为后端接口；/docs 为 API 文档

# === 首次部署 / 前端改动后需重新构建前端 ===
cd polish-assistant\frontend
npm install                                  # 安装前端依赖（首次）
npm run build                                # 构建到 frontend/dist（后端会自动 serve）

# === 开发模式（可选，需同时跑两个服务）===
cd polish-assistant\frontend
npm run dev                                  # Vite 开发服务器 → http://localhost:5173（热更新）
# 后端另起: venv\Scripts\python.exe api_server.py

# 类型检查
npx tsc --noEmit                             # TypeScript 编译检查

# 构建验证
npx vite build                               # 构建并检查产物大小
```

---

## 6. 关键约定

- **CSS**: Tailwind Utility-First，不写自定义 CSS 文件（除 `index.css` 中的动画/滚动条）
- **组件**: 函数组件 + Hooks，无 Class 组件
- **状态**: React useState/useCallback，无全局状态库
- **API 通信**: SSE 流式 (`text/event-stream`)，ReadableStream 逐行解析
- **AI 输出**: 自然语言 Markdown 格式（非 JSON），类似豆包/DeepSeek/元宝的对话体验
- **润色工具系统**: 6 大操作（polish/paraphrase/deai/simplify/continue/tone_shift）+ 3 级强度（light/medium/deep）+ 4 种角色（editor/teacher/business/academic）+ 话术转换 5 种子类型
- **智能分析**: 可读性评分、语病检测、重复度检测、敏感词筛查、关键词提取、摘要生成（通过 /api/analysis 端点）
- **导出格式**: Markdown + 纯文本 + Word (.docx) + PDF
- **格式标准化**: /api/format 端点统一标点、段落、去除空行
- **金句库**: /api/quotes 端点按主题/文本自动匹配经典名句
- **前端 Tab**: 「对话」「对比」「引用来源」三个视图（v2.3）；引用来源 Tab 始终显示——有引用时展示知识库卡片（文档名+相关度进度条+可展开文本片段），无引用时展示空状态提示；ChatBubble 底部轻量按钮可一键切换到引用来源 Tab
- **弹出层**: 使用 `Popover` 组件（Portal 到 body），避免祖先 `overflow:hidden` 裁剪
- **润色中状态**: ChatInputBar 显示简洁停止栏（`isPolishing` 条件渲染）
- **文件上传**: 文件内容不显示在 textarea，内部存储 `fileContent`，发送时附带
- **API Key**: 不落盘，仅内存保存（前端通过 ApiConfigModal 输入）
- **对话持久化**: localStorage (`polish-assistant-conversations`)，抛光完成时自动保存，刷新/重启不丢失
- **多对话隔离**: 切换/新建对话时自动调用 `POST /api/clear` 清空后端历史，避免跨对话上下文污染
- **单服务部署**: 后端 FastAPI 直接 serve `frontend/dist` 构建产物，生产环境只需运行 `api_server.py` 一个服务；前端改动后需 `npm run build` 重新生成 dist
- **中国股市色约定**: 涨红跌绿（当前项目不涉及，但全局约定存在）

---

## 7. 风格常量

```typescript
// frontend/src/types/index.ts
const STYLE_CONFIG = {
  academic:  { label: '学术严谨', icon: '🎓', color: 'bg-blue-100...' },
  business:  { label: '商务正式', icon: '💼', color: 'bg-indigo-100...' },
  media:     { label: '自媒体活泼', icon: '📱', color: 'bg-orange-100...' },
  concise:   { label: '简洁凝练', icon: '✨', color: 'bg-green-100...' },
  custom:    { label: '自定义风格', icon: '🎨', color: 'bg-purple-100...' },
};
```

---

*最后更新: 2026-06-23 · v3.0 六大工具系统 · 角色定制 · 智能分析 · Word/PDF导出 · 格式标准化 · 金句库*
