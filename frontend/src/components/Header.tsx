import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  MoreHorizontal,
  PanelLeftOpen,
  Share2,
  Check,
  BarChart3,
} from 'lucide-react';

interface HeaderProps {
  title: string;
  hasContent: boolean;
  onExport: (format: string) => void;
  onShare: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onAnalyze?: () => void;
}

export default function Header({
  title,
  hasContent,
  onExport,
  onShare,
  isSidebarCollapsed,
  onToggleSidebar,
  onAnalyze,
}: HeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleShare = async () => {
    onShare();
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 2000);
  };

  return (
    <header className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-200/60 z-30">
      <div className="px-4 h-12 flex items-center">
        {/* 左侧：侧边栏切换按钮（折叠时显示） */}
        <div className="flex items-center w-10">
          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="打开历史对话"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 中间：标题 + 免责声明（居中） */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <h1 className="text-sm font-semibold text-gray-800 truncate max-w-md">
            {title}
          </h1>
          <p className="text-[10px] text-gray-400 mt-0.5 select-none">
            内容由AI生成，仅供参考
          </p>
        </div>

        {/* 右侧：分析 + 分享按钮 + 导出菜单 */}
        <div className="flex items-center gap-1 w-10 justify-end" ref={menuRef}>
          {/* 智能分析按钮 */}
          {onAnalyze && (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={!hasContent}
              className={`p-1.5 rounded-lg transition-colors ${
                hasContent
                  ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
              title={hasContent ? '智能分析文本' : '暂无内容可分析'}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          )}
          {/* 分享按钮 */}
          <button
            type="button"
            onClick={handleShare}
            disabled={!hasContent}
            className={`p-1.5 rounded-lg transition-colors ${
              shareSuccess
                ? 'text-green-600 bg-green-50'
                : hasContent
                  ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  : 'text-gray-300 cursor-not-allowed'
            }`}
            title={hasContent ? '分享对话内容' : '暂无内容可分享'}
          >
            {shareSuccess ? (
              <Check className="w-4 h-4" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>

          {/* 导出菜单 */}
          {hasContent && (
            <>
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="更多操作"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showExportMenu && (
                <div className="absolute right-4 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-40">
                  <button
                    type="button"
                    onClick={() => {
                      onExport('markdown');
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    导出 Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onExport('word');
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    导出 Word
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onExport('pdf');
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-red-400" />
                    导出 PDF
                  </button>
                  <div className="border-t border-gray-100 my-0.5" />
                  <button
                    type="button"
                    onClick={() => {
                      onExport('text');
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-gray-400" />
                    导出纯文本
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
