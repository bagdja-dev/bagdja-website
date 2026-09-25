'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

import { getChatReferenceLabel, resolveChatReferenceHref, type ChatReference } from './chat-reference';

export function ChatReferenceCard({
  reference,
  basePath = '',
  extra,
}: {
  reference: ChatReference;
  basePath?: string;
  extra?: ReactNode;
}) {
  const router = useRouter();
  const href = resolveChatReferenceHref(reference, basePath);
  const label = getChatReferenceLabel(reference.type);

  const card = (
    <div className="min-w-48">
      <p className="text-[10px] uppercase tracking-wide opacity-70">Referensi {label}</p>
      {reference.imageUrl && <img src={reference.imageUrl} alt="" className="mt-2 h-20 w-full rounded-lg object-cover" />}
      <p className="mt-2 font-semibold">{reference.title}</p>
      {reference.meta && <p className="mt-1 text-xs opacity-70">{reference.meta}</p>}
      {href ? <span className="mt-2 inline-block text-xs font-semibold underline">Lihat {label}</span> : null}
      {extra}
    </div>
  );

  if (!href) return card;
  const targetHref = href;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (/^https?:\/\//i.test(targetHref)) {
      window.location.assign(targetHref);
      return;
    }
    router.push(targetHref);
  }

  const className = 'block min-w-48 cursor-pointer transition-opacity hover:opacity-90';

  if (/^https?:\/\//i.test(targetHref)) {
    return (
      <a href={targetHref} onClick={handleClick} className={className}>
        {card}
      </a>
    );
  }

  return (
    <Link href={targetHref} onClick={handleClick} className={className}>
      {card}
    </Link>
  );
}
