/**
 * Dev preview: /templates/barber-classic?preview=1&name=...&c_accent=f59e0b&tf_head=Inter&...
 * Dipakai oleh admin (iframe live preview) & untuk browsing template secara manual.
 * Data katalog memakai sample statis — tenant sungguhan dirender via [website_slug].
 */

import { BarberClassicView } from '../../../components/templates/barber-classic-view';
import { BARBER_SAMPLE_PRODUCTS, BARBER_SAMPLE_SERVICES } from '../../../lib/barber-classic-samples';
import type { CatalogItem, SectionEntry } from '../../../lib/template-data';
import { parseThemeFromSearchParams } from '../../../lib/website-theme';

type SearchParams = Record<string, string | undefined>;

const PREVIEW_SECTIONS: SectionEntry[] = [
  { type: 'hero', content: { subtitle: 'Premium Barbershop', show_whatsapp_cta: true } },
  { type: 'services_grid', content: { title: 'Layanan Kami', filter_type: 'service' } },
  { type: 'products_grid', content: { title: 'Produk Kami', filter_type: 'product' } },
];

function toPreviewCatalog(
  items: typeof BARBER_SAMPLE_SERVICES,
  type: 'service' | 'product',
): CatalogItem[] {
  return items.map((item, index) => ({
    id: `${type}-${index}`,
    type,
    name: item.name,
    slug: `${type}-${index}`,
    description: item.description,
    priceLabel: item.price,
    image: item.image,
  }));
}

export default function BarberClassicTemplate({ searchParams }: { searchParams: SearchParams }) {
  const isPreview = searchParams.preview === '1';
  const websiteTheme = parseThemeFromSearchParams(searchParams);
  const products: CatalogItem[] = [
    ...toPreviewCatalog(BARBER_SAMPLE_SERVICES, 'service'),
    ...toPreviewCatalog(BARBER_SAMPLE_PRODUCTS, 'product'),
  ];

  return (
    <>
      {!isPreview && (
        <a
          href="/"
          className="fixed left-4 top-4 z-20 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/80"
        >
          ← Kembali ke index
        </a>
      )}
      <BarberClassicView
        isPreview={isPreview}
        profile={{
          name: searchParams.name,
          tagline: searchParams.tagline,
          logoUrl: searchParams.logo ?? searchParams.logo_url,
          whatsapp: searchParams.whatsapp,
          phone: searchParams.phone,
          email: searchParams.email,
        }}
        websiteTheme={websiteTheme}
        sections={PREVIEW_SECTIONS}
        products={products}
        locations={[]}
        faqs={[]}
      />
    </>
  );
}
