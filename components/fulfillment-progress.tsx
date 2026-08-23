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
import type { OrderFulfillmentProgress, OrderFulfillmentStepProgress, TransactionItem } from './order-detail-content';

function formatIDR(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
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

                        {sampleFormData && Object.keys(sampleFormData).length > 0 && (
                          <div className="mt-2 space-y-0.5 text-xs">
                            {(step.formSchema ?? []).map((f) =>
                              sampleFormData?.[f.key] != null && sampleFormData[f.key] !== '' ? (
                                <p key={f.key}>
                                  <span style={{ color: 'var(--brand-muted)' }}>{f.label}:</span>{' '}
                                  {String(sampleFormData?.[f.key])}
                                </p>
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
    </section>
  );
}
