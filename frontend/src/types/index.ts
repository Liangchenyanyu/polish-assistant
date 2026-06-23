/** 润色风格 */
export type PolishStyle = 'academic' | 'business' | 'media' | 'concise' | 'custom';

/** 润色模式 */
export type PolishMode = 'full' | 'paragraph';

/** 润色操作/工具类型 */
export type PolishAction = 'polish' | 'paraphrase' | 'deai' | 'simplify' | 'continue' | 'tone_shift';

/** 润色强度 */
export type PolishIntensity = 'light' | 'medium' | 'deep';

/** 话术转换子类型 */
export type ToneShiftType = 'gentle' | 'persuasive' | 'positive' | 'formal' | 'casual';

/** 润色角色 */
export type PolishRole = 'editor' | 'teacher' | 'business' | 'academic';

/** 模型类型 */
export type ModelType = 'deepseek' | 'qwen' | 'doubao' | 'custom';

/** 聊天消息（气泡对话用） */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  style?: PolishStyle;
  result?: PolishResult;
  timestamp: number;
}

/** 对话（多轮会话） */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  originalText?: string;
  createdAt: number;
  updatedAt: number;
}

/** 修改记录 */
export interface ChangeItem {
  original: string;
  modified: string;
  reason: string;
  type: string;
}

/** 知识库引用 */
export interface KbReference {
  content: string;
  source: string;
  score: number;
}

/** 润色结果 */
export interface PolishResult {
  polished_text: string;
  changes: ChangeItem[];
  suggestions: string[];
  style_match_score: number;
  kb_refs?: KbReference[];
}

/** SSE 事件类型 */
export type SSEEventType = 'token' | 'progress' | 'result' | 'paragraph_done' | 'error' | 'done';

/** SSE 事件 */
export interface SSEEvent {
  type: SSEEventType;
  data?: string | PolishResult | { index: number; total: number; polished: string };
}

/** 风格配置 */
export const STYLE_CONFIG: Record<PolishStyle, {
  label: string;
  icon: string;
  description: string;
  color: string;
}> = {
  academic: {
    label: '学术严谨',
    icon: '🎓',
    description: '逻辑严密、术语准确、引用规范',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  business: {
    label: '商务正式',
    icon: '💼',
    description: '措辞得体、结构清晰、礼貌专业',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  media: {
    label: '自媒体活泼',
    icon: '📱',
    description: '生动有趣、贴近读者、节奏明快',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  concise: {
    label: '简洁凝练',
    icon: '✨',
    description: '去除冗余、直击要点、言简意赅',
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  custom: {
    label: '自定义风格',
    icon: '🎨',
    description: '按你的指引灵活调整',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
};

/** 工具/操作配置 */
export const ACTION_CONFIG: Record<PolishAction, {
  label: string;
  icon: string;
  description: string;
  color: string;
}> = {
  polish: {
    label: '智能润色',
    icon: '✨',
    description: '综合优化语法、用词、句式',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  paraphrase: {
    label: '降重改写',
    icon: '🔄',
    description: '同义替换、句式重构，降低重复率',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
  },
  deai: {
    label: '去AI痕迹',
    icon: '🤖',
    description: '弱化机器化生硬句式，模拟真人手写语感',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  simplify: {
    label: '通俗化',
    icon: '📖',
    description: '将专业晦涩内容转化为通俗易懂的表达',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  continue: {
    label: 'AI续写',
    icon: '✍️',
    description: '基于前文风格，自然续写后续内容',
    color: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  tone_shift: {
    label: '话术转换',
    icon: '🎭',
    description: '转换语气：强硬→委婉、平淡→感染力、消极→积极',
    color: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

/** 润色强度配置 */
export const INTENSITY_CONFIG: Record<PolishIntensity, {
  label: string;
  description: string;
}> = {
  light: {
    label: '轻度',
    description: '仅修正语法错误和明显语病，几乎不改动原文',
  },
  medium: {
    label: '中度',
    description: '优化语句通顺度和用词，保持原文结构',
  },
  deep: {
    label: '深度',
    description: '大幅重构句式、优化逻辑，深度提升质量',
  },
};

/** 话术转换子类型配置 */
export const TONE_SHIFT_CONFIG: Record<ToneShiftType, {
  label: string;
  description: string;
}> = {
  gentle: {
    label: '强硬→委婉',
    description: '将生硬、强硬的表达转为礼貌、委婉的说法',
  },
  persuasive: {
    label: '平淡→有感染力',
    description: '将平淡无奇的表述转为有感染力、有说服力的表达',
  },
  positive: {
    label: '消极→积极正向',
    description: '将消极、负面的表述转为积极、建设性的表达',
  },
  formal: {
    label: '口语→正式',
    description: '将口语化表达转为正式、规范的书面表达',
  },
  casual: {
    label: '正式→口语',
    description: '将正式书面表达转为轻松、自然的口语化表达',
  },
};

/** 润色角色配置 */
export const ROLE_CONFIG: Record<PolishRole, {
  label: string;
  icon: string;
  description: string;
}> = {
  editor: {
    label: '资深编辑',
    icon: '📰',
    description: '专业精准，关注可读性和传播效果',
  },
  teacher: {
    label: '语文老师',
    icon: '📚',
    description: '耐心细致，注重基础语法和表达规范',
  },
  business: {
    label: '商务顾问',
    icon: '💼',
    description: '简洁有力，注重说服力和专业度',
  },
  academic: {
    label: '学术导师',
    icon: '🎓',
    description: '严谨规范，注重逻辑严密和论证充分',
  },
};
