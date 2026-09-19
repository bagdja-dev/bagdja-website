'use client';

/**
 * Checklist step Praorder untuk 1 order yang masih PENDING (belum checkout)
 * — fulfillment-praorder-plan.md §2.1. Beda dari `FulfillmentProgress`
 * (Pascaorder, dikelompokkan per transaksi/banyak item) karena Praorder
 * murni per-order tunggal, belum ada transaksi sama sekali.
 *
 * Step `filledBy:'buyer'` yang jadi giliran (step sebelumnya semua selesai)
 * dapat form inline untuk diisi — pola sama dengan `FulfillmentProgress`,
 * cuma endpoint-nya beda (`/api/orders/:id/steps/complete`, bukan
 * `/api/transactions/.../orders/.../steps/complete`).
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { OrderFulfillmentProgress, OrderFulfillmentStepProgress } from './order-detail-content';

function stepKey(orderId: string, stepName: string): string {
  return `${orderId}::${stepName}`;
}

export function PraorderStepList({
  orderId,
  progress,
}: {
  orderId: string;
  progress: OrderFulfillmentProgress;
}) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});

  async function submitStep(step: OrderFulfillmentStepProgress) {
    const key = stepKey(orderId, step.stepName);
    const fields = step.formSchema ?? [];
    for (const field of fields) {
      if (field.required && !formData[field.key]?.trim()) {
        setErrorByKey((prev) => ({ ...prev, [key]: `Field "${field.label}" wajib diisi` }));
        return;
      }
    }
    setBusyKey(key);
    setErrorByKey((prev) => ({ ...prev, [key]: '' }));
    try {
      const payload: Record<string, string> = {};
      for (const field of fields) {
        if (formData[field.key]?.trim()) payload[field.key] = formData[field.key].trim();
      }
      const res = await fetch(`/api/orders/${orderId}/steps/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_name: step.stepName,
          form_data: Object.keys(payload).length ? payload : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? 'Gagal menyelesaikan step ini');
      setOpenKey(null);
      router.refresh();
    } catch (err) {
      setErrorByKey((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : 'Gagal menyelesaikan step ini',
      }));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
        Progres Penawaran — {progress.flowName}
      </h2>
      <ol className="mt-4 flex flex-col gap-2">
        {progress.steps.map((step, index) => {
          const priorCompleted = progress.steps.slice(0, index).every((s) => s.completed);
          const key = stepKey(orderId, step.stepName);
          const isCurrent = !step.completed && priorCompleted;

          return (
            <li
              key={step.stepName}
              className="rounded-lg border p-3 text-sm"
              style={{ borderColor: 'var(--brand-border)', opacity: step.completed || isCurrent ? 1 : 0.55 }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {index + 1}. {step.stepName}
                </span>
                {step.completed ? (
                  <span className="text-xs font-semibold" style={{ color: 'var(--brand-accent-muted)' }}>
                    ✓ Selesai
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    {!priorCompleted
                      ? 'Menunggu langkah sebelumnya'
                      : step.filledBy === 'buyer'
                        ? 'Giliran Anda'
                        : 'Menunggu admin'}
                  </span>
                )}
              </div>

              {step.description && (
                <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                  {step.description}
                </p>
              )}

              {step.completed && step.formData && Object.keys(step.formData).length > 0 && (
                <div className="mt-2 space-y-0.5 text-xs">
                  {(step.formSchema ?? []).map((f) =>
                    step.formData?.[f.key] != null && step.formData[f.key] !== '' ? (
                      <p key={f.key}>
                        <span style={{ color: 'var(--brand-muted)' }}>{f.label}:</span>{' '}
                        {String(step.formData?.[f.key])}
                      </p>
                    ) : null,
                  )}
                </div>
              )}

              {isCurrent &&
                step.filledBy === 'buyer' &&
                (openKey === key ? (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--brand-border)' }}>
                    {(step.formSchema ?? []).map((f) => (
                      <label key={f.key} className="flex flex-col gap-1 text-xs">
                        <span style={{ color: 'var(--brand-muted)' }}>
                          {f.label}
                          {f.required && ' *'}
                        </span>
                        <input
                          type="text"
                          value={formData[f.key] ?? ''}
                          onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          className="rounded-md border px-2 py-1.5 text-sm"
                          style={{ borderColor: 'var(--brand-border)' }}
                        />
                      </label>
                    ))}
                    {errorByKey[key] && (
                      <p className="text-xs" style={{ color: 'crimson' }}>{errorByKey[key]}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenKey(null)}
                        className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                        style={{ border: '1px solid var(--brand-border)' }}
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === key}
                        onClick={() => submitStep(step)}
                        className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                        style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                      >
                        {busyKey === key ? 'Menyimpan…' : 'Tandai Selesai'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenKey(key)}
                    className="mt-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95"
                    style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                  >
                    Lengkapi {step.stepName}
                  </button>
                ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
