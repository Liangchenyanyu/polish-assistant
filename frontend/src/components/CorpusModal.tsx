import React, { useState, useEffect, useCallback } from 'react';
import {
  X, BookOpen, Plus, Trash2, Loader2, CheckCircle,
  AlertCircle, FileText, RefreshCw,
} from 'lucide-react';
import { listCorpus, addCorpus, deleteCorpus, reloadCorpus } from '../services/api';

// ===== 语料库文件类型 =====
interface CorpusFile {
  filename: string;
  display_name: string;
  size: number;
  size_display: string;
  chars: number;
  created_at: string;
  modified_at: string;
}

// ===== Props =====
interface CorpusModalProps {
  open: boolean;
  onClose: () => void;
}

// ===== 组件 =====
export default function CorpusModal({ open, onClose }: CorpusModalProps) {
  // 语料库列表
  const [corpusList, setCorpusList] = useState<CorpusFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isReloading, setIsReloading] = useState(false);
  const [reloadMsg, setReloadMsg] = useState('');

  // 添加语料表单
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addContent, setAddContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // 删除状态
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  // 加载语料库列表
  const fetchCorpusList = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await listCorpus();
      setCorpusList(data.corpus || []);
    } catch {
      setLoadError('加载语料库列表失败，请检查后端服务');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchCorpusList();
      // 重置表单状态
      setShowAddForm(false);
      setAddTitle('');
      setAddContent('');
      setAddError('');
      setReloadMsg('');
    }
  }, [open, fetchCorpusList]);

  // 添加语料
  const handleAddCorpus = async () => {
    if (!addTitle.trim()) {
      setAddError('请输入语料库标题');
      return;
    }
    if (!addContent.trim() || addContent.trim().length < 10) {
      setAddError('语料内容至少10个字符');
      return;
    }
    setAddError('');
    setIsAdding(true);
    try {
      await addCorpus(addTitle.trim(), addContent);
      setAddTitle('');
      setAddContent('');
      setShowAddForm(false);
      await fetchCorpusList();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : '添加失败');
    } finally {
      setIsAdding(false);
    }
  };

  // 删除语料
  const handleDeleteCorpus = async (filename: string) => {
    if (!confirm(`确定要删除语料库「${filename}」吗？此操作不可恢复。`)) return;
    setDeletingFile(filename);
    try {
      await deleteCorpus(filename);
      await fetchCorpusList();
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeletingFile(null);
    }
  };

  // 重新加载知识库
  const handleReload = async () => {
    setIsReloading(true);
    setReloadMsg('');
    try {
      const result = await reloadCorpus();
      setReloadMsg(result.message || '知识库已重新加载');
      await fetchCorpusList();
    } catch (e) {
      setReloadMsg(e instanceof Error ? e.message : '重新加载失败');
    } finally {
      setIsReloading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 弹窗 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[85vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-bold text-gray-900">语料库管理</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 顶部操作栏 */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                已加载语料库
                {!isLoading && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {corpusList.length} 份
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">用于知识库检索增强（RAG）</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchCorpusList}
                disabled={isLoading}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="刷新列表"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加语料
              </button>
            </div>
          </div>

          {/* 重新加载提示 */}
          {reloadMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              reloadMsg.includes('失败')
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {reloadMsg.includes('失败') ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {reloadMsg}
            </div>
          )}

          {/* 加载中 */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              <span className="ml-2 text-sm text-gray-400">加载中...</span>
            </div>
          )}

          {/* 加载错误 */}
          {!isLoading && loadError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {loadError}
            </div>
          )}

          {/* 空状态 */}
          {!isLoading && !loadError && corpusList.length === 0 && (
            <div className="text-center py-8">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">暂无语料库</p>
              <p className="text-xs text-gray-300 mt-1">点击「添加语料」创建第一个语料库</p>
            </div>
          )}

          {/* 语料列表 */}
          {!isLoading && corpusList.length > 0 && (
            <div className="space-y-2">
              {corpusList.map((c) => (
                <div
                  key={c.filename}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {c.display_name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c.filename} · {c.chars.toLocaleString()} 字符 · {c.size_display}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCorpus(c.filename)}
                    disabled={deletingFile === c.filename}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title="删除语料库"
                  >
                    {deletingFile === c.filename ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 重新加载按钮 */}
          {!isLoading && corpusList.length > 0 && (
            <button
              onClick={handleReload}
              disabled={isReloading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors disabled:opacity-50"
            >
              {isReloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在重建索引...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  重新加载知识库（使增删生效）
                </>
              )}
            </button>
          )}

          {/* 添加语料表单 */}
          {showAddForm && (
            <div className="p-4 rounded-xl border-2 border-primary-200 bg-primary-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-primary-600" />
                  添加自定义语料库
                </h4>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setAddTitle('');
                    setAddContent('');
                    setAddError('');
                  }}
                  className="p-1 rounded-lg hover:bg-white text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  语料标题 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="例如：产品需求文档写作规范"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  maxLength={100}
                />
                <p className="text-xs text-gray-400 mt-1">
                  标题将自动生成为文件名（.txt）
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  语料内容 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  placeholder={`在此输入语料内容（至少10个字符）...\n\n示例：\n产品需求文档（PRD）的写作规范，包括文档结构、用语要求、评审流程等。`}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white resize-none"
                  rows={8}
                />
                <p className="text-xs text-gray-400 mt-1">
                  已输入 {addContent.length} 字符（需 ≥ 10）
                </p>
              </div>

              {addError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {addError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setAddTitle('');
                    setAddContent('');
                    setAddError('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddCorpus}
                  disabled={isAdding}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存语料'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
