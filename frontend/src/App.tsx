import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatInputBar from './components/ChatInputBar';
import ResultPanel from './components/ResultPanel';
import CorpusModal from './components/CorpusModal';
import ApiConfigModal from './components/ApiConfigModal';
import AnalysisPanel from './components/AnalysisPanel';
import { usePolish } from './hooks/usePolish';
import { useApiConfig } from './hooks/useApiConfig';
import { useConversations } from './hooks/useConversations';
import { exportResult, clearHistory } from './services/api';
import type { PolishStyle, PolishMode, PolishAction, PolishIntensity, ToneShiftType, PolishRole, ChatMessage } from './types';

export default function App() {
  // 输入状态
  const [text, setText] = useState('');
  const [style, setStyle] = useState<PolishStyle>('academic');
  const [mode, setMode] = useState<PolishMode>('full');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [useKb, setUseKb] = useState(true);
  const [customInstructions, setCustomInstructions] = useState('');
  // 新增：工具选择、强度、目标字数、话术转换类型
  const [action, setAction] = useState<PolishAction>('polish');
  const [intensity, setIntensity] = useState<PolishIntensity>('medium');
  const [targetWords, setTargetWords] = useState(0);
  const [shiftType, setShiftType] = useState<ToneShiftType>('gentle');
  const [role, setRole] = useState<PolishRole>('editor');

  // 存储完整原始文本（用于对比视图，避免因 displayText 截断）
  const [fullArticleText, setFullArticleText] = useState('');

  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 结果面板 Tab 状态（用于控制输入框显隐）
  const [activeTab, setActiveTab] = useState<'chat' | 'comparison' | 'references'>('chat');

  // API 配置
  const apiCfg = useApiConfig();

  // 语料库管理弹窗（独立于 API 设置弹窗）
  const [showCorpus, setShowCorpus] = useState(false);

  // 文本分析面板
  const [showAnalysis, setShowAnalysis] = useState(false);

  // 多对话管理
  const {
    conversations,
    activeId,
    createConversation,
    deleteConversation,
    clearConversation,
    switchConversation,
    updateConversation,
    searchConversations,
  } = useConversations();

  // 润色逻辑
  const polish = usePolish();

  // 追踪抛光完成以保存对话
  const wasPolishingRef = useRef(false);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const fullArticleTextRef = useRef(fullArticleText);
  fullArticleTextRef.current = fullArticleText;

  // 保存对话到 localStorage（含原文，用于刷新后恢复对比视图）
  const saveConversationMessages = useCallback(
    (history: ChatMessage[]) => {
      const id = activeIdRef.current;
      if (!id || history.length === 0) return;
      const firstUser = history.find((m) => m.role === 'user');
      const title = firstUser ? firstUser.content.slice(0, 30) : '新对话';
      updateConversation(id, (conv) => ({
        ...conv,
        messages: history,
        title,
        originalText: fullArticleTextRef.current || undefined,
      }));
    },
    [updateConversation],
  );

  // 监听抛光完成 → 自动保存对话
  useEffect(() => {
    if (wasPolishingRef.current && !polish.isPolishing && activeId) {
      saveConversationMessages(polish.history);
    }
    wasPolishingRef.current = polish.isPolishing;
  }, [polish.isPolishing, activeId, polish.history, saveConversationMessages]);

  // 初始加载：恢复上次活跃对话（含原文，用于刷新后对比视图显示原文）
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    if (activeId) {
      const conv = conversations.find((c) => c.id === activeId);
      if (conv && conv.messages.length > 0) {
        polish.loadHistory(conv.messages);
        if (conv.originalText) {
          setFullArticleText(conv.originalText);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 删除对话后重新加载
  const prevCountRef = useRef(conversations.length);
  useEffect(() => {
    if (conversations.length < prevCountRef.current) {
      // 有对话被删除
      if (activeId) {
        const conv = conversations.find((c) => c.id === activeId);
        polish.loadHistory(conv?.messages || []);
        setFullArticleText(conv?.originalText || '');
      } else {
        polish.loadHistory([]);
        setFullArticleText('');
      }
      setText('');
      setCustomInstructions('');
    }
    prevCountRef.current = conversations.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length, activeId]);

  // ====== 计算当前对话标题（用于 Header 居中显示） ======
  const conversationTitle = useMemo(() => {
    const conv = conversations.find((c) => c.id === activeId);
    if (!conv || conv.messages.length === 0) return '新建对话';
    return conv.title;
  }, [conversations, activeId]);

  // ====== 对话操作 ======

  const handleNewConversation = useCallback(() => {
    // 当前对话已是空对话时，不再重复创建
    const currentConv = conversations.find((c) => c.id === activeId);
    if (currentConv && currentConv.messages.length === 0 && polish.history.length === 0) {
      return;
    }
    createConversation();
    polish.loadHistory([]);
    setText('');
    setCustomInstructions('');
    setFullArticleText('');
    setActiveTab('chat');
    clearHistory(); // 清空后端历史
  }, [createConversation, polish, conversations, activeId]);

  const handleSwitchConversation = useCallback(
    (id: string) => {
      if (polish.isPolishing) return;
      // 保存当前对话
      if (activeId && polish.history.length > 0) {
        saveConversationMessages(polish.history);
      }
      // 切换并清空后端历史
      switchConversation(id);
      const conv = conversations.find((c) => c.id === id);
      polish.loadHistory(conv?.messages || []);
      setText('');
      setCustomInstructions('');
      setFullArticleText(conv?.originalText || '');
      setActiveTab('chat');
      clearHistory();
    },
    [polish, activeId, conversations, switchConversation, saveConversationMessages],
  );

  const handleClearConversation = useCallback(
    (id: string) => {
      clearConversation(id);
      if (id === activeId) {
        polish.loadHistory([]);
        setText('');
        setCustomInstructions('');
        setActiveTab('chat');
      }
    },
    [clearConversation, activeId, polish],
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      deleteConversation(id);
    },
    [deleteConversation],
  );

  // ====== 润色操作 ======

  const handleStartPolish = useCallback(
    async (fileContent?: string, fileName?: string) => {
      const articleText = fileContent || text.trim();
      const instructions = fileContent
        ? (text.trim() || customInstructions)
        : customInstructions;
      // 文件模式：显示文件名+用户提示词两个气泡
      const fileDisplay = fileContent && fileName ? `📎 ${fileName}` : undefined;
      const userPrompt = fileContent ? (text.trim() || undefined) : undefined;

      if (!articleText || articleText.length < 10) {
        alert('请输入至少10个字符的文章内容');
        return;
      }
      if (!apiCfg.isConnected) {
        alert('请先在设置中配置并测试 API 连接');
        return;
      }

      // 自动创建对话（如果没有活跃对话）
      if (!activeIdRef.current) {
        createConversation();
      }

      // 首次润色前清空后端历史（避免上一轮对话残留）
      await clearHistory();

      // 保存完整原文（用于对比视图）
      setFullArticleText(articleText);

      polish.polish({
        text: articleText,
        displayText: fileDisplay,
        userPromptText: userPrompt,
        style,
        mode,
        temperature,
        maxTokens,
        useKb,
        customInstructions: style === 'custom' || fileContent ? instructions : '',
        action,
        intensity,
        targetWords,
        shiftType,
        selectedText: '',
        role,
      });
      setText('');
      setCustomInstructions('');
    },
    [text, style, mode, temperature, maxTokens, useKb, customInstructions, apiCfg.isConnected, polish, createConversation],
  );

  const handleContinueP = useCallback(
    (instruction: string) => {
      polish.continuePolish(instruction, temperature);
    },
    [polish, temperature],
  );

  const handleSendMessage = useCallback(
    (fileContent?: string, fileName?: string) => {
      if (!text.trim() && !fileContent) return;
      if (polish.isPolishing) return;

      if (polish.history.length > 0) {
        handleContinueP(text.trim());
        setText('');
      } else {
        handleStartPolish(fileContent, fileName);
      }
    },
    [text, polish.isPolishing, polish.history.length, handleStartPolish, handleContinueP],
  );

  const handleReset = useCallback(() => {
    polish.reset();
    setText('');
    setCustomInstructions('');
    setFullArticleText('');
  }, [polish]);

  // 从对话历史中取原文（优先使用完整存储的原文用于对比视图）
  const originalArticle = fullArticleText ||
    (polish.history.length > 0
      ? polish.history.find((m) => m.role === 'user')?.content || ''
      : text);

  const handleExport = useCallback(
    (format: string) => {
      exportResult(
        fullArticleText || originalArticle,
        polish.result?.polished_text || polish.polishedText,
        style,
        format,
      );
    },
    [fullArticleText, originalArticle, polish.result, polish.polishedText, style],
  );

  // ====== 分享操作 ======
  const handleShare = useCallback(async () => {
    const lines: string[] = [];
    lines.push(`【${conversationTitle}】\n`);
    for (const msg of polish.history) {
      const role = msg.role === 'user' ? '我' : 'AI 润色助手';
      lines.push(`--- ${role} ---`);
      lines.push(msg.content);
      lines.push('');
    }
    const shareText = lines.join('\n');
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // 降级方案：创建临时文本域
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, [polish.history, conversationTitle]);

  const hasContent = polish.history.length > 0 || !!polish.polishedText || polish.isPolishing;

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isCollapsed={sidebarCollapsed}
        isPolishing={polish.isPolishing}
        isConnected={apiCfg.isConnected}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onNewConversation={handleNewConversation}
        onSwitchConversation={handleSwitchConversation}
        onClearConversation={handleClearConversation}
        onDeleteConversation={handleDeleteConversation}
        onSearch={searchConversations}
        onOpenCorpus={() => setShowCorpus(true)}
        onOpenApiConfig={() => apiCfg.setShowModal(true)}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          title={conversationTitle}
          hasContent={hasContent}
          onExport={handleExport}
          onShare={handleShare}
          isSidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(false)}
          onAnalyze={() => setShowAnalysis(true)}
        />

        {/* 语料库管理弹窗（独立） */}
        <CorpusModal
          open={showCorpus}
          onClose={() => setShowCorpus(false)}
        />

        {/* API 连接弹窗（独立） */}
        <ApiConfigModal
          open={apiCfg.showModal}
          onClose={() => apiCfg.setShowModal(false)}
          modelType={apiCfg.modelType}
          onModelTypeChange={apiCfg.setModelType}
          apiKey={apiCfg.apiKey}
          onApiKeyChange={apiCfg.setApiKey}
          baseUrl={apiCfg.baseUrl}
          onBaseUrlChange={apiCfg.setBaseUrl}
          isConnected={apiCfg.isConnected}
          isTesting={apiCfg.isTesting}
          statusMsg={apiCfg.statusMsg}
          onTest={apiCfg.handleTest}
        />

        {/* 文本智能分析面板 */}
        <AnalysisPanel
          text={fullArticleText || text || polish.history.find(m => m.role === 'assistant')?.content || ''}
          open={showAnalysis}
          onClose={() => setShowAnalysis(false)}
        />

        {/* 消息区域 + 悬浮输入栏 */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <ResultPanel
            originalText={originalArticle}
            polishedText={polish.polishedText}
            style={style}
            result={polish.result}
            isPolishing={polish.isPolishing}
            isConnected={apiCfg.isConnected}
            progress={polish.progress}
            error={polish.error}
            history={polish.history}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            onContinuePolish={handleContinueP}
            onStop={polish.stop}
            onReset={handleReset}
          />

          {/* 悬浮输入栏 — 不再有动画（避免页面弹跳） */}
          <div
            className={`absolute bottom-0 left-0 right-0 px-4 pb-4 ${
              activeTab === 'chat'
                ? 'translate-y-0 opacity-100'
                : 'translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            <ChatInputBar
              text={text}
              onTextChange={setText}
              style={style}
              onStyleChange={setStyle}
              mode={mode}
              onModeChange={setMode}
              action={action}
              onActionChange={setAction}
              intensity={intensity}
              onIntensityChange={setIntensity}
              targetWords={targetWords}
              onTargetWordsChange={setTargetWords}
              shiftType={shiftType}
              onShiftTypeChange={setShiftType}
              role={role}
              onRoleChange={setRole}
              temperature={temperature}
              maxTokens={maxTokens}
              useKb={useKb}
              onTemperatureChange={setTemperature}
              onMaxTokensChange={setMaxTokens}
              onUseKbChange={setUseKb}
              customInstructions={customInstructions}
              onCustomInstructionsChange={setCustomInstructions}
              isPolishing={polish.isPolishing}
              hasHistory={polish.history.length > 0}
              onSend={handleSendMessage}
              onStop={polish.stop}
              onStartPolish={handleStartPolish}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
