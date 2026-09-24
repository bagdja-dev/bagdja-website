'use client';

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
  formatIDR,
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
import { useState, type CSSProperties } from 'react';
import { PurchaseControls } from '../../purchase-controls';
import { CartContent } from '../../cart-content';
import { CheckoutContent } from '../../checkout-content';
import { OrdersContent } from '../../orders-content';
import { TagihanContent } from '../../tagihan-content';
import { ProfileContent } from '../../profile-content';
import { OrderDetailContent, type OrderDetail, type TransactionDetail } from '../../order-detail-content';
import { StoreClassicHeader, type HeaderNavLink } from '../store-classic/store-classic-header';
import {
  getGoogleFontsUrl,
  resolveTheme,
  themeToCssVariables,
  type WebsiteTheme,
} from '../../../lib/website-theme';
import { resolvePageHeadingLabel } from '../../../lib/page-title';

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
  auth?: {
    isLoggedIn: boolean;
    username?: string;
    email?: string;
    avatar?: string;
    loginHref?: string;
    logoutHref?: string;
    cartHref?: string;
    ordersHref?: string;
    tagihanHref?: string;
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

function WorkshopProductBanner({ label, imageUrl }: { label: string; imageUrl?: string }) {
  return (
    <section
      className="relative flex items-center justify-center overflow-hidden px-4 py-16 text-center sm:py-20"
      style={imageUrl ? undefined : { backgroundColor: 'var(--brand-accent)' }}
    >
      {imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      <h1
        className="relative z-10 text-3xl font-bold sm:text-5xl"
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 'var(--font-heading-weight)',
          color: imageUrl ? '#fff' : 'var(--brand-on-accent)',
        }}
      >
        {label}
      </h1>
    </section>
  );
}

function WorkshopHero({ tagline, content, waHref }: { tagline: string; content: Record<string, unknown>; waHref?: string }) {
  const subtitle = getString(content, 'subtitle') ?? 'KONSTRUKSI BAJA · WELDING · ALUMINIUM';
  const headline = getString(content, 'headline') ?? 'Dibangun untuk bertahan.';
  const lede = getString(content, 'lede') ?? tagline;
  const heroImage = typeof content.image_url === 'string' && content.image_url.trim()
    ? content.image_url.trim()
    : Array.isArray(content.images)
      ? parseGalleryImages(content.images)[0]?.url
      : undefined;
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
            {waHref ? <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex w-full flex-1 justify-center rounded-full border-2 px-5 py-3 text-center text-sm font-bold text-[var(--brand-on-accent)]" style={{ backgroundColor: 'var(--brand-accent)', borderColor: 'var(--brand-accent)' }}>Mulai Konsultasi</a> : null}
            <a href="#layanan" className="border-2 border-white/40 px-5 py-3 text-center text-sm font-bold text-white hover:border-white">Lihat Layanan</a>
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
        <div className="relative hidden min-h-[300px] overflow-hidden border-l-8 border-[var(--brand-accent)] lg:block">
          {heroImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImage} alt={headline} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/20" />
            </>
          ) : (
            <div className="h-full w-full bg-[linear-gradient(120deg,#4a5259_25%,#454d53_25%,#454d53_50%,#4a5259_50%,#4a5259_75%,#454d53_75%)] bg-[length:52px_52px]" />
          )}
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

function pickCategoryImage(category: CategoryItem): string | undefined {
  const images = category.images?.filter(Boolean) ?? [];
  if (!images.length) return undefined;

  let hash = 0;
  for (let i = 0; i < category.id.length; i += 1) {
    hash = category.id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % images.length;
  return images[index];
}

function WorkshopCategories({ categories, websiteSlug, content }: { categories: CategoryItem[]; websiteSlug?: string; content: Record<string, unknown> }) {
  if (!categories.length) return null;
  const title = getString(content, 'title');
  return (
    <section className="bg-[var(--brand-surface)] py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={title} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const imageUrl = pickCategoryImage(category);
            return (
              <a
                key={category.id}
                href={websiteSlug !== undefined ? buildCategoryHref(websiteSlug, category.label) : '#'}
                className="group overflow-hidden border transition-colors hover:border-[var(--brand-accent)]"
                style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
              >
                {imageUrl ? (
                  <div className="overflow-hidden border-b" style={{ borderColor: 'var(--brand-border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={category.label}
                      className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : null}
                <div className="p-5">
                  <h3 className="font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{category.label}</h3>
                  <span className="mt-3 block font-mono text-xs font-normal opacity-60">LIHAT KATEGORI →</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkshopServices({ products, websiteSlug, content }: { products: CatalogItem[]; websiteSlug?: string; content: Record<string, unknown> }) {
  const services = products.filter((item) => item.type === 'service' && !item.parentProductId);
  if (!services.length) return null;
  return (
    <section id="layanan" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <SectionHeading title={getString(content, 'title')} />
      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((item) => {
          const imageUrl = item.images?.[0] ?? item.image;
          return (
            <a
              key={item.id}
              href={websiteSlug !== undefined ? buildProductHref(websiteSlug, item.slug) : '#'}
              className="group overflow-hidden border transition-colors hover:border-[var(--brand-accent)]"
              style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}
            >
              {imageUrl ? (
                <div className="overflow-hidden border-b" style={{ borderColor: 'var(--brand-border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={item.name} className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
              ) : null}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {item.category ? (
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brand-accent)]">{item.category}</p>
                    ) : null}
                    <h3 className="mt-2 font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{item.name}</h3>
                  </div>
                  <span className="font-mono text-xs text-[var(--brand-accent)]">{item.priceLabel || 'KONSULTASI'}</span>
                </div>
                {item.description ? <p className="mt-3 text-sm text-[var(--brand-muted)]">{item.description}</p> : null}
                <span className="mt-5 block font-mono text-xs text-[var(--brand-accent)] opacity-0 transition-opacity group-hover:opacity-100">DETAIL LAYANAN →</span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function WorkshopCategoryListing({
  category,
  label,
  products,
  websiteSlug,
}: {
  category?: CategoryItem;
  label: string;
  products: CatalogItem[];
  websiteSlug?: string;
}) {
  const description = category?.description?.trim();
  const categoryImage = category ? pickCategoryImage(category) : undefined;
  const specificationEntries = Object.entries(category?.specifications ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && String(value).trim() !== '',
  );
  const estimationEntries = Array.isArray(category?.estimation)
    ? category!.estimation.filter((entry) => entry && typeof entry.label === 'string' && entry.label.trim() !== '')
    : [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="overflow-hidden rounded-[1.6rem] border border-[var(--brand-accent)] bg-[#11151a]">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-accent)] sm:text-xs">
              {label.toUpperCase()} • KATEGORI
            </p>

            <h1
              className="mt-5 max-w-[11ch] text-[clamp(3.25rem,5.5vw,7.5rem)] font-black leading-[0.9] tracking-[-0.06em] text-white"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
            >
              {label}
            </h1>

            {!description ? (
              <p className="mt-4 text-base text-white/75 sm:text-lg">Jasa kanopi dan atap Indonesia.</p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={websiteSlug !== undefined ? buildProductHref(websiteSlug, label.toLowerCase().replace(/\s+/g, '-')) : '#layanan'}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-accent)] px-6 py-4 text-center text-base font-bold text-white shadow-lg shadow-[var(--brand-accent)]/30 transition-transform hover:-translate-y-0.5"
              >
                Mulai Konsultasi
              </a>
              <a
                href="#layanan"
                className="inline-flex items-center justify-center rounded-xl border border-white/35 bg-transparent px-6 py-4 text-center text-base font-bold text-white transition-colors hover:border-white/60 hover:bg-white/5"
              >
                Lihat Layanan
              </a>
            </div>
          </div>

          <div className="relative min-h-[320px] border-t border-[var(--brand-accent)] lg:min-h-[100%] lg:border-l-8 lg:border-t-0">
            {categoryImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={categoryImage} alt={label} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,21,26,0.05),rgba(17,21,26,0.22))]" />
              </>
            ) : (
              <div className="h-full w-full bg-[linear-gradient(120deg,#4a5259_25%,#454d53_25%,#454d53_50%,#4a5259_50%,#4a5259_75%,#454d53_75%)] bg-[length:52px_52px]" />
            )}

            <span className="absolute bottom-4 right-4 font-mono text-[10px] uppercase tracking-[0.3em] text-white/75 sm:text-xs">
              BUILT TO LAST
            </span>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div
          className="rounded-[1.25rem] border p-4 sm:p-5"
          style={{
            borderColor: 'var(--brand-border)',
            backgroundColor: 'rgba(255,255,255,0.03)',
          }}
        >
          {description ? (
            <>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.26em] text-[var(--brand-accent)]">DESKRIPSI</p>
              <p className="text-base leading-relaxed text-[var(--brand-muted)] sm:text-lg">{description}</p>
            </>
          ) : null}

          {!description && specificationEntries.length > 0 ? (
            <>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.26em] text-[var(--brand-accent)]">SPESIFIKASI</p>
              <dl className="space-y-3 text-sm">
                {specificationEntries.map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--brand-border)' }}>
                    <dt className="min-w-[7rem] pr-3 text-[var(--brand-muted)]">{key}</dt>
                    <dd className="text-right font-medium text-[var(--brand-text)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}

          {description && specificationEntries.length > 0 ? (
            <div className="mt-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.26em] text-[var(--brand-accent)]">SPESIFIKASI</p>
              <dl className="space-y-3 text-sm">
                {specificationEntries.map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--brand-border)' }}>
                    <dt className="min-w-[7rem] pr-3 text-[var(--brand-muted)]">{key}</dt>
                    <dd className="text-right font-medium text-[var(--brand-text)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {estimationEntries.length > 0 && (
            <div className="mt-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.26em] text-[var(--brand-accent)]">ESTIMASI HARGA</p>
              <div className="space-y-2 text-sm">
                {estimationEntries.map((entry, index) => {
                  const numericPrice = typeof entry.price === 'number' ? entry.price : Number(String(entry.price).replace(/[^\d.-]/g, '')) || 0;
                  return (
                    <div key={`${entry.label}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--brand-border)' }}>
                      <span>{entry.label}</span>
                      <strong className="text-[var(--brand-accent)]">{formatIDR(numericPrice)}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[1.25rem] border p-4 sm:p-5" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--brand-accent)]">PRODUK &amp; LAYANAN</p>

          {products.length === 0 ? (
            <div className="mt-6 flex min-h-[180px] items-center justify-center rounded-[1.2rem] border border-dashed" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <p className="text-sm text-[var(--brand-muted)]">Belum ada item di kategori ini.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {products.slice(0, 4).map((item) => {
                const imageUrl = item.images?.[0] ?? item.image;
                const shortDescription = item.description?.trim() || 'Layanan dengan spesifikasi yang sesuai kebutuhan proyek Anda.';

                return (
                  <a
                    key={item.id}
                    href={websiteSlug !== undefined ? buildProductHref(websiteSlug, item.slug) : '#'}
                    className="group flex gap-3 overflow-hidden rounded-[1rem] border p-2 transition-colors hover:border-[var(--brand-accent)]"
                    style={{ borderColor: 'var(--brand-border)', backgroundColor: 'rgba(255,255,255,0.12)' }}
                  >
                    {imageUrl ? (
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--brand-border)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      </div>
                    ) : null}

                    <div className="min-w-0 flex-1 py-1">
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--brand-accent)]">{item.type}</p>
                      <h3 className="mt-1 text-base font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{item.name}</h3>
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[var(--brand-muted)]">{shortDescription}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-[var(--brand-accent)]">{item.priceLabel || 'Konsultasi'}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wide opacity-60">Detail →</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
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
  return <section className="bg-[var(--brand-accent)] py-14 text-[var(--brand-on-accent)]"><div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-end md:justify-between"><div><SectionHeading title={getString(content, 'title')} subtitle={getString(content, 'subtitle')} />{location ? <p className="text-sm opacity-80">{[location.addressLine, location.city].filter(Boolean).join(', ')}</p> : null}</div>{waHref ? <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex w-full flex-1 justify-center rounded-full border-2 border-current px-5 py-3 text-center text-sm font-bold">KIRIM KEBUTUHAN PROYEK →</a> : null}</div></section>;
}

function WorkshopPaymentLink({ entry }: { entry: PaymentMetaEntry }) {
  if (entry.payment_mode !== 'LYNK' || !entry.payment_link) return null;
  return <a href={entry.payment_link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex border-2 px-5 py-3 text-sm font-bold" style={{ borderColor: 'var(--brand-accent)', color: 'var(--brand-accent)' }}>Beli via Lynk</a>;
}

function WorkshopProductDetail({ item, allProducts, locations, websiteSlug, tenantSlug, waHref }: { item: CatalogItem; allProducts: CatalogItem[]; locations: LocationItem[]; websiteSlug?: string; tenantSlug?: string; waHref?: string }) {
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];
  const familyId = item.parentProductId ?? item.id;
  const family = allProducts.filter((product) => product.id === familyId || product.parentProductId === familyId);
  const internalPaymentMode = (item.paymentMeta ?? []).find((entry) => entry.payment_mode === 'ADD_TO_CART' || entry.payment_mode === 'ESCROW')?.payment_mode as 'ADD_TO_CART' | 'ESCROW' | undefined;
  const related = allProducts.filter((product) => product.id !== item.id && !product.parentProductId && (product.type === item.type || product.category === item.category)).slice(0, 4);
  const specificationEntries = Object.entries(item.specifications ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && String(value).trim() !== '',
  );
  const estimationEntries = Array.isArray(item.estimation)
    ? item.estimation.filter((entry) => entry && typeof entry.label === 'string' && entry.label.trim() !== '')
    : [];
  const slides = [
    ...images.map((url) => ({ type: 'image' as const, url })),
    ...(item.videoUrl ? [{ type: 'video' as const, url: item.videoUrl }] : []),
  ];
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const activeSlide = slides[selectedSlideIndex] ?? slides[0];
  const goToSlide = (nextIndex: number) => {
    if (!slides.length) return;
    setSelectedSlideIndex((nextIndex + slides.length) % slides.length);
  };

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <div className="relative overflow-hidden border" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
              {activeSlide ? (
                activeSlide.type === 'image' ? (
                  <button type="button" onClick={() => setIsPreviewOpen(true)} className="block w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeSlide.url} alt={item.name} className="aspect-square w-full object-cover" />
                  </button>
                ) : (
                  <div className="relative">
                    <video src={activeSlide.url} controls className="aspect-square w-full object-cover" playsInline autoPlay muted loop>
                      <track kind="captions" />
                    </video>
                    <button type="button" onClick={() => setIsPreviewOpen(true)} className="absolute bottom-3 right-3 rounded-full border border-white/80 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      Fullscreen
                    </button>
                  </div>
                )
              ) : <div className="flex aspect-square items-center justify-center font-mono text-sm text-[var(--brand-muted)]">NO IMAGE</div>}

              {slides.length > 1 ? (
                <>
                  <button type="button" onClick={() => goToSlide(selectedSlideIndex - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-black/40 p-2 text-white shadow-lg backdrop-blur-sm" aria-label="Gambar sebelumnya">
                    ‹
                  </button>
                  <button type="button" onClick={() => goToSlide(selectedSlideIndex + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-black/40 p-2 text-white shadow-lg backdrop-blur-sm" aria-label="Gambar berikutnya">
                    ›
                  </button>
                </>
              ) : null}
            </div>
            {slides.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {slides.slice(0, 4).map((slide, index) => (
                  <button
                    key={`${slide.type}-${slide.url}-${index}`}
                    type="button"
                    onClick={() => setSelectedSlideIndex(index)}
                    className="relative overflow-hidden border transition-opacity"
                    style={{
                      borderColor: selectedSlideIndex === index ? 'var(--brand-accent)' : 'var(--brand-border)',
                      opacity: selectedSlideIndex === index ? 1 : 0.75,
                    }}
                    aria-label={slide.type === 'video' ? 'Putar video' : `Lihat gambar ${index + 1}`}
                  >
                    {slide.type === 'video' ? (
                      <div className="relative">
                        <video src={slide.url} muted playsInline className="aspect-square w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-lg font-bold text-white">▶</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slide.url} alt="" className="aspect-square w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--brand-accent)]">{item.category ?? 'LAYANAN WORKSHOP'}</p>
              <h1 className="mt-3 text-3xl font-bold sm:text-5xl" style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}>{item.name}</h1>
              {item.priceLabel ? <p className="mt-5 text-xl font-bold text-[var(--brand-accent)]">{item.priceLabel}</p> : null}
              {item.description ? <p className="mt-5 leading-relaxed text-[var(--brand-muted)]">{item.description}</p> : null}
            </div>

            {family.length > 1 ? <div><p className="text-xs font-bold uppercase tracking-wide">Pilihan varian</p><div className="mt-3 flex flex-wrap gap-2">{family.map((variant) => <a key={variant.id} href={websiteSlug !== undefined ? buildProductHref(websiteSlug, variant.slug) : '#'} className={`border px-3 py-2 text-xs ${variant.id === item.id ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-on-accent)]' : ''}`} style={variant.id === item.id ? undefined : { borderColor: 'var(--brand-border)' }}>{variant.name}</a>)}</div></div> : null}

            {tenantSlug && internalPaymentMode && item.websiteId ? <PurchaseControls slug={tenantSlug} basePath={websiteSlug} websiteId={item.websiteId} product={{ id: item.id, slug: item.slug, name: item.name, price: Number(item.priceLabel.replace(/[^\d]/g, '')) || 0, quotable: item.quotable, image: item.image, stock: item.stock }} paymentMode={internalPaymentMode} locationIds={item.locationIds} locations={locations} cartLabel="Pesan" /> : null}
            {waHref ? <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex w-full flex-1 justify-center rounded-full border-2 px-5 py-3 text-center text-sm font-bold" style={{ backgroundColor: 'var(--brand-accent)', borderColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>Konsultasi via WhatsApp</a> : null}
            {item.paymentMeta?.map((entry, index) => <WorkshopPaymentLink key={`${entry.payment_mode}-${index}`} entry={entry} />)}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded border p-5" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
              <h2 className="mb-4 text-lg font-bold">Detail Produk</h2>
              {item.detail ? (
                <div className="text-sm leading-relaxed text-[var(--brand-muted)] [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-3" dangerouslySetInnerHTML={{ __html: item.detail }} />
              ) : (
                <p className="text-sm text-[var(--brand-muted)]">Belum ada detail produk.</p>
              )}

              {specificationEntries.length > 0 ? (
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Spesifikasi</h3>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {specificationEntries.map(([key, value]) => (
                      <div key={key} className="rounded border p-3" style={{ borderColor: 'var(--brand-border)' }}>
                        <dt className="text-[11px] uppercase tracking-[0.2em] text-[var(--brand-muted)]">{key}</dt>
                        <dd className="mt-1 font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>

            {estimationEntries.length > 0 ? (
              <div className="rounded border p-5" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
                <h2 className="mb-4 text-lg font-bold">Estimasi Harga</h2>
                <div className="space-y-2">
                  {estimationEntries.map((entry, index) => {
                    const numericPrice = typeof entry.price === 'number' ? entry.price : Number(String(entry.price).replace(/[^\d.-]/g, '')) || 0;
                    return (
                      <div key={`${entry.label}-${index}`} className="flex items-center justify-between rounded border px-3 py-2" style={{ borderColor: 'var(--brand-border)' }}>
                        <span>{entry.label}</span>
                        <strong className="text-[var(--brand-accent)]">{formatIDR(numericPrice)}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {family.length > 1 ? (
            <div className="rounded border p-5" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
              <h2 className="mb-4 text-lg font-bold">List Produk</h2>
              <div className="space-y-3">
                {family.map((variant) => (
                  <a
                    key={variant.id}
                    href={websiteSlug !== undefined ? buildProductHref(websiteSlug, variant.slug) : '#'}
                    className={`block rounded border p-3 transition-colors ${variant.id === item.id ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)]/5' : ''}`}
                    style={{ borderColor: variant.id === item.id ? 'var(--brand-accent)' : 'var(--brand-border)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{variant.name}</span>
                      {variant.priceLabel ? <span className="text-xs text-[var(--brand-muted)]">{variant.priceLabel}</span> : null}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {isPreviewOpen && activeSlide ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setIsPreviewOpen(false)}>
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setIsPreviewOpen(false)} className="absolute -top-10 right-0 rounded-full border border-white/80 bg-black/40 px-3 py-1 text-sm text-white">
              Tutup
            </button>
            {activeSlide.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeSlide.url} alt={item.name} className="max-h-[80vh] w-full rounded-lg object-contain" />
            ) : (
              <video src={activeSlide.url} controls autoPlay className="max-h-[80vh] w-full rounded-lg object-contain" playsInline>
                <track kind="captions" />
              </video>
            )}
          </div>
        </div>
      ) : null}
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
  auth,
}: WorkshopViewProps) {
  const name = profile.name?.trim() || 'Workshop Anda';
  const tagline = profile.tagline?.trim() || 'Solusi konstruksi dan fabrikasi custom.';
  const resolved = resolveTheme(templateTheme, websiteTheme);
  const cssVars = themeToCssVariables(resolved);
  const fontsUrl = getGoogleFontsUrl(resolved.typography);
  const heroSection = sections.find((section) => section.type === 'hero');
  const productDetailItem = sections.find((section) => section.type === 'product_detail')?.content.product;
  const productPageTitle = resolvePageHeadingLabel({
    productName: isCatalogItem(productDetailItem) ? productDetailItem.name : undefined,
    platformName: name,
    fallbackTitle: 'Produk',
  });
  const utilityPage = sections.some((section) => ['cart', 'checkout', 'orders', 'profile', 'order_detail'].includes(section.type));
  const isCategoryListingPage = sections.some((section) => section.type === 'category_listing');
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
        <StoreClassicHeader
          title={name}
          homeHref={homeHref}
          waHref={waHref}
          showWhatsappCta
          leftNavLinks={[]}
          rightNavLinks={pages
            .filter((page) => page.placement === 'header' || page.placement === 'regular')
            .slice(0, 5)
            .map((page): HeaderNavLink => ({
              href: buildPageHref(homeHref === '/' ? '' : homeHref, page),
              label: page.title,
            }))}
          auth={auth}
          cartHref={auth?.cartHref}
          cartLabel="Pesan"
        />
        {isCatalogItem(productDetailItem) ? (
          <>
            <WorkshopProductBanner label={productPageTitle} imageUrl={productDetailItem.image} />
            <WorkshopProductDetail item={productDetailItem} allProducts={products} locations={locations} websiteSlug={websiteSlug} tenantSlug={tenantSlug} waHref={waHref} />
          </>
        ) : utilityPage || isCategoryListingPage ? null : <WorkshopHero tagline={tagline} content={heroSection?.content ?? {}} waHref={waHref} />}
        {!isCatalogItem(productDetailItem) && sections.filter((section) => section.type !== 'hero').map((section, index) => {
          const key = `${section.type}-${index}`;
          switch (section.type) {
            case 'features_grid': return <WorkshopFeatures key={key} content={section.content} />;
            case 'category_grid': return <WorkshopCategories key={key} categories={categories} websiteSlug={websiteSlug} content={section.content} />;
            case 'category_listing': {
              const categoryId = typeof section.content.category_id === 'string' ? section.content.category_id : '';
              const categoryLabel = typeof section.content.category_label === 'string' ? section.content.category_label : '';
              const categoryDetail = categories.find((category) => category.id === categoryId || category.label === categoryLabel);
              const items = products.filter((product) => !product.parentProductId && (product.category === categoryLabel || product.category === categoryId));
              return <WorkshopCategoryListing key={key} category={categoryDetail} label={categoryLabel} products={items} websiteSlug={websiteSlug} />;
            }
            case 'services_grid': return <WorkshopServices key={key} products={products} websiteSlug={websiteSlug} content={section.content} />;
            case 'service_process_section': return <WorkshopProcess key={key} content={section.content} />;
            case 'gallery': return <WorkshopGallery key={key} content={section.content} />;
            case 'about': return <WorkshopAbout key={key} content={section.content} />;
            case 'testimonial': return <WorkshopTestimonials key={key} content={section.content} />;
            case 'faq_list': return <WorkshopFaq key={key} faqs={faqs} content={section.content} />;
            case 'contact': return <WorkshopContact key={key} content={section.content} waHref={waHref} locations={locations} />;
            case 'cart': return <CartContent key={key} basePath={websiteSlug ?? ''} />;
            case 'checkout': {
              const websiteId = typeof section.content.websiteId === 'string' ? section.content.websiteId : '';
              const orderIds = Array.isArray(section.content.orderIds)
                ? (section.content.orderIds as unknown[]).filter((value): value is string => typeof value === 'string')
                : [];
              return <CheckoutContent key={key} basePath={websiteSlug ?? ''} websiteId={websiteId} initialOrderIds={orderIds} locations={locations} />;
            }
            case 'orders': return <OrdersContent key={key} basePath={websiteSlug ?? ''} />;
            case 'tagihan': return <TagihanContent key={key} basePath={websiteSlug ?? ''} />;
            case 'profile': return <ProfileContent key={key} basePath={websiteSlug ?? ''} auth={auth} />;
            case 'order_detail': {
              const transaction = section.content.transaction as TransactionDetail | null | undefined;
              const order = section.content.order as OrderDetail | null | undefined;
              return <OrderDetailContent key={key} transaction={transaction} order={order} />;
            }
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
