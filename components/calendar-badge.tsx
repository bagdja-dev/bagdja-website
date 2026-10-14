'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface CalendarPlanCountRow {
  status: string;
  workflow_step: string;
}

export function CalendarBadge({ href, isLoggedIn, websiteId }: { href: string; isLoggedIn: boolean; websiteId: string }) {
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const response = await fetch(`/api/gathering/plans?website_id=${encodeURIComponent(websiteId)}`, { cache: 'no-store' });
      if (!response.ok) return;
      const plans = await response.json() as CalendarPlanCountRow[];
      setCount(Array.isArray(plans) ? plans.filter((plan) => plan.status === 'PREORDER' && plan.workflow_step === 'PLAN').length : 0);
    } catch {
      // Keep the last known count if the optional badge request fails.
    }
  }, [websiteId]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadCount();
    window.addEventListener('focus', loadCount);
    window.addEventListener('bagdja:gathering-plan-changed', loadCount);
    return () => {
      window.removeEventListener('focus', loadCount);
      window.removeEventListener('bagdja:gathering-plan-changed', loadCount);
    };
  }, [isLoggedIn, loadCount]);

  if (!isLoggedIn) return null;

  return (
    <Link href={href} className="relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:opacity-80" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }} aria-label={`Kalender, ${count} rencana dalam tahap perencanaan`} title="Kalender acara">
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3m8-3v3M4.5 9h15M5.25 5.25h13.5A1.5 1.5 0 0 1 20.25 6.75v12A1.5 1.5 0 0 1 18.75 20.25H5.25a1.5 1.5 0 0 1-1.5-1.5v-12a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 14 2 2 4-4" />
      </svg>
      {count > 0 ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>{count > 99 ? '99+' : count}</span> : null}
    </Link>
  );
}
