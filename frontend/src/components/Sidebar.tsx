import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  PanelLeftClose,
  Search,
  SquarePen,
  Trash2,
  MessageSquare,
  Settings,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Plus,
} from 'lucide-react';
import type { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  isCollapsed: boolean;
  isPolishing: boolean;
  isConnected: boolean;
  onToggleCollapse: () => void;
  onNewConversation: () => void;
  onSwitchConversation: (id: string) => void;
  onClearConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onSearch: (query: string) => Conversation[];
  onOpenCorpus: () => void;
  onOpenApiConfig: () => void;
}

/** 格式化时间戳为简短日期 */
function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 截取对话内容预览 */
function getPreview(messages: Conversation['messages']): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return '暂无消息';
  return lastUser.content.slice(0, 50) + (lastUser.content.length > 50 ? '…' : '');
}

export default function Sidebar({
  conversations,
  activeId,
  isCollapsed,
  isPolishing,
  isConnected,
  onToggleCollapse,
  onNewConversation,
  onSwitchConversation,
  onClearConversation,
  onDeleteConversation,
  onSearch,
  onOpenCorpus,
  onOpenApiConfig,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 搜索过滤（仅在使用搜索时过滤，否则显示全部）
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return onSearch(searchQuery);
  }, [searchQuery, conversations, onSearch]);

  // 判断活跃对话是否为空（即"新建对话"状态）
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId],
  );
  const isNewConversation = !activeId || (activeConv && activeConv.messages.length === 0);

  // 点击外部关闭删除确认
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (confirmDeleteId && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [confirmDeleteId]);

  const handleNewConversation = () => {
    if (isPolishing) return;
    setSearchQuery('');
    onNewConversation();
  };

  const handleSwitch = (id: string) => {
    if (isPolishing) return;
    onSwitchConversation(id);
  };

  const handleClear = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isPolishing) return;
    onClearConversation(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDeleteConversation(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      searchInputRef.current?.blur();
    }
  };

  return (
    <div
      ref={sidebarRef}
      className={`flex-shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden ${
        isCollapsed ? 'w-0' : 'w-72'
      }`}
    >
      <div
        className={`w-72 h-full bg-gray-50/80 border-r-2 border-gray-300 flex flex-col
          transition-opacity duration-200
          ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        {/* ====== 侧边栏顶部：Logo + 应用名称 ====== */}
        <div className="flex-shrink-0 px-3 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight whitespace-nowrap">
                AI 文章润色助手
              </h1>
            </div>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-colors flex-shrink-0"
              title="收起侧边栏"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ====== 搜索框 ====== */}
        <div className="flex-shrink-0 px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索对话内容…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg
                         text-gray-700 placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400
                         transition-all"
            />
          </div>
        </div>

        {/* ====== 对话列表标题 ====== */}
        <div className="flex-shrink-0 px-3 pb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            历史对话
          </h2>
        </div>

        {/* ====== 对话列表 ====== */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 chat-scroll">
          {/* 新建对话 — 固定首项 */}
          <div
            onClick={handleNewConversation}
            className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer
              transition-all duration-150 select-none
              ${
                isNewConversation
                  ? 'bg-white shadow-sm border border-gray-200/80'
                  : 'hover:bg-white/60 border border-transparent'
              }
              ${isPolishing ? 'pointer-events-none opacity-60' : ''}
            `}
          >
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${
                isNewConversation
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200/80'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
            </div>
            <span
              className={`text-xs font-medium ${
                isNewConversation ? 'text-primary-700' : 'text-gray-700'
              }`}
            >
              新建对话
            </span>
          </div>

          {/* 无对话提示 */}
          {filteredConversations.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-gray-400">
                {searchQuery.trim() ? '未找到匹配的对话' : '暂无历史对话'}
              </p>
            </div>
          )}

          {/* 对话列表 */}
          {filteredConversations.map((conv) => {
            const isActive = conv.id === activeId;
            const preview = getPreview(conv.messages);
            const isEmpty = conv.messages.length === 0;

            // 空对话合并到"新建对话"项，列表不重复显示
            if (isEmpty) return null;

            return (
              <div
                key={conv.id}
                onClick={() => handleSwitch(conv.id)}
                className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer
                  transition-all duration-150 select-none
                  ${
                    isActive
                      ? 'bg-white shadow-sm border border-gray-200/80'
                      : 'hover:bg-white/60 border border-transparent'
                  }
                  ${isPolishing ? 'pointer-events-none opacity-60' : ''}
                `}
              >
                {/* 对话图标 */}
                <MessageSquare
                  className={`flex-shrink-0 w-3.5 h-3.5 mt-0.5 ${
                    isActive ? 'text-primary-500' : 'text-gray-400'
                  }`}
                />

                {/* 对话信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3
                      className={`text-xs font-medium truncate ${
                        isActive ? 'text-gray-900' : 'text-gray-700'
                      }`}
                    >
                      {conv.title}
                    </h3>
                    <span className="flex-shrink-0 text-[10px] text-gray-400 ml-2">
                      {formatDate(conv.updatedAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-relaxed">
                    {preview}
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">
                    {conv.messages.length} 条消息
                  </p>
                </div>

                {/* 操作按钮组 — hover 时显示 */}
                <div
                  className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5
                    transition-opacity duration-150
                    ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                  `}
                >
                  {/* 清空按钮 */}
                  <button
                    type="button"
                    onClick={(e) => handleClear(e, conv.id)}
                    disabled={isPolishing || conv.messages.length === 0}
                    className="p-1 rounded text-gray-500 hover:text-orange-500 hover:bg-orange-50
                               disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="清空此对话"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  {/* 删除按钮 */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, conv.id)}
                    disabled={isPolishing}
                    className={`p-1 rounded transition-colors ${
                      confirmDeleteId === conv.id
                        ? 'text-red-500 bg-red-50'
                        : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                    }`}
                    title={confirmDeleteId === conv.id ? '确认删除' : '删除对话'}
                  >
                    <span className="text-[10px] font-medium w-3 h-3 flex items-center justify-center">
                      {confirmDeleteId === conv.id ? '!' : '×'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ====== 底部：设置按钮 + 连接状态（各自独立） ====== */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            {/* 设置按钮 — 打开语料库管理 */}
            <button
              type="button"
              onClick={onOpenCorpus}
              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500
                         hover:text-gray-700 hover:bg-gray-200/60 rounded-lg
                         transition-colors"
              title="语料库管理"
            >
              <Settings className="w-3.5 h-3.5" />
              设置
            </button>

            {/* 连接状态指示器 — 打开 API 连接 */}
            <button
              type="button"
              onClick={onOpenApiConfig}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                isConnected
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}
              title={isConnected ? 'API 已连接 — 点击修改设置' : 'API 未连接 — 点击配置'}
            >
              {isConnected ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              <span>{isConnected ? '已连接' : '未连接'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
