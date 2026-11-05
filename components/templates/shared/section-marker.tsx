'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { PREVIEW_SECTION_ATTR } from '../../../lib/preview-protocol';

/**
 * `true` hanya di dalam shell route preview Studio (`components/preview/preview-shell.tsx`).
 * Route publik tidak memasang provider → penanda tidak dirender sama sekali,
 * markup publik identik dengan sebelum S8.
 */
export const SectionMarkersContext = createContext(false);

interface SectionMarkerProps {
  sectionId?: string;
  sectionType: string;
  children: ReactNode;
}

/**
 * Penanda section level host (protokol preview v1). `display: contents` supaya
 * tidak membuat box baru (layout/spacing section tidak berubah); outline &
 * scroll dihitung dari elemen anak oleh shell preview.
 */
export function SectionMarker({ sectionId, sectionType, children }: SectionMarkerProps) {
  const enabled = useContext(SectionMarkersContext);
  if (!enabled || !sectionId) return <>{children}</>;

  return (
    <div {...{ [PREVIEW_SECTION_ATTR]: sectionId }} data-bagdja-section-type={sectionType} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
