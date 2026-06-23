import { useState, useCallback, useEffect } from 'react';
import type { Conversation } from '../types';

const STORAGE_KEY = 'polish-assistant-conversations';

function loadFromStorage(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // localStorage 满了或不可用，静默失败
  }
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>(loadFromStorage);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const convs = loadFromStorage();
    return convs.length > 0 ? convs[0].id : null;
  });

  // conversations 变化时持久化到 localStorage
  useEffect(() => {
    saveToStorage(conversations);
  }, [conversations]);

  const createConversation = useCallback(() => {
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newConv: Conversation = {
      id,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(id);
    return id;
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (activeId === id) {
          setActiveId(filtered.length > 0 ? filtered[0].id : null);
        }
        return filtered;
      });
    },
    [activeId],
  );

  const clearConversation = useCallback(
    (id: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, messages: [], title: '新对话', updatedAt: Date.now() }
            : c,
        ),
      );
    },
    [],
  );

  const switchConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const updateConversation = useCallback(
    (id: string, updater: (conv: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...updater(c), updatedAt: Date.now() } : c)),
      );
    },
    [],
  );

  const getConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id) || null,
    [conversations],
  );

  const searchConversations = useCallback(
    (query: string) => {
      if (!query.trim()) return conversations;
      const q = query.toLowerCase();
      return conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.messages.some((m) => m.content.toLowerCase().includes(q)),
      );
    },
    [conversations],
  );

  return {
    conversations,
    activeId,
    createConversation,
    deleteConversation,
    clearConversation,
    switchConversation,
    updateConversation,
    getConversation,
    searchConversations,
  };
}
