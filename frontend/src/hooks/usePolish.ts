import { useState, useRef, useCallback } from 'react';
import type { PolishStyle, PolishMode, SSEEvent, PolishResult, ChatMessage, PolishAction, PolishIntensity, ToneShiftType, PolishRole } from '../types';

const API_BASE = '/api';

let msgIdCounter = 0;
function nextMsgId(): string {
  msgIdCounter += 1;
  return `msg_${Date.now()}_${msgIdCounter}`;
}

export interface PolishState {
  /** 完整润色文本（流式累积） */
  polishedText: string;
  /** 是否正在润色 */
  isPolishing: boolean;
  /** 当前进度提示 */
  progress: string;
  /** 润色结果（最终结构化） */
  result: PolishResult | null;
  /** 错误信息 */
  error: string | null;
  /** 对话历史（气泡展示用） */
  history: ChatMessage[];
}

export function usePolish() {
  const [state, setState] = useState<PolishState>({
    polishedText: '',
    isPolishing: false,
    progress: '',
    result: null,
    error: null,
    history: [],
  });

  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState((s) => ({ ...s, isPolishing: false }));
  }, []);

  const polish = useCallback(
    async (params: {
      text: string;
      style: PolishStyle;
      mode?: PolishMode;
      temperature?: number;
      maxTokens?: number;
      useKb?: boolean;
      customInstructions?: string;
      /** 可选：文件发送时显示文件名 */
      displayText?: string;
      /** 可选：文件发送时用户额外输入的提示词文本 */
      userPromptText?: string;
      /** 润色操作类型 */
      action?: PolishAction;
      /** 润色强度 */
      intensity?: PolishIntensity;
      /** 目标字数 */
      targetWords?: number;
      /** 话术转换子类型 */
      shiftType?: ToneShiftType;
      /** 局部选中文本 */
      selectedText?: string;
      /** 润色角色 */
      role?: PolishRole;
    }) => {
      // 中止上一次请求
      if (abortRef.current) abortRef.current.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      // 重置状态（保留历史，首次对话时清空）
      setState((s) => ({
        polishedText: '',
        isPolishing: true,
        progress: '正在连接...',
        result: null,
        error: null,
        history: s.history.length > 0 && params.mode !== 'full' ? s.history : [],
      }));

      // 添加用户消息到历史（文件模式：第一个气泡显示文件名，第二个显示提示词）
      const newMessages: ChatMessage[] = [];
      if (params.displayText && params.text) {
        // 文件模式：文件名气泡
        newMessages.push({
          id: nextMsgId(),
          role: 'user',
          content: params.displayText,
          style: params.style,
          timestamp: Date.now(),
        });
        // 如果有用户输入的提示词，显示第二个气泡
        if (params.userPromptText && params.userPromptText.trim()) {
          newMessages.push({
            id: nextMsgId(),
            role: 'user',
            content: params.userPromptText,
            style: params.style,
            timestamp: Date.now(),
          });
        }
      } else {
        // 普通模式：显示完整文本
        newMessages.push({
          id: nextMsgId(),
          role: 'user',
          content: params.displayText || params.text,
          style: params.style,
          timestamp: Date.now(),
        });
      }
      setState((s) => ({ ...s, history: [...s.history, ...newMessages] }));

      try {
        const res = await fetch(`${API_BASE}/polish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: params.text,
            style: params.style,
            mode: params.mode || 'full',
            temperature: params.temperature,
            max_tokens: params.maxTokens,
            use_kb: params.useKb,
            custom_instructions: params.customInstructions || '',
            action: params.action || 'polish',
            intensity: params.intensity || 'medium',
            target_words: params.targetWords || 0,
            shift_type: params.shiftType || 'gentle',
            selected_text: params.selectedText || '',
            role: params.role || 'editor',
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: '请求失败' }));
          setState((s) => ({
            ...s,
            isPolishing: false,
            error: err.detail || '服务器错误',
          }));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setState((s) => ({ ...s, isPolishing: false, error: '无法读取响应流' }));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6);
            try {
              const event: SSEEvent = JSON.parse(jsonStr);

              if (event.type === 'token' && typeof event.data === 'string') {
                fullText += event.data;
                setState((s) => ({ ...s, polishedText: fullText }));
              } else if (event.type === 'progress' && typeof event.data === 'string') {
                setState((s) => ({ ...s, progress: event.data as string }));
              } else if (event.type === 'result' && event.data) {
                const result = event.data as PolishResult;
                const assistantMsg: ChatMessage = {
                  id: nextMsgId(),
                  role: 'assistant',
                  content: result.polished_text,
                  result,
                  timestamp: Date.now(),
                };
                setState((s) => ({
                  ...s,
                  result,
                  polishedText: result.polished_text,
                  isPolishing: false,
                  progress: '润色完成',
                  history: [...s.history, assistantMsg],
                }));
              } else if (event.type === 'error' && typeof event.data === 'string') {
                setState((s) => ({ ...s, error: event.data as string, isPolishing: false }));
              } else if (event.type === 'done') {
                setState((s) => ({ ...s, isPolishing: false }));
              }
            } catch {
              // 跳过解析失败的行
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setState((s) => ({
          ...s,
          isPolishing: false,
          error: err instanceof Error ? err.message : '网络错误',
        }));
      }
    },
    [],
  );

  const continuePolish = useCallback(
    async (instruction: string, temperature?: number) => {
      if (abortRef.current) abortRef.current.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      setState((s) => ({
        ...s,
        isPolishing: true,
        polishedText: '',
        progress: '正在优化...',
        error: null,
      }));

      // 添加继续优化指令到历史
      const userMsg: ChatMessage = {
        id: nextMsgId(),
        role: 'user',
        content: instruction,
        timestamp: Date.now(),
      };
      setState((s) => ({ ...s, history: [...s.history, userMsg] }));

      try {
        const res = await fetch(`${API_BASE}/polish/continue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction, temperature }),
          signal: controller.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));

              if (event.type === 'token' && typeof event.data === 'string') {
                fullText += event.data;
                setState((s) => ({ ...s, polishedText: fullText }));
              } else if (event.type === 'result' && event.data) {
                const result = event.data as PolishResult;
                const assistantMsg: ChatMessage = {
                  id: nextMsgId(),
                  role: 'assistant',
                  content: result.polished_text,
                  result,
                  timestamp: Date.now(),
                };
                setState((s) => ({
                  ...s,
                  result,
                  polishedText: result.polished_text,
                  isPolishing: false,
                  progress: '优化完成',
                  history: [...s.history, assistantMsg],
                }));
              } else if (event.type === 'error') {
                setState((s) => ({
                  ...s,
                  error: typeof event.data === 'string' ? event.data : '优化失败',
                  isPolishing: false,
                }));
              } else if (event.type === 'done') {
                setState((s) => ({ ...s, isPolishing: false }));
              }
            } catch { /* skip */ }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setState((s) => ({
          ...s,
          isPolishing: false,
          error: err instanceof Error ? err.message : '网络错误',
        }));
      }
    },
    [],
  );

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState({
      polishedText: '',
      isPolishing: false,
      progress: '',
      result: null,
      error: null,
      history: [],
    });
  }, []);

  /** 加载历史对话：切换会话时恢复消息、结果等状态 */
  const loadHistory = useCallback((messages: ChatMessage[]) => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    setState({
      polishedText: lastAssistant?.content || '',
      isPolishing: false,
      progress: '',
      result: lastAssistant?.result || null,
      error: null,
      history: messages,
    });
  }, []);

  return { ...state, polish, continuePolish, stop, reset, loadHistory };
}
