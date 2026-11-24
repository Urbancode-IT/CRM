import { useEffect, useRef } from 'react';

export default function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  size = 'sm',
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector('input,button,textarea,select')?.focus();
  }, [open]);

  if (!open) return null;

  const width = size === 'md' ? 'max-w-lg' : 'max-w-sm';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[#0b1c2e]/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${width} rounded-2xl border border-brand-100 bg-white p-5 shadow-2xl shadow-slate-900/20`}
      >
        {title ? (
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-slate-400 hover:bg-brand-100 hover:text-slate-900"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ) : null}
        <div>{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
