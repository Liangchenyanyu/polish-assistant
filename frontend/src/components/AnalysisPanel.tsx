import React, { useState } from 'react';
import {
  X, BarChart3, AlertTriangle, RotateCcw, Search, Shield, Key, FileText,
  Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { analyzeText } from '../services/api';

interface AnalysisData {
  readability?: {
    readability_score: number;
    level: string;
    grade: string;
    details: {
      total_chars: number;
      total_sentences: number;
      total_paragraphs: number;
      avg_sentence_length: number;
      estimated_words: number;
      punctuation_count: number;
      rare_char_ratio: number;
    };
  };
  errors?: { total: number; errors: Array<{
    type: string;
    description: string;
    suggestion: string;
    matched_text: string;
    context: string;
  }> };
  repetition?: { total: number; repetitions: Array<{
    phrase: string;
    count: number;
    examples: string[];
  }> };
  sensitive_words?: { total: number; words: Array<{
    word: string;
    warning: string;
    context: string;
  }> };
  keywords?: { keywords: Array<{ word: string; frequency: number }> };
  summary?: { summary: string; method: string };
  error?: string;
}

interface Props {
  text: string;
  open: boolean;
  onClose: () => void;
}

function ScoreGauge({ score, level, grade }: { score: number; level: string; grade: string }) {
  // 颜色根据难度
  const getColor = (s: number) => {
    if (s < 25) return { bg: '#22c55e', text: 'text-green-600' };
    if (s < 40) return { bg: '#84cc16', text: 'text-lime-600' };
    if (s < 55) return { bg: '#eab308', text: 'text-yellow-600' };
    if (s < 70) return { bg: '#f97316', text: 'text-orange-600' };
    return { bg: '#ef4444', text: 'text-red-600' };
  };
  const color = getColor(score);

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle
            cx="32" cy="32" r="27" fill="none"
            stroke={color.bg} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 170} 170`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-700">{score}</span>
        </div>
      </div>
      <div>
        <div className={`text-sm font-semibold ${color.text}`}>{level}</div>
        <div className="text-xs text-gray-400">适合 {grade}</div>
      </div>
    </div>
  );
}

export default function AnalysisPanel({ text, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await analyzeText(text);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error || '分析失败');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 打开时自动分析
  React.useEffect(() => {
    if (open && text) {
      handleAnalyze();
    }
    if (!open) {
      setData(null);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const rd = data?.readability;
  const errs = data?.errors;
  const reps = data?.repetition;
  const sens = data?.sensitive_words;
  const kws = data?.keywords;
  const sum = data?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">文本智能分析</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">正在分析文本...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* 1. 可读性评分 */}
              {rd && (
                <section className="bg-gray-50 rounded-xl p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <BarChart3 className="w-4 h-4 text-primary-500" /> 可读性评分
                  </h3>
                  <ScoreGauge score={rd.readability_score} level={rd.level} grade={rd.grade} />
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-gray-500">
                    <div>总字符: <span className="text-gray-700 font-medium">{rd.details.total_chars}</span></div>
                    <div>句子数: <span className="text-gray-700 font-medium">{rd.details.total_sentences}</span></div>
                    <div>段落数: <span className="text-gray-700 font-medium">{rd.details.total_paragraphs}</span></div>
                    <div>平均句长: <span className="text-gray-700 font-medium">{rd.details.avg_sentence_length}字</span></div>
                    <div>估计词数: <span className="text-gray-700 font-medium">{rd.details.estimated_words}</span></div>
                    <div>标点数: <span className="text-gray-700 font-medium">{rd.details.punctuation_count}</span></div>
                  </div>
                </section>
              )}

              {/* 2. 语病检测 */}
              {errs && (
                <section className="bg-gray-50 rounded-xl p-4">
                  <h3
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2 cursor-pointer"
                    onClick={() => toggle('errors')}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    语病检测
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${errs.total > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {errs.total > 0 ? `发现 ${errs.total} 处` : '未发现'}
                    </span>
                    {expanded.errors ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </h3>
                  {expanded.errors && errs.errors.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {errs.errors.map((e, i) => (
                        <div key={i} className="bg-white border border-amber-100 rounded-lg px-3 py-2">
                          <div className="text-xs font-medium text-amber-700">{e.description}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">匹配: 「{e.matched_text}」</div>
                          <div className="text-[11px] text-gray-500">上下文: {e.context}</div>
                          <div className="text-[11px] text-green-600 mt-0.5">建议: {e.suggestion}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* 3. 重复度检测 */}
              {reps && (
                <section className="bg-gray-50 rounded-xl p-4">
                  <h3
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2 cursor-pointer"
                    onClick={() => toggle('repetition')}
                  >
                    <RotateCcw className="w-4 h-4 text-purple-500" />
                    重复度检测
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${reps.total > 0 ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {reps.total > 0 ? `发现 ${reps.total} 组` : '未发现'}
                    </span>
                    {expanded.repetition ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </h3>
                  {expanded.repetition && reps.repetitions.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {reps.repetitions.map((r, i) => (
                        <div key={i} className="bg-white border border-purple-100 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-purple-700">「{r.phrase}」</span>
                            <span className="text-[11px] text-purple-500">出现 {r.count} 次</span>
                          </div>
                          {r.examples.slice(0, 2).map((ex, j) => (
                            <div key={j} className="text-[11px] text-gray-500 mt-0.5 truncate">...{ex}...</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* 4. 敏感词筛查 */}
              {sens && (
                <section className="bg-gray-50 rounded-xl p-4">
                  <h3
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2 cursor-pointer"
                    onClick={() => toggle('sensitive')}
                  >
                    <Shield className="w-4 h-4 text-red-500" />
                    敏感词筛查
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${sens.total > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {sens.total > 0 ? `发现 ${sens.total} 处` : '安全'}
                    </span>
                    {expanded.sensitive ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </h3>
                  {expanded.sensitive && sens.words.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {sens.words.map((w, i) => (
                        <div key={i} className="bg-white border border-red-100 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{w.word}</span>
                            <span className="text-xs text-red-500">{w.warning}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">上下文: {w.context}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* 5. 关键词 */}
              {kws && kws.keywords.length > 0 && (
                <section className="bg-gray-50 rounded-xl p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Key className="w-4 h-4 text-blue-500" /> 关键词提取
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {kws.keywords.map((k, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                      >
                        {k.word}
                        <span className="text-[10px] text-blue-400">({k.frequency})</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* 6. 摘要 */}
              {sum && (
                <section className="bg-gray-50 rounded-xl p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <FileText className="w-4 h-4 text-emerald-500" /> 智能摘要
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{sum.summary}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{sum.method}</p>
                </section>
              )}
            </>
          )}

          {/* 空状态 */}
          {!loading && !data && !error && (
            <div className="text-center py-12">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">点击分析按钮开始智能分析</p>
              <button
                onClick={handleAnalyze}
                className="mt-3 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
              >
                开始分析
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">分析结果仅供参考</span>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            重新分析
          </button>
        </div>
      </div>
    </div>
  );
}
