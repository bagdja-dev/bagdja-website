import type { ReactNode } from 'react';

import type { SectionEntry } from '../../../lib/template-data';
import { SectionMarker } from './section-marker';

/**
 * Bungkus callback `.map()` section di View template sehingga setiap section
 * yang dirender mendapat penanda preview (S8) — satu titik untuk semua View:
 *
 *   sections.filter(...).map(withSectionFrame((section, index) => { switch (section.type) { ... } }))
 *
 * Section yang menghasilkan `null` (data kosong / type tak dikenal) tetap null.
 * Di luar route preview `SectionMarker` hanya meneruskan children.
 */
export function withSectionFrame(
  render: (section: SectionEntry, index: number) => ReactNode,
): (section: SectionEntry, index: number) => ReactNode {
  return function renderFramedSection(section, index) {
    const node = render(section, index);
    if (node === null || node === undefined || node === false) return null;
    return (
      <SectionMarker key={`${section.type}-${index}`} sectionId={section.id} sectionType={section.type}>
        {node}
      </SectionMarker>
    );
  };
}

/** Penanda untuk section yang dirender di luar switch (mis. hero). */
export function SectionFrame({ section, children }: { section?: SectionEntry; children: ReactNode }) {
  return (
    <SectionMarker sectionId={section?.id} sectionType={section?.type ?? 'unknown'}>
      {children}
    </SectionMarker>
  );
}
