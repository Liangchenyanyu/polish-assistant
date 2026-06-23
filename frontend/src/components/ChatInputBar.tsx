import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  FileText,
  StopCircle,
  ChevronDown,
  ArrowUp,
  Settings2,
  Wand2,
} from 'lucide-react';
import { uploadFile } from '../services/api';
import { STYLE_CONFIG, ACTION_CONFIG, INTENSITY_CONFIG, TONE_SHIFT_CONFIG, ROLE_CONFIG } from '../types';
import type { PolishStyle, PolishMode, PolishAction, PolishIntensity, ToneShiftType, PolishRole } from '../types';
import Popover from './Popover';

interface ChatInputBarProps {
  text: string;
  onTextChange: (v: string) => void;
  style: PolishStyle;
  onStyleChange: (v: PolishStyle) => void;
  mode: PolishMode;
  onModeChange: (v: PolishMode) => void;
  action: PolishAction;
  onActionChange: (v: PolishAction) => void;
  intensity: PolishIntensity;
  onIntensityChange: (v: PolishIntensity) => void;
  targetWords: number;
  onTargetWordsChange: (v: number) => void;
  shiftType: ToneShiftType;
  onShiftTypeChange: (v: ToneShiftType) => void;
  role: PolishRole;
  onRoleChange: (v: PolishRole) => void;
  temperature: number;
  maxTokens: number;
  useKb: boolean;
  onTemperatureChange: (v: number) => void;
  onMaxTokensChange: (v: number) => void;
  onUseKbChange: (v: boolean) => void;
  customInstructions: string;
  onCustomInstructionsChange: (v: string) => void;
  isPolishing: boolean;
  hasHistory: boolean;
  onSend: (fileContent?: string, fileName?: string) => void;
  onStop: () => void;
  onStartPolish: () => void;
}

const STYLES: PolishStyle[] = ['academic', 'business', 'media', 'concise'];
const ACTIONS: PolishAction[] = ['polish', 'paraphrase', 'deai', 'simplify', 'continue', 'tone_shift'];

interface FileInfo {
  name: string;
  size: number;
  type: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

interface QuickAction {
  label: string;
  prompt: string;
}

export default function ChatInputBar({
  text,
  onTextChange,
  style,
  onStyleChange,
  mode,
  onModeChange,
  action,
  onActionChange,
  intensity,
  onIntensityChange,
  targetWords,
  onTargetWordsChange,
  shiftType,
  onShiftTypeChange,
  role,
  onRoleChange,
  temperature,
  maxTokens,
  useKb,
  onTemperatureChange,
  onMaxTokensChange,
  onUseKbChange,
  customInstructions,
  onCustomInstructionsChange,
  isPolishing,
  hasHistory,
  onSend,
  onStop,
  onStartPolish,
}: ChatInputBarProps) {
  // ---------- 文件上传 ----------
  const [uploading, setUploading] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- 弹窗控制 ----------
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showShiftMenu, setShowShiftMenu] = useState(false);

  // ---------- refs ----------
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const styleBtnRef = useRef<HTMLButtonElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const actionBtnRef = useRef<HTMLButtonElement>(null);
  const shiftBtnRef = useRef<HTMLButtonElement>(null);

  const styleCfg = STYLE_CONFIG[style];
  const actionCfg = ACTION_CONFIG[action];
  const intensityCfg = INTENSITY_CONFIG[intensity];

  // 自动调整 textarea 高度
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [text]);

  // ---------- 文件上传 ----------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await uploadFile(file);
      if (res.content) {
        setFileContent(res.content);
        setFileInfo({
          name: file.name,
          size: file.size,
          type: file.name.split('.').pop() || '',
        });
      } else {
        alert('文件读取失败');
      }
    } catch {
      alert('文件上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearFile = () => {
    setFileInfo(null);
    setFileContent(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---------- 发送 ----------
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isPolishing && text.trim()) {
        doSend();
      }
    }
  };

  const doSend = () => {
    if (!canSend) return;
    const fc = fileContent ?? undefined;
    const fn = fileInfo?.name;
    onSend(fc, fn);
    // 发送后清除文件
    setFileInfo(null);
    setFileContent(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = () => {
    doSend();
  };

  const handleQuickAction = (qa: QuickAction) => {
    onTextChange(qa.prompt);
    setTimeout(() => doSend(), 0);
  };

  const canSend = !isPolishing && text.trim().length > 0;

  const quickActions: QuickAction[] = fileContent
    ? [
        {
          label: '✨ 帮我润色',
          prompt: '请帮我润色优化这篇文章，提升表达质量，保持原意不变。',
        },
        {
          label: '🔍 检查语法',
          prompt: '请逐一指出文中的语法错误、用词不当和标点问题，并给出修改建议。',
        },
        {
          label: '📝 梳理逻辑',
          prompt: '请梳理这篇文章的逻辑结构，指出段落衔接和论证逻辑上的问题并优化。',
        },
      ]
    : [];

  // ==================== 润色中状态 ====================
  if (isPolishing) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex-1 flex items-center gap-2 text-gray-500 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
              正在生成中...
            </div>
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
            >
              <StopCircle className="w-4 h-4" />
              停止
            </button>
          </div>
        </div>
    );
  }

  // ==================== 正常状态 ====================
  return (
    <>
      {/* 工具选择弹窗 (Portal) */}
      <Popover
        open={showActionMenu}
        onClose={() => setShowActionMenu(false)}
        triggerRef={actionBtnRef}
        align="left"
        className="bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[200px]"
      >
        {ACTIONS.map((a) => {
          const cfg = ACTION_CONFIG[a];
          const isActive = a === action;
          return (
            <button
              key={a}
              type="button"
              onClick={() => {
                onActionChange(a);
                setShowActionMenu(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{cfg.icon}</span>
              <div className="text-left">
                <div className="text-xs font-medium">{cfg.label}</div>
                <div className="text-[10px] text-gray-400 leading-tight">{cfg.description}</div>
              </div>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600" />
              )}
            </button>
          );
        })}
      </Popover>

      {/* 话术转换子类型选择 (Portal) */}
      <Popover
        open={showShiftMenu}
        onClose={() => setShowShiftMenu(false)}
        triggerRef={shiftBtnRef}
        align="left"
        className="bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[180px]"
      >
        {(Object.keys(TONE_SHIFT_CONFIG) as ToneShiftType[]).map((st) => {
          const cfg = TONE_SHIFT_CONFIG[st];
          const isActive = st === shiftType;
          return (
            <button
              key={st}
              type="button"
              onClick={() => {
                onShiftTypeChange(st);
                setShowShiftMenu(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-rose-50 text-rose-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-left">
                <div className="text-xs font-medium">{cfg.label}</div>
                <div className="text-[10px] text-gray-400 leading-tight">{cfg.description}</div>
              </span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-rose-600" />
              )}
            </button>
          );
        })}
      </Popover>

      {/* 风格选择弹窗 (Portal) */}
      <Popover
        open={showStyleMenu}
        onClose={() => setShowStyleMenu(false)}
        triggerRef={styleBtnRef}
        align="left"
        className="bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[220px]"
      >
        {STYLES.map((s) => {
          const cfg = STYLE_CONFIG[s];
          const isActive = s === style;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                onStyleChange(s);
                setShowStyleMenu(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600" />
              )}
            </button>
          );
        })}
        {/* 自定义风格输入 */}
        <div className="border-t border-gray-100 mt-0.5 pt-1.5 px-3 pb-1.5">
          <label className="text-[11px] text-gray-400 mb-1 block">自定义风格说明</label>
          <textarea
            value={customInstructions}
            onChange={(e) => onCustomInstructionsChange(e.target.value)}
            placeholder="例：像鲁迅的风格、多用短句..."
            rows={2}
            className="w-full text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-300 focus:border-primary-300 resize-none"
          />
        </div>
      </Popover>

      {/* 更多设置弹窗 (Portal) */}
      <Popover
        open={showSettings}
        onClose={() => setShowSettings(false)}
        triggerRef={moreBtnRef}
        align="right"
        className="bg-white rounded-xl shadow-lg border border-gray-200 py-3 w-80"
      >
        <div className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          高级设置
        </div>

        {/* 润色强度 (仅 polish 操作显示) */}
        {action === 'polish' && (
          <div className="px-3 py-2 border-b border-gray-50">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-600">润色强度</label>
              <span className="text-xs font-medium text-primary-600">{intensityCfg.label}</span>
            </div>
            <div className="flex gap-1">
              {(Object.keys(INTENSITY_CONFIG) as PolishIntensity[]).map((lvl) => {
                const cfg = INTENSITY_CONFIG[lvl];
                const isActive = lvl === intensity;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onIntensityChange(lvl)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{intensityCfg.description}</p>
          </div>
        )}

        {/* 目标字数 (polish/paraphrase/simplify/continue 操作显示) */}
        {['polish', 'paraphrase', 'simplify', 'continue'].includes(action) && (
          <div className="px-3 py-2 border-b border-gray-50">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-600">目标字数</label>
              <span className="text-xs font-mono text-primary-600 tabular-nums">
                {targetWords > 0 ? targetWords : '不限'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
              value={targetWords}
              onChange={(e) => onTargetWordsChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-gray-400">不限</span>
              <span className="text-[10px] text-gray-400">5000</span>
            </div>
          </div>
        )}

        {/* 润色模式 */}
        <div className="px-3 py-2 border-b border-gray-50">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-600">润色模式</label>
            <span className="text-xs font-medium text-primary-600">
              {mode === 'full' ? '全文' : '逐段'}
            </span>
          </div>
          <div className="flex gap-1">
            {(['full', 'paragraph'] as PolishMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                  m === mode
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {m === 'paragraph' ? '逐段润色' : '全文润色'}
              </button>
            ))}
          </div>
        </div>

        {/* 润色角色 */}
        <div className="px-3 py-2 border-b border-gray-50">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-600">润色角色</label>
            <span className="text-xs font-medium text-violet-600">{ROLE_CONFIG[role].icon} {ROLE_CONFIG[role].label}</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(ROLE_CONFIG) as PolishRole[]).map((r) => {
              const cfg = ROLE_CONFIG[r];
              const isActive = r === role;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRoleChange(r)}
                  className={`text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                    isActive
                      ? 'bg-violet-100 text-violet-700 font-medium'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <div>{cfg.icon} {cfg.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Temperature */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-600">Temperature</label>
            <span className="text-xs font-mono text-primary-600 tabular-nums">
              {temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.5"
            step="0.1"
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-gray-400">严谨</span>
            <span className="text-[10px] text-gray-400">创造</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-600">Max Tokens</label>
            <span className="text-xs font-mono text-primary-600 tabular-nums">{maxTokens}</span>
          </div>
          <input
            type="range"
            min="512"
            max="8192"
            step="512"
            value={maxTokens}
            onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-gray-400">512</span>
            <span className="text-[10px] text-gray-400">8192</span>
          </div>
        </div>

        {/* 知识库增强 */}
        <div className="px-3 py-2 flex items-center justify-between">
          <div>
            <label className="text-xs text-gray-600">知识库增强 (RAG)</label>
            <p className="text-[10px] text-gray-400 mt-0.5">检索写作规范提供参考建议</p>
          </div>
          <button
            type="button"
            onClick={() => onUseKbChange(!useKb)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
              useKb ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
              style={{ transform: useKb ? 'translateX(16px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      </Popover>

      {/* 主输入区 */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            {/* 文件卡片 */}
            {fileInfo && (
              <div className="px-5 pt-4 flex">
                <div className="inline-flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <div className="flex-shrink-0 w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-[18px] h-[18px] text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{fileInfo.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fileInfo.type} · {formatFileSize(fileInfo.size)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 快捷操作 */}
            {!hasHistory && quickActions.length > 0 && (
              <div className="px-5 pt-3 flex flex-wrap gap-1.5">
                {quickActions.map((qa, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickAction(qa)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50/80 text-xs text-gray-600 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-800 transition-colors whitespace-nowrap"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* 文本输入区 */}
            <div className="px-5 pt-3">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="发消息..."
                rows={1}
                disabled={isPolishing}
                className="w-full resize-none text-sm leading-relaxed text-gray-900 placeholder-gray-400 focus:outline-none"
                style={{ maxHeight: '200px', minHeight: '24px' }}
              />
            </div>

            {/* 分隔线 */}
            <div className="mx-5 my-2 border-t border-gray-100" />

            {/* 底部工具栏 */}
            <div className="px-3 pb-3 flex items-center justify-between gap-1">
              <div className="flex items-center gap-0.5 overflow-x-auto flex-1 scrollbar-hide">
                {/* 上传文件 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="上传文件"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <Upload className="w-[18px] h-[18px]" />
                </button>

                {/* 工具/操作选择 */}
                <button
                  ref={actionBtnRef}
                  type="button"
                  onClick={() => {
                    setShowActionMenu(!showActionMenu);
                    setShowStyleMenu(false);
                    setShowSettings(false);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap ${
                    showActionMenu
                      ? 'bg-gray-100 text-gray-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{actionCfg.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showActionMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* 话术转换子类型选择（仅 tone_shift 显示） */}
                {action === 'tone_shift' && (
                  <button
                    ref={shiftBtnRef}
                    type="button"
                    onClick={() => {
                      setShowShiftMenu(!showShiftMenu);
                      setShowStyleMenu(false);
                      setShowSettings(false);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap ${
                      showShiftMenu
                        ? 'bg-rose-100 text-rose-700'
                        : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    <span className="text-[10px]">🎭</span>
                    <span>{TONE_SHIFT_CONFIG[shiftType].label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showShiftMenu ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {/* 润色强度快捷指示（仅 polish 显示） */}
                {action === 'polish' && (
                  <span className="text-[10px] text-gray-400 px-1 whitespace-nowrap">
                    {intensityCfg.label}
                  </span>
                )}

                {/* 风格选择 */}
                <button
                  ref={styleBtnRef}
                  type="button"
                  onClick={() => {
                    setShowStyleMenu(!showStyleMenu);
                    setShowActionMenu(false);
                    setShowSettings(false);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap ${
                    showStyleMenu
                      ? 'bg-gray-100 text-gray-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{styleCfg.icon}</span>
                  <span>{styleCfg.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showStyleMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* 更多设置 */}
                <button
                  ref={moreBtnRef}
                  type="button"
                  onClick={() => {
                    setShowSettings(!showSettings);
                    setShowStyleMenu(false);
                    setShowActionMenu(false);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap ${
                    showSettings
                      ? 'bg-gray-100 text-gray-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>更多</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* 发送按钮 */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
    </>
  );
}
