import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  GitCompare,
  Loader2,
  Sparkles,
  MessageSquare,
  User,
  Bot,
  Clock,
  Link2,
  Link2Off,
  BookOpen,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { PolishStyle, PolishResult, KbReference, ChatMessage } from '../types';
import { STYLE_CONFIG } from '../types';

interface ResultPanelProps {
  originalText: string;
  polishedText: string;
  style: PolishStyle;
  result: PolishResult | null;
  isPolishing: boolean;
  isConnected: boolean;
  progress: string;
  error: string | null;
  history: ChatMessage[];
  activeTab: TabId;
  onActiveTabChange: (tab: TabId) => void;
  onContinuePolish?: (instruction: string) => void;
  onStop?: () => void;
  onReset?: () => void;
}

type TabId = 'chat' | 'comparison' | 'references';

/** 格式化时间戳 */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** 聊天气泡组件 */
function ChatBubble({
  msg,
  isLast,
  isConnected,
  onViewReferences,
}: {
  msg: ChatMessage;
  isLast: boolean;
  isConnected: boolean;
  onViewReferences?: () => void;
}) {
  const isUser = msg.role === 'user';
  const styleCfg = msg.style ? STYLE_CONFIG[msg.style] : null;
  // 按来源去重计数（与引用来源 Tab 保持一致）
  const kbSourceCount = msg.result?.kb_refs
    ? new Set(msg.result.kb_refs.map((r) => r.source)).size
    : 0;

  return (
    <div className={`flex gap-5 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`}>
      {/* 头像 */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
          isUser
            ? 'bg-primary-100 text-primary-600'
            : 'bg-gradient-to-br from-purple-100 to-blue-100 text-purple-600'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* 气泡内容 */}
      <div className={`flex-1 min-w-0 ${isUser ? 'flex flex-col items-end' : ''}`}>
        {/* 标签行 */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs font-medium text-gray-500">
            {isUser ? '我' : 'AI助手'}
          </span>
          {styleCfg && isUser && (
            <span className={`badge text-[10px] ${styleCfg.color}`}>
              {styleCfg.icon} {styleCfg.label}
            </span>
          )}
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {formatTime(msg.timestamp)}
          </span>
        </div>

        {/* 气泡体 */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary-500 text-white rounded-tr-md max-w-[85%]'
              : 'bg-white border border-gray-100 shadow-sm rounded-tl-md max-w-[85%]'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content.slice(0, 500)}</div>
          ) : msg.id === 'streaming' || msg.id === 'progress-status' || msg.id === 'progress' ? (
            <div className="whitespace-pre-wrap text-gray-800">{msg.content}</div>
          ) : (
            <div className={`prose prose-sm max-w-none text-gray-800 ${isLast ? 'streaming-cursor' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children }) => (
                    <pre className="bg-gray-800 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs my-2">
                      {children}
                    </pre>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-gray-100 text-rose-600 px-1.5 py-0.5 rounded text-xs font-mono">
                        {children}
                      </code>
                    ) : (
                      <code className={className}>{children}</code>
                    );
                  },
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full border-collapse border border-gray-200 text-xs">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-gray-200 px-3 py-1.5 bg-gray-50 font-semibold text-left">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-gray-200 px-3 py-1.5">{children}</td>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 my-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 my-1">{children}</ol>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-primary-600 underline hover:text-primary-800"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary-300 pl-3 my-2 text-gray-600 italic">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* KB 引用提示 */}
        {!isUser && kbSourceCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <button
              onClick={onViewReferences}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-primary-600 bg-primary-50 border border-primary-100 hover:bg-primary-100 hover:border-primary-200 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3 h-3" />
              参考了 {kbSourceCount} 份知识库资料
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResultPanel({
  originalText,
  polishedText,
  style,
  result,
  isPolishing,
  isConnected,
  progress,
  error,
  history,
  activeTab,
  onActiveTabChange,
}: ResultPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [syncScroll, setSyncScroll] = useState(true);
  const syncingRef = useRef(false);
  const [expandedRefs, setExpandedRefs] = useState<Set<number>>(new Set());

  // 收集所有消息中的知识库引用
  const allKbRefs: KbReference[] = [];
  const seenSources = new Set<string>();
  for (const msg of history) {
    if (msg.result?.kb_refs) {
      for (const ref of msg.result.kb_refs) {
        if (ref.source && !seenSources.has(ref.source)) {
          seenSources.add(ref.source);
          allKbRefs.push(ref);
        }
      }
    }
  }
  // 也包含当前 result 的引用
  if (result?.kb_refs) {
    for (const ref of result.kb_refs) {
      if (ref.source && !seenSources.has(ref.source)) {
        seenSources.add(ref.source);
        allKbRefs.push(ref);
      }
    }
  }
  const hasKbRefs = allKbRefs.length > 0;

  /** 切换到引用来源 Tab */
  const switchToReferences = useCallback(() => {
    onActiveTabChange('references');
  }, [onActiveTabChange]);

  /** 切换引用卡片展开/折叠 */
  const toggleRefExpand = useCallback((idx: number) => {
    setExpandedRefs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // 自动滚动到底部（仅在对话模式且内容变化时）
  useEffect(() => {
    if (activeTab === 'chat' && (history.length > 0 || polishedText)) {
      chatEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    }
  }, [history.length, polishedText.length, activeTab]);

  // 同步滚动处理
  const handleLeftScroll = useCallback(() => {
    if (!syncScroll || syncingRef.current || !leftRef.current || !rightRef.current) return;
    syncingRef.current = true;
    rightRef.current.scrollTop = leftRef.current.scrollTop;
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [syncScroll]);

  const handleRightScroll = useCallback(() => {
    if (!syncScroll || syncingRef.current || !leftRef.current || !rightRef.current) return;
    syncingRef.current = true;
    leftRef.current.scrollTop = rightRef.current.scrollTop;
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [syncScroll]);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: '对话', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'comparison', label: '对比', icon: <GitCompare className="w-3.5 h-3.5" /> },
    { id: 'references' as TabId, label: hasKbRefs ? `引用来源 (${allKbRefs.length})` : '引用来源', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  const styleCfg = STYLE_CONFIG[style];

  // 空状态 - 聊天风格欢迎页
  if (!polishedText && !isPolishing && !error && history.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary-100 to-purple-100 flex items-center justify-center shadow-sm">
            <Sparkles className="w-10 h-10 text-primary-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">AI 文章润色助手</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            基于大模型的智能文章润色工具。在下方输入框粘贴文章内容，选择润色风格，即可开始优化您的文字。
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {(['academic', 'business', 'media', 'concise'] as const).map((s) => {
              const cfg = STYLE_CONFIG[s];
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-500 shadow-sm"
                >
                  <span>{cfg.icon}</span>
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab 导航 - 有结果时显示 */}
      {(history.length > 0 || polishedText) && (
        <div className="flex-shrink-0 flex items-center gap-0.5 px-4 py-2 bg-white/80 backdrop-blur-sm border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onActiveTabChange(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-50 text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 进度条 — 仅在无历史对话时（首次润色刚开始）独立显示；有历史时由聊天区内的 progress-status 气泡展示 */}
      {isPolishing && !polishedText && history.length === 0 && (
        <div className="px-8 py-6">
          <ChatBubble
            msg={{
              id: 'progress',
              role: 'assistant',
              content: `🔄 ${progress || '正在处理...'}`,
              timestamp: Date.now(),
            }}
            isLast={true}
            isConnected={isConnected}
            onViewReferences={switchToReferences}
          />
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="flex-shrink-0 mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tab 内容区 - 可滚动 */}
      <div className="flex-1 overflow-y-auto">
        {/* 对话气泡 Tab */}
        {activeTab === 'chat' && (
          <div className="px-8 py-6 space-y-8 pb-40">
            {history.length === 0 && polishedText && (
              <ChatBubble
                msg={{
                  id: 'draft',
                  role: 'assistant',
                  content: polishedText,
                  result: result || undefined,
                  timestamp: Date.now(),
                }}
                isLast={!isPolishing}
                isConnected={isConnected}
                onViewReferences={switchToReferences}
              />
            )}
            {history.map((msg, idx) => (
              <ChatBubble
                key={msg.id}
                msg={msg}
                isLast={idx === history.length - 1 && isPolishing}
                isConnected={isConnected}
                onViewReferences={switchToReferences}
              />
            ))}
            {/* 流式响应气泡：润色中时实时显示当前token */}
            {isPolishing && polishedText && history.length > 0 && (
              <ChatBubble
                msg={{
                  id: 'streaming',
                  role: 'assistant',
                  content: polishedText,
                  result: result || undefined,
                  timestamp: Date.now(),
                }}
                isLast={true}
                isConnected={isConnected}
                onViewReferences={switchToReferences}
              />
            )}
            {isPolishing && !polishedText && history.length > 0 && (
              <ChatBubble
                msg={{
                  id: 'progress-status',
                  role: 'assistant',
                  content: `🔄 ${progress || '正在连接...'}`,
                  timestamp: Date.now(),
                }}
                isLast={true}
                isConnected={isConnected}
                onViewReferences={switchToReferences}
              />
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* 对比视图 Tab */}
        {activeTab === 'comparison' && (
          <div className="p-4 h-full flex flex-col min-h-0">
            {/* 同步滚动开关 — 右上角 */}
            <div className="flex items-center justify-end mb-3 flex-shrink-0">
              <button
                onClick={() => setSyncScroll((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                  syncScroll
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'bg-gray-50 text-gray-400 border border-gray-200'
                }`}
                title={syncScroll ? '已开启同步滚动，点击取消' : '已取消同步滚动，点击开启'}
              >
                {syncScroll ? (
                  <Link2 className="w-3 h-3" />
                ) : (
                  <Link2Off className="w-3 h-3" />
                )}
                {syncScroll ? '同步滚动中' : '独立滚动'}
              </button>
            </div>
            {/* 对比内容区 — 每列包含自己的标题 */}
            <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
              <div className="flex flex-col min-h-0">
                <h4 className="text-xs font-semibold text-orange-600 mb-2 flex items-center gap-1 flex-shrink-0">
                  原文
                </h4>
                <div
                  ref={leftRef}
                  onScroll={handleLeftScroll}
                  className="bg-orange-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed overflow-y-auto flex-1"
                >
                  {originalText || '无原文'}
                </div>
              </div>
              <div className="flex flex-col min-h-0">
                <h4 className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1 flex-shrink-0">
                  润色后
                </h4>
                <div
                  ref={rightRef}
                  onScroll={handleRightScroll}
                  className="bg-green-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed overflow-y-auto flex-1"
                >
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result?.polished_text || polishedText}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 引用来源 Tab */}
        {activeTab === 'references' && (
          <div className="p-4 space-y-3 pb-20">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-primary-500" />
              <h3 className="text-sm font-semibold text-gray-700">知识库引用来源</h3>
              <span className="text-xs text-gray-400">共 {allKbRefs.length} 份参考资料</span>
            </div>
            {allKbRefs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <BookOpen className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">当前对话暂无知识库引用</p>
                <p className="text-xs mt-1">完成一次润色后，这里将展示检索到的参考资料</p>
              </div>
            ) : (
              allKbRefs.map((ref, idx) => {
              const isExpanded = expandedRefs.has(idx);
              // 从完整路径中提取文件名
              const fileName = ref.source.split(/[/\\]/).pop() || ref.source;
              const scorePercent = Math.round(ref.score * 100);
              return (
                <div
                  key={idx}
                  className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* 卡片头部：文件名 + 相关度 */}
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => toggleRefExpand(idx)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                          #{idx + 1}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-800 truncate">{fileName}</h4>
                      </div>
                      {/* 相关度进度条 */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-32">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${scorePercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">相关度 {scorePercent}%</span>
                      </div>
                    </div>
                    <span className="text-gray-400 flex-shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </span>
                  </div>
                  {/* 展开的文本片段内容 */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-1.5">检索到的文本片段：</div>
                      <div className="bg-gray-50 border-l-4 border-primary-300 rounded-r-lg p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {ref.content || '（无内容片段）'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
