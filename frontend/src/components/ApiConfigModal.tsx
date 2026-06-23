import React from 'react';
import { X, Key, Cpu, Globe, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { ModelType } from '../types';

interface ApiConfigModalProps {
  open: boolean;
  onClose: () => void;
  modelType: ModelType;
  onModelTypeChange: (v: ModelType) => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  baseUrl: string;
  onBaseUrlChange: (v: string) => void;
  isConnected: boolean;
  isTesting: boolean;
  statusMsg: string;
  onTest: () => void;
}

const MODELS: { key: ModelType; label: string; description: string }[] = [
  { key: 'deepseek', label: 'DeepSeek', description: 'deepseek-chat 模型，性价比高' },
  { key: 'qwen', label: 'Qwen（通义千问）', description: 'qwen-max 模型，中文能力强' },
  { key: 'doubao', label: 'Doubao（豆包）', description: 'doubao-seed-2-0-mini 模型，火山引擎' },
  { key: 'custom', label: '自定义', description: '兼容 OpenAI 接口的任意模型' },
];

export default function ApiConfigModal({
  open,
  onClose,
  modelType,
  onModelTypeChange,
  apiKey,
  onApiKeyChange,
  baseUrl,
  onBaseUrlChange,
  isConnected,
  isTesting,
  statusMsg,
  onTest,
}: ApiConfigModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 弹窗 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-bold text-gray-900">API 连接设置</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 space-y-5">
          {/* 模型选择 */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Cpu className="w-4 h-4" />
              选择模型
            </label>
            <div className="space-y-1.5">
              {MODELS.map((m) => (
                <label
                  key={m.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    modelType === m.key
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="modelType"
                    value={m.key}
                    checked={modelType === m.key}
                    onChange={() => onModelTypeChange(m.key)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      modelType === m.key ? 'border-primary-600' : 'border-gray-300'
                    }`}
                  >
                    {modelType === m.key && (
                      <div className="w-2 h-2 rounded-full bg-primary-600" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{m.label}</div>
                    <div className="text-xs text-gray-400">{m.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Key className="w-4 h-4" />
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="input-field"
            />
          </div>

          {/* Base URL */}
          {modelType === 'custom' && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Globe className="w-4 h-4" />
                自定义 Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="input-field"
              />
            </div>
          )}

          {/* 状态消息 */}
          {statusMsg && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                isConnected
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-orange-50 text-orange-700 border border-orange-200'
              }`}
            >
              {isConnected ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {statusMsg}
            </div>
          )}
        </div>

        {/* 按钮 */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            关闭
          </button>
          <button
            onClick={onTest}
            disabled={isTesting || !apiKey.trim()}
            className="btn-primary"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                测试中...
              </>
            ) : (
              '测试连接'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
