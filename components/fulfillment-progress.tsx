'use client';

/**
 * Checklist progres fulfillment (Order Handling Phase 3 §3.0/§3.0.1) —
 * dikelompokkan per flow (murni tampilan, tidak ada tabel "group" di DB —
 * lihat order-hanlde-plan.md §3.2). Default: tampilan GRUP per step (1 step
 * cuma dirender sekali, mewakili semua produk grup itu) supaya buyer bisa
 * menyetujui pelepasan dana / komplain untuk banyak produk sekaligus dalam
 * 1 klik kalau progress-nya sama (mis. dikirim dalam 1 paket). Tombol
 * "Lihat per produk" membuka rincian per produk (sama seperti sebelumnya)
 * untuk kasus yang progress-nya sudah berbeda-beda antar produk.
 *
 * "Ajukan Komplain" DI SINI beda dari `OrderActionButtons` — ini gate lokal
 * murni per-step (blokir seller lanjut step berikutnya & force-release),
 * TIDAK memanggil escrow/freeze sama sekali karena dana step ini memang
 * belum pernah dipindah selama buyer belum approve.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from './confirm-dialog';
import { FulfillmentFieldInput } from './fulfillment-field-input';
import { FulfillmentFieldValue } from './fulfillment-field-value';
import type { OrderFulfillmentProgress, OrderFulfillmentStepProgress, TransactionItem } from './order-detail-content';

function formatIDR(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

/** Step ber-`filledBy:'buyer'` (level Step, mis. No Resi pengiriman balik pada flow reparasi). */
function isStepBuyerOwned(step: Pick<OrderFulfillmentStepProgress, 'filledBy'>): boolean {
  return step.filledBy === 'buyer';
}

function buyerStepKey(orderId: string, stepName: string): string {
  return `${orderId}::${stepName}`;
}

interface PendingAction {
  orderIds: string[];
  stepName: string;
  kind: 'approve-release' | 'dispute';
}

interface GroupItem {
  orderId: string;
  productName: string;
  progress: OrderFulfillmentProgress;
}

interface GroupStepView {
  index: number;
  stepName: string;
  filledBy: OrderFulfillmentStepProgress['filledBy'];
  description: string | null;
  releasePercentage: number | null;
  formSchema: OrderFulfillmentStepProgress['formSchema'];
  items: { orderId: string; productName: string; step: OrderFulfillmentStepProgress }[];
  completedCount: number;
  totalCount: number;
  /** Item yang step-nya selesai, punya release_percentage, tapi belum di-approve — target aksi bulk approve/komplain. */
  eligibleForRelease: { orderId: string; productName: string; step: OrderFulfillmentStepProgress }[];
}

function buildGroupSteps(groupItems: GroupItem[]): GroupStepView[] {
  if (groupItems.length === 0) return [];
  const stepCount = groupItems[0].progress.steps.length;
  return Array.from({ length: stepCount }, (_, index) => {
    const items = groupItems.map((gi) => ({
      orderId: gi.orderId,
      productName: gi.productName,
      step: gi.progress.steps[index],
    }));
    const template = items[0].step;
    return {
      index,
      stepName: template.stepName,
      filledBy: template.filledBy,
      description: template.description,
      releasePercentage: template.releasePercentage,
      formSchema: template.formSchema,
      items,
      completedCount: items.filter((i) => i.step.completed).length,
      totalCount: items.length,
      eligibleForRelease: items.filter(
        (i) => i.step.completed && i.step.releasePercentage != null && !i.step.releaseApproved,
      ),
    };
  });
}

export function FulfillmentProgress({
  transactionId,
  items,
  fulfillment,
}: {
  transactionId: string;
  items: TransactionItem[];
  fulfillment: Record<string, OrderFulfillmentProgress>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [buyerFormData, setBuyerFormData] = useState<Record<string, unknown>>({});
  const [buyerFormOpen, setBuyerFormOpen] = useState<string | null>(null);
  const [buyerStepBusy, setBuyerStepBusy] = useState<string | null>(null);
  const [buyerStepError, setBuyerStepError] = useState<Record<string, string>>({});
  const [savedMessage, setSavedMessage] = useState('');
  const [savingBuyerKey, setSavingBuyerKey] = useState<string | null>(null);
  const [terminBusy, setTerminBusy] = useState<string | null>(null);
  const [terminError, setTerminError] = useState<Record<string, string>>({});

  /** fulfillment-praorder-plan.md §2.4 — buyer bayar 1 Termin/Tagihan, redirect ke checkout_url seperti checkout biasa. */
  async function payTermin(terminId: string) {
    setTerminBusy(terminId);
    setTerminError((prev) => ({ ...prev, [terminId]: '' }));
    try {
      const res = await fetch(`/api/transactions/termins/${terminId}/pay`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? 'Gagal memproses pembayaran Termin');
      if (!json?.checkout_url) throw new Error('Gagal mendapatkan link pembayaran.');
      window.location.href = json.checkout_url;
    } catch (err) {
      setTerminError((prev) => ({
        ...prev,
        [terminId]: err instanceof Error ? err.message : 'Gagal memproses pembayaran Termin',
      }));
      setTerminBusy(null);
    }
  }

  async function submitBuyerStep(orderId: string, step: OrderFulfillmentStepProgress) {
    const key = buyerStepKey(orderId, step.stepName);
    // Kepemilikan sekarang di level Step (isStepBuyerOwned sudah menggate
    // render form ini) — SEMUA field di step ini milik buyer, bukan disaring
    // per-field lagi (field.filled_by di formSchema sudah tidak dipakai).
    const buyerFields = step.formSchema ?? [];
    for (const field of buyerFields) {
      const fieldValue = buyerFormData[field.key];
      if (field.required && (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim()) || (Array.isArray(fieldValue) && fieldValue.length === 0))) {
        setBuyerStepError((prev) => ({ ...prev, [key]: `Field "${field.label}" wajib diisi` }));
        return;
      }
    }
    setBuyerStepBusy(key);
    setBuyerStepError((prev) => ({ ...prev, [key]: '' }));
    try {
      const formData: Record<string, unknown> = {};
      for (const field of buyerFields) {
        const fieldValue = buyerFormData[field.key];
        if (Array.isArray(fieldValue) ? fieldValue.length > 0 : typeof fieldValue === 'string' && fieldValue.trim()) {
          formData[field.key] = Array.isArray(fieldValue) ? fieldValue : String(fieldValue).trim();
        }
      }
      const res = await fetch(`/api/transactions/${transactionId}/orders/${orderId}/steps/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_name: step.stepName,
          form_data: Object.keys(formData).length ? formData : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? 'Gagal menyelesaikan step ini');
      setBuyerFormOpen(null);
      router.refresh();
    } catch (err) {
      setBuyerStepError((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : 'Gagal menyelesaikan step ini',
      }));
    } finally {
      setBuyerStepBusy(null);
    }
  }

  async function saveBuyerDraft(orderId: string, step: OrderFulfillmentStepProgress) {
    const key = buyerStepKey(orderId, step.stepName);
    setSavingBuyerKey(key);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/orders/${orderId}/steps/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_name: step.stepName, form_data: buyerFormData }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? 'Gagal menyimpan draft');
      setSavedMessage(`${step.stepName} berhasil disimpan.`);
    } catch (err) {
      setBuyerStepError((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : 'Gagal menyimpan draft' }));
    } finally {
      setSavingBuyerKey(null);
    }
  }

  const byFlow = new Map<string, GroupItem[]>();
  for (const item of items) {
    const progress = fulfillment[item.order_id];
    if (!progress) continue;
    const list = byFlow.get(progress.flowName) ?? [];
    list.push({ orderId: item.order_id, productName: item.order?.product?.name ?? 'Produk', progress });
    byFlow.set(progress.flowName, list);
  }

  const groups = Array.from(byFlow.entries()).map(([flowName, groupItems]) => {
    const groupTotal = groupItems.reduce((sum, gi) => {
      const src = items.find((i) => i.order_id === gi.orderId);
      return sum + Number(src?.total_amount ?? 0);
    }, 0);
    return { flowName, items: groupItems, groupTotal };
  });

  if (groups.length === 0) return null;

  function toggleExpanded(flowName: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(flowName)) next.delete(flowName);
      else next.add(flowName);
      return next;
    });
  }

  async function handleConfirm() {
    if (!pending) return;
    setLoading(true);
    setError(null);
    try {
      const path = pending.kind === 'approve-release' ? 'approve-release' : 'dispute';
      await Promise.all(
        pending.orderIds.map(async (orderId) => {
          const res = await fetch(
            `/api/transactions/${transactionId}/orders/${orderId}/steps/${encodeURIComponent(pending.stepName)}/${path}`,
            { method: 'POST' },
          );
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            throw new Error(json?.message ?? 'Gagal memproses aksi ini');
          }
        }),
      );
      setPending(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses aksi ini');
    } finally {
      setLoading(false);
    }
  }

  function handleCancelDialog() {
    if (loading) return;
    setPending(null);
    setError(null);
  }

  const dialogTitle =
    pending?.kind === 'approve-release' ? 'Setujui Pelepasan Dana?' : 'Ajukan Komplain untuk Tahap Ini?';
  const dialogMessage =
    pending?.kind === 'approve-release'
      ? 'Dana untuk tahap ini akan langsung dicairkan ke penjual dan tidak bisa dibatalkan.'
      : 'Penjual tidak bisa lanjut ke tahap berikutnya sampai komplain ini Anda selesaikan sendiri (dengan menyetujui pelepasan dana di bawah kalau masalahnya sudah beres).';

  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
        Progres Pengiriman
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.flowName);
          const groupSteps = buildGroupSteps(group.items);

          return (
            <div
              key={group.flowName}
              className="rounded-xl border p-5"
              style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                    {group.flowName}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    {group.items.length} produk
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleExpanded(group.flowName)}
                  className="text-xs font-semibold underline"
                  style={{ color: 'var(--brand-accent-muted)' }}
                >
                  {isExpanded ? 'Sembunyikan per produk' : 'Lihat per produk'}
                </button>
              </div>

              {!isExpanded ? (
                <ol className="mt-3 flex flex-col gap-2">
                  {groupSteps.map((step) => {
                    const allCompleted = step.completedCount === step.totalCount;
                    const pendingAmountPerItem =
                      step.releasePercentage != null
                        ? (step.releasePercentage / 100) * (group.groupTotal / group.items.length)
                        : null;
                    const pendingAmountTotal =
                      pendingAmountPerItem != null ? pendingAmountPerItem * step.eligibleForRelease.length : null;
                    const anyDisputed = step.items.some((i) => i.step.disputed);
                    const anyReleaseApproved = step.items.some(
                      (i) => i.step.completed && i.step.releasePercentage != null && i.step.releaseApproved,
                    );
                    const sampleFormData = step.items.find(
                      (i) => i.step.formData && Object.keys(i.step.formData).length > 0,
                    )?.step.formData;
                    const disputableItems = step.eligibleForRelease.filter((i) => !i.step.disputed);

                    return (
                      <li
                        key={step.stepName}
                        className="rounded-lg border p-3 text-sm"
                        style={{
                          borderColor: 'var(--brand-border)',
                          opacity: step.completedCount > 0 || step.index === 0 ? 1 : 0.55,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {step.index + 1}. {step.stepName}
                          </span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--brand-accent-muted)' }}>
                            {allCompleted ? '✓ Selesai' : `${step.completedCount}/${step.totalCount} selesai`}
                          </span>
                        </div>
                        {step.description && (
                          <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                            {step.description}
                          </p>
                        )}

                        {!allCompleted && isStepBuyerOwned(step) && (
                          <p className="mt-2 text-xs font-medium" style={{ color: 'var(--brand-accent-muted)' }}>
                            Ada data yang perlu Anda lengkapi di tahap ini — buka &quot;Lihat per produk&quot; di
                            atas.
                          </p>
                        )}

                        {sampleFormData && Object.keys(sampleFormData).length > 0 && (
                          <div className="mt-2 space-y-2 text-xs">
                            {(step.formSchema ?? []).map((f) =>
                              sampleFormData?.[f.key] != null && sampleFormData[f.key] !== '' ? (
                                <div key={f.key}>
                                  <p style={{ color: 'var(--brand-muted)' }}>{f.label}</p>
                                  <FulfillmentFieldValue field={f} value={sampleFormData[f.key]} />
                                </div>
                              ) : null,
                            )}
                          </div>
                        )}

                        {anyDisputed && (
                          <p className="mt-2 text-xs font-medium" style={{ color: 'crimson' }}>
                            Anda sudah mengajukan komplain untuk sebagian/semua produk di tahap ini — buka
                            &quot;Lihat per produk&quot; untuk detail, atau setujui pelepasan dana di bawah kalau
                            masalahnya sudah selesai.
                          </p>
                        )}

                        {step.releasePercentage != null && (
                          anyReleaseApproved && step.eligibleForRelease.length === 0 ? (
                            <p className="mt-2 text-xs font-medium" style={{ color: 'var(--brand-accent-muted)' }}>
                              Dana untuk tahap ini sudah dirilis.
                            </p>
                          ) : step.eligibleForRelease.length > 0 ? (
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPending({
                                      orderIds: step.eligibleForRelease.map((i) => i.orderId),
                                      stepName: step.stepName,
                                      kind: 'approve-release',
                                    })
                                  }
                                  className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95"
                                  style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                                >
                                  Setujui pelepasan dana senilai {formatIDR(pendingAmountTotal ?? 0)}
                                  {step.eligibleForRelease.length > 1
                                    ? ` (${step.eligibleForRelease.length} produk)`
                                    : ''}
                                </button>
                                {disputableItems.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPending({
                                        orderIds: disputableItems.map((i) => i.orderId),
                                        stepName: step.stepName,
                                        kind: 'dispute',
                                      })
                                    }
                                    className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95"
                                    style={{ backgroundColor: 'transparent', color: 'crimson', border: '1px solid crimson' }}
                                  >
                                    Ajukan Komplain
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : null
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="mt-3 flex flex-col gap-4">
                  {group.items.map((gi) => (
                    <div key={gi.orderId}>
                      <p className="text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>
                        {gi.productName}
                      </p>
                      <ol className="mt-2 flex flex-col gap-2">
                        {gi.progress.steps.map((step, index) => {
                          const priorCompleted = gi.progress.steps.slice(0, index).every((s) => s.completed);
                          const pendingAmount =
                            step.releasePercentage != null
                              ? (step.releasePercentage / 100) * group.groupTotal
                              : null;

                          return (
                            <li
                              key={step.stepName}
                              className="rounded-lg border p-3 text-sm"
                              style={{
                                borderColor: 'var(--brand-border)',
                                opacity: step.completed || priorCompleted ? 1 : 0.55,
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  {index + 1}. {step.stepName}
                                </span>
                                {step.completed && (
                                  <span
                                    className="text-xs font-semibold"
                                    style={{ color: 'var(--brand-accent-muted)' }}
                                  >
                                    ✓ Selesai
                                  </span>
                                )}
                              </div>
                              {step.description && (
                                <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                                  {step.description}
                                </p>
                              )}

                              {!step.completed && priorCompleted && isStepBuyerOwned(step) && (() => {
                                const key = buyerStepKey(gi.orderId, step.stepName);
                                const buyerFields = step.formSchema ?? [];
                                return buyerFormOpen === key ? (
                                  <div className="mt-2 flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--brand-border)' }}>
                                    {buyerFields.map((f) => (
                                      <FulfillmentFieldInput
                                        key={f.key}
                                        field={f}
                                        value={buyerFormData[f.key] ?? ''}
                                        onChange={(value) =>
                                          setBuyerFormData((prev) => ({ ...prev, [f.key]: value }))
                                        }
                                      />
                                    ))}
                                    {buyerStepError[key] && (
                                      <p className="text-xs" style={{ color: 'crimson' }}>{buyerStepError[key]}</p>
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setBuyerFormOpen(null)}
                                        className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                                        style={{ border: '1px solid var(--brand-border)' }}
                                      >
                                        Batal
                                      </button>
                                      <button
                                        type="button"
                                        disabled={savingBuyerKey === key || buyerStepBusy === key}
                                        onClick={() => void saveBuyerDraft(gi.orderId, step)}
                                        className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                                        style={{ border: '1px solid var(--brand-border)' }}
                                      >
                                        {savingBuyerKey === key ? 'Menyimpan…' : 'Simpan'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={buyerStepBusy === key}
                                        onClick={() => submitBuyerStep(gi.orderId, step)}
                                        className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                                        style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                                      >
                                        {buyerStepBusy === key ? 'Mengirim…' : 'Kirim'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBuyerFormData(step.formData ?? {});
                                      setBuyerFormOpen(key);
                                    }}
                                    className="mt-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95"
                                    style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                                  >
                                    Lengkapi {step.stepName}
                                  </button>
                                );
                              })()}

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

                              {step.completed &&
                                step.releasePercentage != null &&
                                (step.releaseApproved ? (
                                  <p
                                    className="mt-2 text-xs font-medium"
                                    style={{ color: 'var(--brand-accent-muted)' }}
                                  >
                                    Dana {formatIDR(step.releaseAmount ?? 0)} sudah dirilis
                                    {step.releaseApprovedBy === 'seller_guaranty'
                                      ? ' (otomatis setelah masa garansi lewat tanpa respons Anda)'
                                      : ' (disetujui oleh Anda)'}
                                    .
                                  </p>
                                ) : (
                                  <div className="mt-2 flex flex-col gap-2">
                                    {step.disputed && (
                                      <p className="text-xs font-medium" style={{ color: 'crimson' }}>
                                        Anda sudah mengajukan komplain untuk tahap ini — setujui pelepasan dana di
                                        bawah kalau masalahnya sudah selesai.
                                      </p>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPending({
                                            orderIds: [gi.orderId],
                                            stepName: step.stepName,
                                            kind: 'approve-release',
                                          })
                                        }
                                        className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95"
                                        style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                                      >
                                        Setujui pelepasan dana senilai {formatIDR(pendingAmount ?? 0)}
                                      </button>
                                      {!step.disputed && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPending({
                                              orderIds: [gi.orderId],
                                              stepName: step.stepName,
                                              kind: 'dispute',
                                            })
                                          }
                                          className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95"
                                          style={{
                                            backgroundColor: 'transparent',
                                            color: 'crimson',
                                            border: '1px solid crimson',
                                          }}
                                        >
                                          Ajukan Komplain
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </li>
                          );
                        })}
                      </ol>

                      {gi.progress.termins.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2">
                          {gi.progress.termins.map((termin) => (
                            <div
                              key={termin.id}
                              className="rounded-lg border p-3 text-sm"
                              style={{ borderColor: 'var(--brand-border)' }}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium">
                                  {termin.label}
                                  {termin.anchorStepName && (
                                    <span className="ml-1 text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>
                                      (setelah {termin.anchorStepName})
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs font-semibold" style={{ color: 'var(--brand-accent-muted)' }}>
                                  {formatIDR(termin.amount)}
                                </span>
                              </div>
                              {termin.status === 'PAID' && (
                                <p className="mt-1 text-xs font-medium" style={{ color: 'var(--brand-accent-muted)' }}>
                                  ✓ Sudah dibayar
                                </p>
                              )}
                              {termin.status === 'ISSUED' && (
                                <>
                                  {terminError[termin.id] && (
                                    <p className="mt-1 text-xs" style={{ color: 'crimson' }}>
                                      {terminError[termin.id]}
                                    </p>
                                  )}
                                  <button
                                    type="button"
                                    disabled={terminBusy === termin.id}
                                    onClick={() => payTermin(termin.id)}
                                    className="mt-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                                  >
                                    {terminBusy === termin.id ? 'Memproses…' : 'Bayar'}
                                  </button>
                                </>
                              )}
                              {termin.status === 'SCHEDULED' && (
                                <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                                  Menunggu diterbitkan penjual.
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={dialogTitle}
        message={dialogMessage}
        error={error}
        confirmLabel={pending?.kind === 'approve-release' ? 'Ya, Setujui' : 'Ya, Ajukan Komplain'}
        variant={pending?.kind === 'approve-release' ? 'primary' : 'danger'}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={handleCancelDialog}
      />
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
