import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  /** 水平对齐：left / right */
  align?: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

/** 用 Portal 渲染到 body 的弹出层，避免被祖先 overflow:hidden 裁剪 */
export default function Popover({ open, onClose, triggerRef, align = 'left', children, className = '' }: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });

  // 计算弹出位置
  const calcPosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popover = popoverRef.current;
    if (!popover) {
      // 首次：用 trigger 位置估算
      setPos({
        top: rect.top - 8, // 向上偏移 8px
        left: align === 'right' ? rect.right : rect.left,
      });
      return;
    }
    const pw = popover.offsetWidth;
    const ph = popover.offsetHeight;

    let left = align === 'right' ? rect.right - pw : rect.left;
    // 防溢出左边界
    if (left < 8) left = 8;
    // 防溢出右边界
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;

    // 向上展开
    let top = rect.top - ph - 8;
    if (top < 8) {
      // 空间不够，改为向下展开
      top = rect.bottom + 8;
    }

    setPos({ top, left });
  }, [triggerRef, align]);

  useEffect(() => {
    if (!open) return;
    // 延迟计算以确保 popover DOM 已渲染
    requestAnimationFrame(calcPosition);
  }, [open, calcPosition]);

  // 监听 resize/scroll
  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', calcPosition);
    window.addEventListener('scroll', calcPosition, true);
    return () => {
      window.removeEventListener('resize', calcPosition);
      window.removeEventListener('scroll', calcPosition, true);
    };
  }, [open, calcPosition]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        if (triggerRef.current && !triggerRef.current.contains(target)) {
          onClose();
        } else {
          // 点击了 trigger，不关闭（由 trigger 自己的 onClick 处理 toggle）
        }
      }
    };
    // 用 mousedown 捕获，避免某些场景下点击被吞
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
      }}
      className={className}
    >
      {children}
    </div>,
    document.body,
  );
}
