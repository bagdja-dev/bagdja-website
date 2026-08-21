'use client';

/**
 * Modal konfirmasi generik (dipakai OrderActionButtons) — pengganti
 * `window.confirm()` browser bawaan yang tidak mengikuti tema situs.
 */
import { useEffect } from 'react';

export function ConfirmDialog({
  open,
  title,
  message,
  error,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  error?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--brand-bg)', borderColor: 'var(--brand-border)' }}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--brand-text)' }}
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
          {message}
        </p>
        {error && (
          <p className="mt-3 text-sm font-medium" style={{ color: 'crimson' }}>
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={
              variant === 'danger'
                ? { backgroundColor: 'crimson', color: '#fff' }
                : { backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }
            }
          >
            {loading ? 'Memproses…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
