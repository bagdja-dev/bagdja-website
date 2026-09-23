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

import { FulfillmentFieldInput } from './fulfillment-field-input';
import { FulfillmentFieldValue } from './fulfillment-field-value';
import { ConfirmDialog } from './confirm-dialog';
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
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});
  const [savedMessage, setSavedMessage] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function submitStep(step: OrderFulfillmentStepProgress) {
    const key = stepKey(orderId, step.stepName);
    const fields = step.formSchema ?? [];
    for (const field of fields) {
      const fieldValue = formData[field.key];
      if (field.required && (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim()) || (Array.isArray(fieldValue) && fieldValue.length === 0))) {
        setErrorByKey((prev) => ({ ...prev, [key]: `Field "${field.label}" wajib diisi` }));
        return;
      }
    }
    setBusyKey(key);
    setErrorByKey((prev) => ({ ...prev, [key]: '' }));
    try {
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const fieldValue = formData[field.key];
        if (Array.isArray(fieldValue) ? fieldValue.length > 0 : typeof fieldValue === 'string' && fieldValue.trim()) {
          payload[field.key] = Array.isArray(fieldValue) ? fieldValue : String(fieldValue).trim();
        }
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

  async function saveDraft(step: OrderFulfillmentStepProgress) {
    const key = stepKey(orderId, step.stepName);
    setSavingKey(key);
    try {
      const res = await fetch(`/api/orders/${orderId}/steps/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_name: step.stepName, form_data: formData }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? 'Gagal menyimpan draft');
      setSavedMessage(`${step.stepName} berhasil disimpan.`);
    } catch (err) {
      setErrorByKey((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : 'Gagal menyimpan draft' }));
    } finally {
      setSavingKey(null);
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
                <div className="mt-2 space-y-2 text-xs">
                  {(step.formSchema ?? []).map((f) =>
                    step.formData?.[f.key] != null && step.formData[f.key] !== '' ? (
                      <div key={f.key}>
                        <p style={{ color: 'var(--brand-muted)' }}>{f.label}</p>
                        <FulfillmentFieldValue field={f} value={step.formData[f.key]} />
                      </div>
                    ) : null,
                  )}
                </div>
              )}

              {isCurrent &&
                step.filledBy === 'buyer' &&
                (openKey === key ? (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--brand-border)' }}>
                    {(step.formSchema ?? []).map((f) => (
                      <FulfillmentFieldInput
                        key={f.key}
                        field={f}
                        orderId={orderId}
                        value={formData[f.key] ?? ''}
                        onChange={(value) => setFormData((prev) => ({ ...prev, [f.key]: value }))}
                      />
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
                        disabled={savingKey === key || busyKey === key}
                        onClick={() => void saveDraft(step)}
                        className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                        style={{ border: '1px solid var(--brand-border)' }}
                      >
                        {savingKey === key ? 'Menyimpan…' : 'Simpan'}
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === key}
                        onClick={() => submitStep(step)}
                        className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                        style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                      >
                        {busyKey === key ? 'Mengirim…' : 'Kirim'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(step.formData ?? {});
                      setOpenKey(key);
                    }}
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
      <ConfirmDialog
        open={Boolean(savedMessage)}
        title="Tersimpan"
        message={savedMessage}
        confirmLabel="Tutup"
        showCancel={false}
        onConfirm={() => setSavedMessage('')}
        onCancel={() => setSavedMessage('')}
      />
    </section>
  );
}
