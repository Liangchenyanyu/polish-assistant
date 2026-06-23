import { useState, useCallback, useEffect } from 'react';
import type { ModelType } from '../types';
import { testConnection } from '../services/api';

const STORAGE_KEY = 'polish-api-config';

/** 从 sessionStorage 读取持久化配置（仅凭据，不含瞬态的连接状态） */
function loadConfig(): {
  modelType: ModelType;
  apiKey: string;
  baseUrl: string;
} {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        modelType: parsed.modelType || 'deepseek',
        apiKey: parsed.apiKey || '',
        baseUrl: parsed.baseUrl || '',
      };
    }
  } catch { /* ignore */ }
  return { modelType: 'deepseek', apiKey: '', baseUrl: '' };
}

function saveConfig(config: {
  modelType: ModelType;
  apiKey: string;
  baseUrl: string;
}) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

export function useApiConfig() {
  const saved = loadConfig();
  const [modelType, setModelType] = useState<ModelType>(saved.modelType);
  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [baseUrl, setBaseUrl] = useState(saved.baseUrl);
  // isConnected 是瞬态状态，每次加载默认 false，必须通过测试连接验证
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [showModal, setShowModal] = useState(false);

  // 仅持久化凭据（modelType / apiKey / baseUrl），连接状态不持久化
  useEffect(() => {
    saveConfig({ modelType, apiKey, baseUrl });
  }, [modelType, apiKey, baseUrl]);

  const handleTest = useCallback(async () => {
    if (!apiKey.trim()) {
      setStatusMsg('请先输入 API Key');
      return;
    }
    setIsTesting(true);
    setStatusMsg('正在测试连接...');
    try {
      const res = await testConnection(modelType, apiKey, baseUrl || undefined);
      setIsConnected(res.success);
      setStatusMsg(res.message);
    } catch (err) {
      console.error('[API] 网络请求失败:', err);
      setIsConnected(false);
      setStatusMsg('连接测试失败，请检查网络');
    } finally {
      setIsTesting(false);
    }
  }, [apiKey, modelType, baseUrl]);

  return {
    modelType,
    setModelType,
    apiKey,
    setApiKey,
    baseUrl,
    setBaseUrl,
    isConnected,
    isTesting,
    statusMsg,
    showModal,
    setShowModal,
    handleTest,
  };
}
