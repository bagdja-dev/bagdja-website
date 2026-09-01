/**
 * Template: Workshop
 *
 * Phase 2 shell: theme variables, industrial visual language, responsive
 * navigation/hero, and section slots. Detailed section implementations are
 * added in Phase 3.
 */

import {
  buildPageHref,
  buildCategoryHref,
  buildProductHref,
  buildWhatsAppHref,
  parseGalleryImages,
  type BlogPostItem,
  type CatalogItem,
  type CategoryItem,
  type FaqItem,
  type LocationItem,
  type NavPage,
  type PaymentMetaEntry,
  type SectionEntry,
} from '../../../lib/template-data';
import type { CSSProperties } from 'react';
import { PurchaseControls } from '../../purchase-controls';
import {
  getGoogleFontsUrl,
  resolveTheme,
  themeToCssVariables,
  type WebsiteTheme,
} from '../../../lib/website-theme';

export interface WorkshopViewProps {
  isPreview: boolean;
  profile: {
    name?: string;
    tagline?: string;
    logoUrl?: string;
    whatsapp?: string;
    phone?: string;
    email?: string;
    socialLinks?: Record<string, unknown>;
  };
  templateTheme?: WebsiteTheme;
  websiteTheme?: WebsiteTheme;
  sections: SectionEntry[];
  products: CatalogItem[];
  categories?: CategoryItem[];
  locations: LocationItem[];
  faqs: FaqItem[];
  websiteSlug?: string;
  tenantSlug?: string;
  pages?: NavPage[];
  blogPosts?: BlogPostItem[];
  auth?: {
    isLoggedIn: boolean;
    username?: string;
    email?: string;
    avatar?: string;
    loginHref?: string;
    logoutHref?: string;
    cartHref?: string;
    ordersHref?: string;
    profileHref?: string;
  };
}

function getString(content: Record<string, unknown>, key: string): string | undefined {
  const value = content[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isCatalogItem(value: unknown): value is CatalogItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.slug === 'string';
}

function WorkshopBrand({ name, homeHref }: { name: string; homeHref: string }) {
  return (
    <a href={homeHref} className="flex items-center gap-3 font-bold tracking-tight">
      <span className="relative h-8 w-8 shrink-0 bg-[var(--brand-text)]" aria-hidden="true">
        <span className="absolute left-1.5 top-2 h-1 w-5 bg-[var(--brand-accent)]" />
        <span className="absolute left-1.5 top-4.5 h-1 w-3 bg-[var(--brand-warning)]" />
      </span>
      <span className="text-lg">{name}</span>
    </a>
  );
}

function WorkshopHeader({
  name,
  homeHref,
  pages,
  waHref,
}: {
  name: string;
  homeHref: string;
  pages: NavPage[];
  waHref?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-[var(--brand-bg)]/95 backdrop-blur" style={{ borderColor: 'var(--brand-border)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <WorkshopBrand name={name} homeHref={homeHref} />
        <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--brand-muted)] md:flex" aria-label="Navigasi utama">
          {pages.filter((page) => page.placement === 'header' || page.placement === 'regular').slice(0, 5).map((page) => (
            <a key={page.slug} href={buildPageHref(homeHref === '/' ? '' : homeHref, page)} className="transition-colors hover:text-[var(--brand-text)]">
              {page.title}
            </a>
          ))}
        </nav>
        {waHref ? (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="hidden border-2 px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-[var(--brand-text)] hover:text-[var(--brand-bg)] sm:inline-flex" style={{ borderColor: 'var(--brand-text)' }}>
            Konsultasi
          </a>
        ) : null}
      </div>
    </header>
  );
}

function WorkshopHero({ tagline, content, waHref }: { tagline: string; content: Record<string, unknown>; waHref?: string }) {
  const subtitle = getString(content, 'subtitle') ?? 'KONSTRUKSI BAJA · WELDING · ALUMINIUM';
  const headline = getString(content, 'headline') ?? 'Dibangun untuk bertahan.';
  const lede = getString(content, 'lede') ?? tagline;
  const stats = Array.isArray(content.stats)
    ? content.stats.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];

  return (
    <section className="relative overflow-hidden bg-[var(--brand-text)] text-[var(--brand-bg)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-0 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div className="pb-12">
          <p className="font-mono text-xs font-bold tracking-[0.18em] text-[var(--brand-warning)]">{subtitle}</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl" style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}>
            {headline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">{lede}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {waHref ? <a href={waHref} target="_blank" rel="noopener noreferrer" className="border-2 px-5 py-3 text-sm font-bold text-[var(--brand-on-accent)]" style={{ backgroundColor: 'var(--brand-accent)', borderColor: 'var(--brand-accent)' }}>Mulai Konsultasi</a> : null}
            <a href="#layanan" className="border-2 border-white/40 px-5 py-3 text-sm font-bold text-white hover:border-white">Lihat Layanan</a>
          </div>
          {stats.length > 0 ? (
            <div className="mt-12 grid max-w-xl grid-cols-3 border-t border-white/20 pt-5">
              {stats.slice(0, 3).map((stat, index) => (
                <div key={index} className="border-r border-white/20 pr-3 last:border-0">
                  <strong className="block text-2xl text-[var(--brand-warning)]">{typeof stat.value === 'string' ? stat.value : '-'}</strong>
                  <span className="mt-1 block text-xs text-white/60">{typeof stat.label === 'string' ? stat.label : ''}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative hidden min-h-[300px] overflow-hidden border-l-8 border-[var(--brand-accent)] bg-[linear-gradient(120deg,#4a5259_25%,#454d53_25%,#454d53_50%,#4a5259_50%,#4a5259_75%,#454d53_75%)] bg-[length:52px_52px] lg:block">
          <span className="absolute bottom-5 right-5 font-mono text-xs text-white/70">BUILT TO LAST</span>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ title, subtitle }: { title?: string; subtitle?: string }) {
  if (!title && !subtitle) return null;
  return (
    <div className="mb-8">
      {title ? <h2 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}>{title}</h2> : null}
      {subtitle ? <p className="mt-2 max-w-2xl text-sm text-[var(--brand-muted)]">{subtitle}</p> : null}
    </div>
  );
}

function WorkshopFeatures({ content }: { content: Record<string, unknown> }) {
  const title = getString(content, 'title');
  const features = [1, 2, 3, 4].map((n) => ({
    icon: getString(content, `feature_${n}_icon`) ?? `0${n}`,
    title: getString(content, `feature_${n}_title`),
    desc: getString(content, `feature_${n}_desc`),
  })).filter((item) => item.title);
  if (!features.length) return null;
  return <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><SectionHeading title={title} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{features.map((item) => <article key={item.title} className="border p-5" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}><span className="font-mono text-sm font-bold text-[var(--brand-accent)]">{item.icon}</span><h3 className="mt-6 font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{item.title}</h3>{item.desc ? <p className="mt-2 text-sm text-[var(--brand-muted)]">{item.desc}</p> : null}</article>)}</div></section>;
}

function WorkshopCategories({ categories, websiteSlug, content }: { categories: CategoryItem[]; websiteSlug?: string; content: Record<string, unknown> }) {
  if (!categories.length) return null;
  const title = getString(content, 'title');
  return <section className="bg-[var(--brand-surface)] py-14"><div className="mx-auto max-w-6xl px-4 sm:px-6"><SectionHeading title={title} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category) => <a key={category.id} href={websiteSlug !== undefined ? buildCategoryHref(websiteSlug, category.label) : '#'} className="border p-5 font-bold transition-colors hover:bg-[var(--brand-accent)] hover:text-[var(--brand-on-accent)]" style={{ borderColor: 'var(--brand-border)' }}>{category.label}<span className="mt-3 block font-mono text-xs font-normal opacity-60">LIHAT KATEGORI →</span></a>)}</div></div></section>;
}

function WorkshopServices({ products, websiteSlug, content }: { products: CatalogItem[]; websiteSlug?: string; content: Record<string, unknown> }) {
  const services = products.filter((item) => item.type === 'service' && !item.parentProductId);
  if (!services.length) return null;
  return <section id="layanan" className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><SectionHeading title={getString(content, 'title')} /><div className="grid gap-4 sm:grid-cols-2">{services.map((item) => <a key={item.id} href={websiteSlug !== undefined ? buildProductHref(websiteSlug, item.slug) : '#'} className="group border p-5 transition-colors hover:border-[var(--brand-accent)]" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}><div className="flex items-start justify-between gap-4"><h3 className="font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{item.name}</h3><span className="font-mono text-xs text-[var(--brand-accent)]">{item.priceLabel || 'KONSULTASI'}</span></div>{item.description ? <p className="mt-3 text-sm text-[var(--brand-muted)]">{item.description}</p> : null}<span className="mt-5 block font-mono text-xs text-[var(--brand-accent)] opacity-0 transition-opacity group-hover:opacity-100">DETAIL LAYANAN →</span></a>)}</div></section>;
}

function WorkshopProcess({ content }: { content: Record<string, unknown> }) {
  const raw = Array.isArray(content.flow_steps)
    ? content.flow_steps
    : Array.isArray(content.preview_steps)
      ? content.preview_steps
      : [];
  const steps = raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  if (!steps.length) return null;
  return <section className="bg-[var(--brand-text)] py-14 text-[var(--brand-bg)]"><div className="mx-auto max-w-6xl px-4 sm:px-6"><SectionHeading title={getString(content, 'title')} subtitle={getString(content, 'subtitle')} /><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <article key={index} className="border-t border-white/20 pt-4"><span className="font-mono text-sm text-[var(--brand-warning)]">{getString(step, 'number') ?? `0${index + 1}`}</span><h3 className="mt-5 font-bold">{getString(step, 'title') ?? 'Langkah proyek'}</h3><p className="mt-2 text-sm text-white/60">{getString(step, 'body')}</p></article>)}</div></div></section>;
}

function WorkshopGallery({ content }: { content: Record<string, unknown> }) {
  const images = parseGalleryImages(content.images);
  if (!images.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <SectionHeading title={getString(content, 'title')} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image) => (
          <figure key={image.url} className="overflow-hidden border" style={{ borderColor: 'var(--brand-border)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.alt ?? ''} className="aspect-[4/3] w-full object-cover" loading="lazy" />
            {image.caption ? <figcaption className="p-3 text-xs text-[var(--brand-muted)]">{image.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </section>
  );
}

function WorkshopAbout({ content }: { content: Record<string, unknown> }) {
  const body = getString(content, 'body');
  const bullets = Array.isArray(content.bullets) ? content.bullets.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
  if (!body && !bullets.length) return null;
  return <section className="bg-[var(--brand-surface)] py-14"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="max-w-2xl"><SectionHeading title={getString(content, 'title')} />{body ? <p className="leading-relaxed text-[var(--brand-muted)]">{body}</p> : null}{bullets.length ? <ul className="mt-6 space-y-3 text-sm">{bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span className="text-[var(--brand-accent)]">■</span>{bullet}</li>)}</ul> : null}</div></div></section>;
}

function WorkshopTestimonials({ content }: { content: Record<string, unknown> }) {
  const items = Array.isArray(content.items) ? content.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
  if (!items.length) return null;
  return <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><SectionHeading title={getString(content, 'title')} /><div className="grid gap-4 md:grid-cols-2">{items.map((item, index) => <blockquote key={index} className="border-l-4 p-5" style={{ borderColor: 'var(--brand-accent)', backgroundColor: 'var(--brand-surface)' }}><p className="text-lg leading-relaxed">“{getString(item, 'quote')}”</p><footer className="mt-5 font-mono text-xs text-[var(--brand-muted)]">{[getString(item, 'context'), getString(item, 'location')].filter(Boolean).join(' · ')}</footer></blockquote>)}</div></section>;
}

function WorkshopFaq({ faqs, content }: { faqs: FaqItem[]; content: Record<string, unknown> }) {
  if (!faqs.length) return null;
  return <section className="bg-[var(--brand-surface)] py-14"><div className="mx-auto max-w-3xl px-4 sm:px-6"><SectionHeading title={getString(content, 'title')} />{faqs.map((faq) => <details key={faq.id} className="border-t py-4" style={{ borderColor: 'var(--brand-border)' }}><summary className="cursor-pointer font-bold">{faq.question}</summary><p className="mt-3 text-sm leading-relaxed text-[var(--brand-muted)]">{faq.answer}</p></details>)}</div></section>;
}

function WorkshopContact({ content, waHref, locations }: { content: Record<string, unknown>; waHref?: string; locations: LocationItem[] }) {
  const location = locations.find((item) => item.isPrimary) ?? locations[0];
  return <section className="bg-[var(--brand-accent)] py-14 text-[var(--brand-on-accent)]"><div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-end md:justify-between"><div><SectionHeading title={getString(content, 'title')} subtitle={getString(content, 'subtitle')} />{location ? <p className="text-sm opacity-80">{[location.addressLine, location.city].filter(Boolean).join(', ')}</p> : null}</div>{waHref ? <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex border-2 border-current px-5 py-3 text-sm font-bold">KIRIM KEBUTUHAN PROYEK →</a> : null}</div></section>;
}

function WorkshopPaymentLink({ entry }: { entry: PaymentMetaEntry }) {
  if (entry.payment_mode !== 'LYNK' || !entry.payment_link) return null;
  return <a href={entry.payment_link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex border-2 px-5 py-3 text-sm font-bold" style={{ borderColor: 'var(--brand-accent)', color: 'var(--brand-accent)' }}>Beli via Lynk</a>;
}

function WorkshopProductDetail({ item, allProducts, websiteSlug, tenantSlug, waHref }: { item: CatalogItem; allProducts: CatalogItem[]; websiteSlug?: string; tenantSlug?: string; waHref?: string }) {
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];
  const familyId = item.parentProductId ?? item.id;
  const family = allProducts.filter((product) => product.id === familyId || product.parentProductId === familyId);
  const internalPaymentMode = (item.paymentMeta ?? []).find((entry) => entry.payment_mode === 'ADD_TO_CART' || entry.payment_mode === 'ESCROW')?.payment_mode as 'ADD_TO_CART' | 'ESCROW' | undefined;
  const related = allProducts.filter((product) => product.id !== item.id && !product.parentProductId && (product.type === item.type || product.category === item.category)).slice(0, 4);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="overflow-hidden border" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
              {images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[0]} alt={item.name} className="aspect-square w-full object-cover" />
              ) : <div className="flex aspect-square items-center justify-center font-mono text-sm text-[var(--brand-muted)]">NO IMAGE</div>}
            </div>
            {images.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {images.slice(1, 5).map((image) => (
                  <div key={image}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="aspect-square w-full border object-cover" style={{ borderColor: 'var(--brand-border)' }} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--brand-accent)]">{item.category ?? 'LAYANAN WORKSHOP'}</p>
            <h1 className="mt-3 text-3xl font-bold sm:text-5xl" style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}>{item.name}</h1>
            {item.priceLabel ? <p className="mt-5 text-xl font-bold text-[var(--brand-accent)]">{item.priceLabel}</p> : null}
            {item.description ? <p className="mt-5 leading-relaxed text-[var(--brand-muted)]">{item.description}</p> : null}
            {family.length > 1 ? <div className="mt-7"><p className="text-xs font-bold uppercase tracking-wide">Pilihan varian</p><div className="mt-3 flex flex-wrap gap-2">{family.map((variant) => <a key={variant.id} href={websiteSlug !== undefined ? buildProductHref(websiteSlug, variant.slug) : '#'} className={`border px-3 py-2 text-xs ${variant.id === item.id ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-on-accent)]' : ''}`} style={variant.id === item.id ? undefined : { borderColor: 'var(--brand-border)' }}>{variant.name}</a>)}</div></div> : null}
            {tenantSlug && internalPaymentMode && item.websiteId ? <PurchaseControls slug={tenantSlug} websiteId={item.websiteId} product={{ id: item.id, slug: item.slug, name: item.name, price: Number(item.priceLabel.replace(/[^\d]/g, '')) || 0, image: item.image, stock: item.stock }} paymentMode={internalPaymentMode} /> : null}
            {waHref ? <a href={waHref} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex border-2 px-5 py-3 text-sm font-bold" style={{ backgroundColor: 'var(--brand-accent)', borderColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>Konsultasi via WhatsApp</a> : null}
            {item.paymentMeta?.map((entry, index) => <WorkshopPaymentLink key={`${entry.payment_mode}-${index}`} entry={entry} />)}
            {item.detail ? <details className="mt-8 border p-5" open style={{ borderColor: 'var(--brand-border)' }}><summary className="cursor-pointer font-bold">Detail dan spesifikasi</summary><div className="mt-4 text-sm leading-relaxed text-[var(--brand-muted)] [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-3" dangerouslySetInnerHTML={{ __html: item.detail }} /></details> : null}
          </div>
        </div>
      </section>
      {related.length ? <section className="bg-[var(--brand-surface)] py-14"><div className="mx-auto max-w-6xl px-4 sm:px-6"><SectionHeading title="Layanan lainnya" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{related.map((product) => <a key={product.id} href={websiteSlug !== undefined ? buildProductHref(websiteSlug, product.slug) : '#'} className="border p-5" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}><h3 className="font-bold">{product.name}</h3><p className="mt-2 text-xs text-[var(--brand-muted)]">{product.priceLabel || 'KONSULTASI'}</p></a>)}</div></div></section> : null}
    </>
  );
}

export function WorkshopView({
  isPreview,
  profile,
  templateTheme = {},
  websiteTheme = {},
  sections,
  products,
  categories = [],
  locations,
  faqs,
  websiteSlug,
  tenantSlug,
  pages = [],
}: WorkshopViewProps) {
  const name = profile.name?.trim() || 'Workshop Anda';
  const tagline = profile.tagline?.trim() || 'Solusi konstruksi dan fabrikasi custom.';
  const resolved = resolveTheme(templateTheme, websiteTheme);
  const cssVars = themeToCssVariables(resolved);
  const fontsUrl = getGoogleFontsUrl(resolved.typography);
  const heroSection = sections.find((section) => section.type === 'hero');
  const productDetailItem = sections.find((section) => section.type === 'product_detail')?.content.product;
  const homeHref = websiteSlug !== undefined ? websiteSlug || '/' : '#';
  const waHref = buildWhatsAppHref(profile.whatsapp);

  return (
    <>
      {fontsUrl ? <link rel="stylesheet" href={fontsUrl} /> : null}
      <div
        className="min-h-screen"
        style={{
          ...cssVars,
          '--brand-warning': '#f2b705',
          backgroundColor: 'var(--brand-bg)',
          color: 'var(--brand-text)',
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-body-weight)',
        } as CSSProperties}
      >
        <WorkshopHeader name={name} homeHref={homeHref} pages={pages} waHref={waHref} />
        {isCatalogItem(productDetailItem) ? (
          <WorkshopProductDetail item={productDetailItem} allProducts={products} websiteSlug={websiteSlug} tenantSlug={tenantSlug} waHref={waHref} />
        ) : <WorkshopHero tagline={tagline} content={heroSection?.content ?? {}} waHref={waHref} />}
        {!productDetailItem && sections.filter((section) => section.type !== 'hero').map((section, index) => {
          const key = `${section.type}-${index}`;
          switch (section.type) {
            case 'features_grid': return <WorkshopFeatures key={key} content={section.content} />;
            case 'category_grid': return <WorkshopCategories key={key} categories={categories} websiteSlug={websiteSlug} content={section.content} />;
            case 'services_grid': return <WorkshopServices key={key} products={products} websiteSlug={websiteSlug} content={section.content} />;
            case 'service_process_section': return <WorkshopProcess key={key} content={section.content} />;
            case 'gallery': return <WorkshopGallery key={key} content={section.content} />;
            case 'about': return <WorkshopAbout key={key} content={section.content} />;
            case 'testimonial': return <WorkshopTestimonials key={key} content={section.content} />;
            case 'faq_list': return <WorkshopFaq key={key} faqs={faqs} content={section.content} />;
            case 'contact': return <WorkshopContact key={key} content={section.content} waHref={waHref} locations={locations} />;
            default: return null;
          }
        })}
        <footer className="border-t px-4 py-8 text-center text-xs text-[var(--brand-muted)]" style={{ borderColor: 'var(--brand-border)' }}>
          © {new Date().getFullYear()} {name}. Dibangun dengan presisi.
          {isPreview ? ' Preview template.' : ''}
        </footer>
      </div>
    </>
  );
}
