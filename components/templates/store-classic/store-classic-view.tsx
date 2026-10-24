/**
 * Template: Store Classic (shared renderer)
 * Fase 1 — katalog/showcase produk & layanan, TANPA keranjang/checkout
 * (CTA tetap mengarah ke WhatsApp, sama seperti template lain). Lihat
 * `app/website/plan.md` untuk rasional & rencana Fase 2 (transaksional).
 *
 * Folder ini sengaja mandiri (tidak import apa pun dari `barber-classic-*`)
 * supaya tiap template bisa dikembangkan/di-maintain terpisah tanpa saling
 * mengganggu CSS maupun dependency-nya.
 */

import {
  buildBlogPostHref,
  buildCategoryHref,
  buildMapEmbedUrl,
  buildPageHref,
  buildProductHref,
  buildWhatsAppHref,
  formatIDR,
  parseGalleryImages,
  parseSocialLinks,
  type BlogPostItem,
  type CatalogItem,
  type CategoryItem,
  type FaqItem,
  type GalleryImageItem,
  type LocationItem,
  type NavPage,
  type SectionEntry,
  normalizeFooterBlocks,
} from '../../../lib/template-data';
import { resolveCheckoutPaymentMode } from '../../../lib/payment-mode';
import {
  getGoogleFontsUrl,
  resolveTheme,
  themeToCssVariables,
  type WebsiteTheme,
} from '../../../lib/website-theme';
import { resolvePageHeadingLabel } from '../../../lib/page-title';
import { StoreClassicBlogSidebar } from './store-classic-blog-sidebar';
import { BlogRelatedProducts } from '../../blog-related-products';
import { CategoryListingSection, ProductGridSection, VariantTreeSelector } from './store-classic-catalog';
import { StoreClassicProductGallery } from './store-classic-gallery';
import { TemplateFooter } from '../shared/template-footer';
import { StoreClassicHeader, type HeaderNavLink } from './store-classic-header';
import { CartContent } from '../../cart-content';
import { CheckoutContent } from '../../checkout-content';
import { OrdersContent } from '../../orders-content';
import { TagihanContent } from '../../tagihan-content';
import { GatheringCalendarContent } from '../../gathering-calendar-content';
import { ProfileContent } from '../../profile-content';
import { CustomerChatContent } from '../../customer-chat-content';
import { OrderDetailContent, type OrderDetail, type TransactionDetail } from '../../order-detail-content';
import { AddToCartButton } from '../../cart-button';
import { CartBadge } from '../../cart-badge';
import { PurchaseControls } from '../../purchase-controls';
import { ChatReferenceButton } from '../../chat-reference-button';
import { GatheringPlanButton } from '../../gathering-plan-button';
import { buildChatReferenceHref } from '../../chat-reference';

export interface StoreClassicProfile {
  name?: string;
  tagline?: string;
  logoUrl?: string;
  whatsapp?: string;
  phone?: string;
  email?: string;
  socialLinks?: Record<string, unknown>;
  /** `websites.footer_settings` mentah — blok footer global */
  footerSettings?: unknown;
}

export interface StoreClassicViewProps {
  isPreview: boolean;
  profile: StoreClassicProfile;
  templateTheme?: WebsiteTheme;
  websiteTheme?: WebsiteTheme;
  sections: SectionEntry[];
  products: CatalogItem[];
  categories?: CategoryItem[];
  locations: LocationItem[];
  faqs: FaqItem[];
  websiteSlug?: string;
  websiteId?: string;
  tenantSlug?: string;
  pages?: NavPage[];
  blogPosts?: BlogPostItem[];
  /** W1 auth renderer: state login buyer. */
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
    chatHref?: string;
  };
}

export function SectionHeading({ title, align = 'left' }: { title?: string; align?: 'left' | 'center' }) {
  if (!title?.trim()) return null;
  return (
    <h2
      className={`mb-8 text-2xl font-bold sm:text-3xl ${align === 'center' ? 'text-center' : ''}`}
      style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
    >
      {title}
    </h2>
  );
}

function HeroSection({
  title,
  tagline,
  subtitle,
  imageUrl,
  waHref,
  chatHref,
  showWhatsappCta,
}: {
  title: string;
  tagline: string;
  subtitle?: string;
  imageUrl?: string;
  waHref?: string;
  chatHref?: string;
  showWhatsappCta: boolean;
}) {
  return (
    <section className="border-b" style={{ borderColor: 'var(--brand-border)' }}>
      <div
        className={`mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 ${
          imageUrl ? 'sm:grid-cols-2 sm:items-center' : 'text-center'
        }`}
      >
        <div className={imageUrl ? '' : 'mx-auto max-w-2xl'}>
          {subtitle && (
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--brand-accent)' }}>
              {subtitle}
            </p>
          )}
          <h1
            className="mt-4 text-3xl font-bold sm:text-5xl"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
          >
            {title}
          </h1>
          <p className="mt-5 text-sm leading-relaxed sm:text-base" style={{ color: 'var(--brand-muted)' }}>
            {tagline}
          </p>
          {showWhatsappCta && (chatHref || waHref) && (
            <a
              href={chatHref || waHref || '#'}
              target={chatHref ? undefined : '_blank'}
              rel={chatHref ? undefined : 'noopener noreferrer'}
              className="mt-8 inline-flex rounded-full px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: 'var(--c-btn-primary-bg)', color: 'var(--c-btn-primary-text)' }}
            >
              Hubungi Kami
            </a>
          )}
        </div>
        {imageUrl && (
          <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: 'var(--brand-surface)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="aspect-[4/3] w-full object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}

/** Hero untuk halaman non-home (listing kategori, detail produk) — background foto (kategori/produk), judul = label-nya. */
function PageHeroBanner({ label, imageUrl }: { label: string; imageUrl?: string }) {
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

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
}

function FeaturesGridSection({ title, features }: { title?: string; features: FeatureItem[] }) {
  const items = features.filter((f) => f.title.trim());
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} align="center" />
      <div className={`grid gap-6 ${items.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {items.map((item, i) => (
          <div key={i} className="rounded-xl p-6 text-center" style={{ backgroundColor: 'var(--brand-surface)' }}>
            <span className="text-3xl">{item.icon || '⭐'}</span>
            <p className="mt-3 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              {item.title}
            </p>
            {item.desc && (
              <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
                {item.desc}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export interface CategoryEntry {
  image?: string;
  count: number;
}

export function CategoryTile({
  category,
  entry,
  featured = false,
  className = '',
  href,
}: {
  category: string;
  entry: CategoryEntry;
  featured?: boolean;
  className?: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className={`group relative block aspect-square w-full overflow-hidden rounded-xl sm:aspect-auto sm:h-full ${className}`}
      style={{ backgroundColor: 'var(--brand-surface)' }}
    >
      {entry.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className={`absolute inset-x-0 bottom-0 p-4 text-white ${featured ? 'sm:p-6' : ''}`}>
        <p
          className={`font-bold uppercase tracking-wide ${featured ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {category}
        </p>
        {featured && <p className="mt-1 text-sm text-white/80">{entry.count} produk</p>}
      </div>
    </a>
  );
}

function CategoryGridSection({
  title,
  products,
  categories,
  websiteSlug,
}: {
  title?: string;
  products: CatalogItem[];
  categories: CategoryItem[];
  websiteSlug?: string;
}) {
  const byCategory = new Map<string, CategoryEntry>();
  for (const p of products) {
    const cat = p.category;
    if (!cat) continue;
    const entry = byCategory.get(cat) ?? { image: p.image, count: 0 };
    entry.count += 1;
    if (!entry.image) entry.image = p.image;
    byCategory.set(cat, entry);
  }

  // Foto kurasi milik kategori (dari menu "Kelola Kategori") diprioritaskan
  // di atas foto produk pertama — fallback itu cuma dipakai selama kategori
  // belum diberi foto sendiri.
  for (const [label, entry] of byCategory) {
    const cover = categories.find((c) => c.label === label)?.images[0];
    if (cover) entry.image = cover;
  }

  const groupedEntries = [...byCategory.entries()];
  if (groupedEntries.length === 0) return null;

  const basePath = websiteSlug ?? '';
  const [[featuredCategory, featuredEntry], ...rest] = groupedEntries;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} align="center" />
      <div className="grid gap-4 sm:aspect-[2/1] sm:grid-cols-2 sm:grid-rows-1">
        <CategoryTile
          category={featuredCategory}
          entry={featuredEntry}
          featured
          href={buildCategoryHref(basePath, featuredCategory)}
        />
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:h-full sm:grid-rows-2">
            {rest.map(([category, entry], i) => (
              <CategoryTile
                key={category}
                category={category}
                entry={entry}
                href={buildCategoryHref(basePath, category)}
                className={i === rest.length - 1 && rest.length % 2 === 1 ? 'col-span-2' : ''}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ProductCard({
  item,
  websiteSlug,
  tenantSlug,
}: {
  item: CatalogItem;
  websiteSlug?: string;
  tenantSlug?: string;
}) {
  const href = websiteSlug !== undefined ? buildProductHref(websiteSlug, item.slug) : undefined;
  const internalMode = resolveCheckoutPaymentMode(item.type);

  const content = (
    <>
      {item.image ? (
        <div className="relative aspect-square w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="p-4">
        <p className="font-medium" style={{ fontFamily: 'var(--font-heading)' }}>
          {item.name}
        </p>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
            {item.description}
          </p>
        )}
        {item.priceLabel && (
          <p className="mt-2 text-sm font-bold" style={{ color: 'var(--brand-accent-muted)' }}>
            {item.priceLabel}
          </p>
        )}
      </div>
    </>
  );

  // Produk dengan mode internal (ADD_TO_CART/ESCROW): kartu berisi link
  // (gambar+nama+harga) + tombol cart terpisah di luar link (valid HTML).
  if (internalMode && href && tenantSlug && item.websiteId) {
    return (
      <div
        className="group block overflow-hidden rounded-xl border text-left transition-colors hover:opacity-95"
        style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
      >
        <a href={href} className="block">
          {content}
        </a>
        <div className="px-4 pb-4">
          <AddToCartButton
            slug={tenantSlug}
            websiteId={item.websiteId}
            product={{
              id: item.id,
              slug: item.slug,
              name: item.name,
              price: Number(item.priceLabel.replace(/[^\d]/g, '')) || 0,
              image: item.image ?? item.images?.[0],
              stock: item.stock,
            }}
            productType={item.type}
          />
        </div>
      </div>
    );
  }

  const Wrapper = href ? 'a' : 'div';
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="group block overflow-hidden rounded-xl border text-left transition-colors hover:opacity-90"
      style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
    >
      {content}
    </Wrapper>
  );
}

function FeaturedProductSection({
  title,
  subtitle,
  product,
  buttonText,
  websiteSlug,
}: {
  title?: string;
  subtitle?: string;
  product?: CatalogItem;
  buttonText?: string;
  websiteSlug?: string;
}) {
  if (!product) return null;
  const href = websiteSlug !== undefined ? buildProductHref(websiteSlug, product.slug) : undefined;
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 rounded-2xl p-6 sm:grid-cols-2 sm:items-center sm:p-10" style={{ backgroundColor: 'var(--brand-surface)' }}>
        {product.image && (
          <div className="overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt="" className="aspect-square w-full object-cover" />
          </div>
        )}
        <div>
          {subtitle && (
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--brand-accent)' }}>
              {subtitle}
            </p>
          )}
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {title || product.name}
          </h2>
          {product.description && (
            <p className="mt-3 text-sm leading-relaxed sm:text-base" style={{ color: 'var(--brand-muted)' }}>
              {product.description}
            </p>
          )}
          {product.priceLabel && (
            <p className="mt-4 text-lg font-bold" style={{ color: 'var(--brand-accent-muted)' }}>
              {product.priceLabel}
            </p>
          )}
          {href && (
            <a
              href={href}
              className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: 'var(--c-btn-primary-bg)', color: 'var(--c-btn-primary-text)' }}
            >
              {buttonText?.trim() || 'Lihat Detail'}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function LogoWallSection({ title, layout, logos }: { title?: string; layout?: string; logos: GalleryImageItem[] }) {
  if (!logos.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} align="center" />
      <div
        className={
          layout === 'carousel'
            ? 'flex snap-x gap-8 overflow-x-auto pb-2'
            : 'grid grid-cols-3 items-center gap-8 sm:grid-cols-6'
        }
      >
        {logos.map((logo, i) => (
          <div key={i} className={`flex shrink-0 items-center justify-center ${layout === 'carousel' ? 'w-32 snap-start' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.url} alt={logo.alt ?? ''} className="max-h-12 w-full object-contain opacity-80 grayscale transition-opacity hover:opacity-100 hover:grayscale-0" />
          </div>
        ))}
      </div>
    </section>
  );
}

function LocationCard({ location }: { location: LocationItem }) {
  const waHref = buildWhatsAppHref(location.whatsapp);
  return (
    <div className="rounded-xl border p-5 text-left" style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}>
      <p className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
        {location.name}
      </p>
      {location.addressLine && (
        <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
          {location.addressLine}
          {location.city ? `, ${location.city}` : ''}
        </p>
      )}
      {location.openingHoursNote && (
        <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)', opacity: 0.8 }}>
          {location.openingHoursNote}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--brand-accent-muted)' }}>
            WhatsApp
          </a>
        )}
        {location.mapsUrl && (
          <a href={location.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--brand-accent-muted)' }}>
            Lihat Peta
          </a>
        )}
      </div>
    </div>
  );
}

function LocationsSection({ title, items }: { title: string; items: LocationItem[] }) {
  if (!items.length) return null;
  const featured = items.find((l) => l.isPrimary) ?? items[0];
  const embedUrl = buildMapEmbedUrl(featured);
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} align="center" />
      <div className="grid gap-4 sm:grid-cols-5">
        <div className="flex flex-col gap-4 sm:col-span-2">
          {items.map((location) => (
            <LocationCard key={location.id} location={location} />
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border sm:col-span-3" style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`Peta lokasi ${featured.name}`}
              className="h-72 w-full sm:h-full sm:min-h-[320px]"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-72 items-center justify-center px-4 text-center text-sm sm:h-full sm:min-h-[320px]" style={{ color: 'var(--brand-muted)' }}>
              Peta belum tersedia
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ title, items }: { title: string; items: FaqItem[] }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} align="center" />
      <div className="space-y-3">
        {items.map((faq) => (
          <details key={faq.id} className="rounded-xl border p-4" style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}>
            <summary className="cursor-pointer font-medium marker:content-none" style={{ fontFamily: 'var(--font-heading)' }}>
              {faq.question}
            </summary>
            <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function RichTextSection({ title, html }: { title?: string; html: string }) {
  if (!html.trim()) return null;
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} align="center" />
      <div
        className="text-sm leading-relaxed sm:text-base [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:list-disc"
        style={{ color: 'var(--brand-muted)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

function TextBlockSection({ title, body, align }: { title?: string; body: string; align?: string }) {
  if (!body.trim()) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className={align === 'center' ? 'text-center' : 'text-left'}>
        <SectionHeading title={title} align={align === 'center' ? 'center' : 'left'} />
        <p className="whitespace-pre-line text-sm leading-relaxed sm:text-base" style={{ color: 'var(--brand-muted)' }}>
          {body}
        </p>
      </div>
    </section>
  );
}

function AboutSection({ title, body, imageUrl }: { title?: string; body: string; imageUrl?: string }) {
  if (!body.trim() && !imageUrl) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className={`grid gap-8 ${imageUrl ? 'sm:grid-cols-2 sm:items-center' : ''}`}>
        {imageUrl && (
          <div className="overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        )}
        <div>
          <SectionHeading title={title} />
          {body && (
            <p className="whitespace-pre-line text-sm leading-relaxed sm:text-base" style={{ color: 'var(--brand-muted)' }}>
              {body}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function GallerySection({ title, layout, images }: { title?: string; layout?: string; images: GalleryImageItem[] }) {
  if (!images.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} align="center" />
      {layout === 'carousel' ? (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {images.map((image, i) => (
            <figure key={i} className="w-64 shrink-0 snap-start overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--brand-surface)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt ?? ''} className="aspect-square w-full object-cover" loading="lazy" />
            </figure>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, i) => (
            <figure key={i} className="overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--brand-surface)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt ?? ''} className="aspect-square w-full object-cover" loading="lazy" />
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function CtaSection({ title, subtitle, buttonText, buttonUrl }: { title?: string; subtitle?: string; buttonText?: string; buttonUrl?: string }) {
  if (!title && !subtitle && !buttonUrl) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
      {title && (
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {title}
        </h2>
      )}
      {subtitle && (
        <p className="mt-2 text-sm sm:text-base" style={{ color: 'var(--brand-muted)' }}>
          {subtitle}
        </p>
      )}
      {buttonUrl && (
        <a
          href={buttonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: 'var(--c-btn-primary-bg)', color: 'var(--c-btn-primary-text)' }}
        >
          {buttonText?.trim() || 'Hubungi Kami'}
        </a>
      )}
    </section>
  );
}

function TestimonialSection({ title }: { title: string }) {
  if (!title.trim()) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
      <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
        {title}
      </h2>
    </section>
  );
}

function ContactSection({ title, profile }: { title: string; profile: StoreClassicProfile }) {
  const waHref = buildWhatsAppHref(profile.whatsapp);
  if (!profile.phone && !profile.email && !waHref) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
      <SectionHeading title={title} align="center" />
      <div className="flex flex-col items-center gap-2 text-sm sm:flex-row sm:justify-center sm:gap-6" style={{ color: 'var(--brand-muted)' }}>
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--brand-accent-muted)' }}>
            WhatsApp: {profile.whatsapp}
          </a>
        )}
        {profile.phone && <span>{profile.phone}</span>}
        {profile.email && <span>{profile.email}</span>}
      </div>
    </section>
  );
}

function BlogPostCard({ post, websiteSlug }: { post: BlogPostItem; websiteSlug?: string }) {
  const href = websiteSlug !== undefined ? buildBlogPostHref(websiteSlug, post.slug) : '#';
  return (
    <a href={href} className="block overflow-hidden rounded-xl border text-left transition-colors hover:opacity-90" style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}>
      {post.coverImage ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="p-5">
        {post.publishedAtLabel && (
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-accent)' }}>
            {post.publishedAtLabel}
          </p>
        )}
        <p className="mt-1 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {post.title}
        </p>
        {post.excerpt && (
          <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
            {post.excerpt}
          </p>
        )}
      </div>
    </a>
  );
}

/** Layout blog 2 kolom (grid + sidebar) — dipakai blog_list & blog_collection. */
function BlogTwoColumnLayout({
  title,
  items,
  allPosts,
  websiteSlug,
}: {
  title: string;
  items: BlogPostItem[];
  allPosts: BlogPostItem[];
  websiteSlug?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} />
      <div className="grid gap-10 sm:grid-cols-[1fr_280px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((post) => (
            <BlogPostCard key={post.id} post={post} websiteSlug={websiteSlug} />
          ))}
        </div>
        <StoreClassicBlogSidebar posts={allPosts} websiteSlug={websiteSlug} />
      </div>
    </section>
  );
}

function BlogSearchSection({ title, placeholder, posts, websiteSlug }: { title?: string; placeholder?: string; posts: BlogPostItem[]; websiteSlug?: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} align="center" />
      <div className="mx-auto max-w-md">
        <StoreClassicBlogSidebar posts={posts} websiteSlug={websiteSlug} />
      </div>
      {!title && placeholder ? null : null}
    </section>
  );
}

function BlogArticleSection({ post, allPosts, websiteSlug }: { post: BlogPostItem; allPosts: BlogPostItem[]; websiteSlug?: string }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 sm:grid-cols-[1fr_280px]">
        <article>
          {post.publishedAtLabel && (
            <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--brand-accent)' }}>
              {post.publishedAtLabel}
            </p>
          )}
          <h1 className="mt-3 text-2xl font-bold sm:text-4xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {post.title}
          </h1>
          {post.coverImage && (
            <div className="mt-8 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.coverImage} alt="" className="aspect-[16/9] w-full object-cover" />
            </div>
          )}
          <div
            className="mt-8 text-sm leading-relaxed sm:text-base [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-4 [&_ul]:list-disc"
            style={{ color: 'var(--brand-muted)' }}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          {post.relatedProducts && <BlogRelatedProducts products={post.relatedProducts} websiteSlug={websiteSlug} />}
        </article>
        <StoreClassicBlogSidebar posts={allPosts} websiteSlug={websiteSlug} excludeId={post.id} />
      </div>
    </section>
  );
}

/** Klik swatch/tombol navigasi ke halaman produk varian itu sendiri (setiap varian punya slug sendiri) — tidak butuh state client. */
function ProductDetailSection({ item, allProducts, locations, waHref, websiteSlug, tenantSlug, websiteId, isLoggedIn, loginHref }: { item: CatalogItem; allProducts: CatalogItem[]; locations: LocationItem[]; waHref?: string; websiteSlug?: string; tenantSlug?: string; websiteId?: string; isLoggedIn?: boolean; loginHref?: string }) {
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];

  const familyId = item.parentProductId ?? item.id;
  const family = allProducts.filter((p) => p.id === familyId || p.parentProductId === familyId);
  const familyIds = new Set(family.map((p) => p.id));

  // Mode checkout dari tipe produk (digital = direct pay, lainnya escrow) — dipakai PurchaseControls.
  const internalPaymentMode = resolveCheckoutPaymentMode(item.type);

  const related = allProducts
    .filter((p) => !familyIds.has(p.id) && !p.parentProductId && (p.type === item.type || p.category === item.category))
    .slice(0, 4);
  const specificationEntries = Object.entries(item.specifications ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && String(value).trim() !== '',
  );
  const estimationEntries = Array.isArray(item.estimation)
    ? item.estimation.filter((entry) => entry && typeof entry.label === 'string' && entry.label.trim() !== '')
    : [];

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2">
          <StoreClassicProductGallery images={images} videoUrl={item.videoUrl} model3dUrl={item.model3dUrl} />
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>
              {item.name}
            </h1>
            {item.priceLabel && (
              <p className="mt-3 text-xl font-bold" style={{ color: 'var(--brand-accent-muted)' }}>
                {item.priceLabel}
              </p>
            )}
            <VariantTreeSelector family={family} currentId={item.id} websiteSlug={websiteSlug} />

            {/* Mode internal (ADD_TO_CART/ESCROW): quantity + stok + tombol cart
                — urutan: varian → quantity → cart → WhatsApp. */}
            {item.type !== 'gathering' && tenantSlug && internalPaymentMode && item.websiteId && (
              <PurchaseControls
                slug={tenantSlug}
                basePath={websiteSlug}
                isLoggedIn={isLoggedIn}
                loginHref={loginHref}
                websiteId={item.websiteId}
                product={{
                  id: item.id,
                  slug: item.slug,
                  name: item.name,
                  price: Number(item.priceLabel.replace(/[^\d]/g, '')) || 0,
                  quotable: item.quotable,
                  image: item.image ?? item.images?.[0],
                  stock: item.stock,
                }}
                productType={item.type}
                locationIds={item.locationIds}
                locations={locations}
              />
            )}

            {item.type === 'gathering' ? (
              <div className="mt-6 flex flex-col gap-3">
                {websiteId && (
                  <GatheringPlanButton
                    websiteId={websiteId}
                    productId={item.id}
                    basePath={websiteSlug}
                    loginHref={loginHref}
                    className="inline-flex w-full justify-center rounded-full bg-[var(--c-btn-primary-bg)] px-7 py-3 text-sm font-semibold uppercase tracking-wide text-[var(--c-btn-primary-text)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Rencanakan Gathering
                  </GatheringPlanButton>
                )}
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full justify-center rounded-full border px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    style={{ borderColor: 'var(--c-btn-secondary-border)', color: 'var(--c-btn-secondary-text)' }}
                  >
                    Konsultasi via WhatsApp
                  </a>
                )}
                {websiteId && (
                  <ChatReferenceButton
                    websiteId={websiteId}
                    basePath={websiteSlug}
                    loginHref={loginHref}
                    productId={item.id}
                    reference={{ type: 'product', id: item.id, title: item.name, imageUrl: item.image ?? item.images?.[0], meta: item.priceLabel, href: websiteSlug !== undefined ? buildChatReferenceHref('product', websiteSlug, { productSlug: item.slug }) : undefined }}
                    className="inline-flex w-full justify-center rounded-full border px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    style={{ borderColor: 'var(--c-btn-secondary-border)', color: 'var(--c-btn-secondary-text)' }}
                  >
                    Tanya Produk
                  </ChatReferenceButton>
                )}
              </div>
            ) : (
              <>
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex w-full justify-center rounded-full px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    style={{ backgroundColor: 'var(--c-btn-primary-bg)', color: 'var(--c-btn-primary-text)' }}
                  >
                    Pesan via WhatsApp
                  </a>
                )}
                {websiteId && (
                  <ChatReferenceButton
                    websiteId={websiteId}
                    basePath={websiteSlug}
                    loginHref={loginHref}
                    productId={item.id}
                    reference={{ type: 'product', id: item.id, title: item.name, imageUrl: item.image ?? item.images?.[0], meta: item.priceLabel, href: websiteSlug !== undefined ? buildChatReferenceHref('product', websiteSlug, { productSlug: item.slug }) : undefined }}
                    className="mt-3 inline-flex w-full justify-center rounded-full border px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    style={{ borderColor: 'var(--c-btn-secondary-border)', color: 'var(--c-btn-secondary-text)' }}
                  >
                    Tanya Produk
                  </ChatReferenceButton>
                )}
              </>
            )}
          </div>
        </div>
        {(item.type === 'gathering' && item.gatheringMeta) || specificationEntries.length > 0 || estimationEntries.length > 0 || item.detail ? (
          <div className="mt-10 w-full space-y-8">
            {item.type === 'gathering' && item.gatheringMeta && (
              <section className="w-full border-y py-6" style={{ borderColor: 'var(--brand-border)' }}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Detail Gathering</h2>
                  <span className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>
                    Sebelum RSVP
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {item.gatheringMeta.depositAmountPerSeat != null && (
                    <div className="border-l-2 pl-3 sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>DP booking per peserta</p>
                      <p className="mt-1 font-semibold" style={{ color: 'var(--brand-accent-muted)' }}>{formatIDR(item.gatheringMeta.depositAmountPerSeat)}</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Nominal total DP menyesuaikan jumlah peserta.</p>
                    </div>
                  )}
                  {item.gatheringMeta.minAttendees != null && item.gatheringMeta.minAttendees > 0 && (
                    <div className="border-l-2 pl-3" style={{ borderColor: 'var(--brand-accent)' }}>
                      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Minimum peserta</p>
                      <p className="mt-1 font-medium">{item.gatheringMeta.minAttendees}</p>
                    </div>
                  )}
                  {item.gatheringMeta.maxAttendees != null && item.gatheringMeta.maxAttendees > 0 && (
                    <div className="border-l-2 pl-3" style={{ borderColor: 'var(--brand-accent)' }}>
                      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Maksimum peserta</p>
                      <p className="mt-1 font-medium">{item.gatheringMeta.maxAttendees}</p>
                    </div>
                  )}
                  {item.gatheringMeta.eventDate && (
                    <div className="border-l-2 pl-3" style={{ borderColor: 'var(--brand-accent)' }}>
                      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Jadwal</p>
                      <p className="mt-1 font-medium">{item.gatheringMeta.eventDate}</p>
                    </div>
                  )}
                  {item.gatheringMeta.eventTime && (
                    <div className="border-l-2 pl-3" style={{ borderColor: 'var(--brand-accent)' }}>
                      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Waktu</p>
                      <p className="mt-1 font-medium">{item.gatheringMeta.eventTime}</p>
                    </div>
                  )}
                  {item.gatheringMeta.location && (
                    <div className="border-l-2 pl-3 sm:col-span-2" style={{ borderColor: 'var(--brand-accent)' }}>
                      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Lokasi</p>
                      <p className="mt-1 font-medium">{item.gatheringMeta.location}</p>
                    </div>
                  )}
                </div>
                {item.gatheringMeta.cancellationPolicy && (
                  <div className="mt-6 max-w-4xl">
                    <h3 className="font-semibold">Kebijakan pembatalan</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>{item.gatheringMeta.cancellationPolicy}</p>
                  </div>
                )}
              </section>
            )}

            {(item.description || item.detail || specificationEntries.length > 0 || estimationEntries.length > 0) && (
              <section className="w-full border-y py-6" style={{ borderColor: 'var(--brand-border)' }}>
                <h2 className="mb-4 text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Detail Produk</h2>
                {item.description && (
                  <p className="mb-5 max-w-4xl text-sm leading-relaxed sm:text-base" style={{ color: 'var(--brand-muted)' }}>
                    {item.description}
                  </p>
                )}
                {specificationEntries.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-3 text-base font-semibold">Spesifikasi</h3>
                    <dl className="grid gap-4 border-y py-4 sm:grid-cols-2 lg:grid-cols-3" style={{ borderColor: 'var(--brand-border)' }}>
                      {specificationEntries.map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{key}</dt>
                          <dd className="mt-1 font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                {estimationEntries.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-3 text-base font-semibold">Estimasi Harga</h3>
                    <div className="border-y" style={{ borderColor: 'var(--brand-border)' }}>
                      {estimationEntries.map((entry, index) => {
                        const numericPrice = typeof entry.price === 'number' ? entry.price : Number(String(entry.price).replace(/[^\d.-]/g, '')) || 0;
                        return (
                          <div key={`${entry.label}-${index}`} className="flex items-center justify-between border-b py-3 last:border-b-0" style={{ borderColor: 'var(--brand-border)' }}>
                            <span>{entry.label}</span>
                            <strong style={{ color: 'var(--brand-accent-muted)' }}>{formatIDR(numericPrice)}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {item.detail && (
                  <div
                    className="max-w-none text-sm leading-relaxed [&_a]:underline [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:list-disc"
                    style={{ color: 'var(--brand-muted)' }}
                    dangerouslySetInnerHTML={{ __html: item.detail }}
                  />
                )}
              </section>
            )}

            {item.type === 'gathering' && item.gatheringMeta?.optionGroups?.length ? (
              <section className="w-full border-y py-6" style={{ borderColor: 'var(--brand-border)' }}>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Detail Option</h2>
                    <p className="mt-1 text-sm" style={{ color: 'var(--brand-muted)' }}>Kelompok pilihan yang tersedia untuk gathering ini.</p>
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>
                    {item.gatheringMeta.optionGroups.length} kelompok pilihan
                  </span>
                </div>
                <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {item.gatheringMeta.optionGroups.map((group) => (
                    <div key={group.key} className="overflow-hidden border" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
                      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--brand-border)' }}>
                        <h3 className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>{group.label}</h3>
                        <span className="shrink-0 text-xs" style={{ color: 'var(--brand-muted)' }}>
                          {group.options.length} pilihan
                        </span>
                      </div>
                      <ol className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
                        {group.options.map((option, index) => (
                          <li key={option.id} className="flex gap-3 px-4 py-3" style={{ borderColor: 'var(--brand-border)' }}>
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-semibold" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-accent-muted)' }}>
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium" style={{ color: 'var(--brand-text)' }}>{option.label}</p>
                              {option.description ? (
                                <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--brand-muted)' }}>{option.description}</p>
                              ) : null}
                              {(option.venueLocation || option.availabilityNote) && (
                                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {option.venueLocation && (
                                    <div>
                                      <dt className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Lokasi</dt>
                                      <dd className="mt-0.5 text-xs" style={{ color: 'var(--brand-text)' }}>{option.venueLocation}</dd>
                                    </div>
                                  )}
                                  {option.availabilityNote && (
                                    <div>
                                      <dt className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Ketersediaan</dt>
                                      <dd className="mt-0.5 text-xs" style={{ color: 'var(--brand-text)' }}>{option.availabilityNote}</dd>
                                    </div>
                                  )}
                                </dl>
                              )}
                              {option.benefits?.length ? (
                                <div className="mt-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>Benefit</p>
                                  <ul className="mt-1 space-y-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                                    {option.benefits.map((benefit, benefitIndex) => (
                                      <li key={`${option.id}-benefit-${benefitIndex}`} className="flex gap-2">
                                        <span aria-hidden="true" style={{ color: 'var(--brand-accent-muted)' }}>•</span>
                                        <span>{benefit}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHeading title="Produk Lainnya" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} item={item} websiteSlug={websiteSlug} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function StoreClassicView({
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
  websiteId,
  pages = [],
  blogPosts = [],
  auth,
}: StoreClassicViewProps) {
  const title = profile.name?.trim() || 'Nama Toko Anda';
  const tagline = profile.tagline?.trim() || 'Belanja produk pilihan dengan kualitas terbaik.';
  const waHref = buildWhatsAppHref(profile.whatsapp);
  const chatHref = auth?.chatHref ?? (websiteSlug !== undefined ? `${websiteSlug}/chat` : '/chat');

  const resolved = resolveTheme(templateTheme, websiteTheme);
  const cssVars = themeToCssVariables(resolved);
  const fontsUrl = getGoogleFontsUrl(resolved.typography);

  const heroContent = sections.find((s) => s.type === 'hero')?.content ?? {};
  const heroSubtitle = typeof heroContent.subtitle === 'string' ? heroContent.subtitle : undefined;
  const heroImageUrl = typeof heroContent.image_url === 'string' ? heroContent.image_url : undefined;
  const showWhatsappCta = heroContent.show_whatsapp_cta !== false;

  const categoryListingContent = sections.find((s) => s.type === 'category_listing')?.content;
  const categoryListingLabel =
    typeof categoryListingContent?.category_label === 'string' ? categoryListingContent.category_label : undefined;
  const categoryListingImage = categoryListingLabel
    ? categories.find((c) => c.label === categoryListingLabel)?.images[0]
    : undefined;

  const productDetailContent = sections.find((s) => s.type === 'product_detail')?.content;
  const productDetailItem = productDetailContent?.product as CatalogItem | undefined;
  const productPageTitle = resolvePageHeadingLabel({
    productName: productDetailItem?.name,
    platformName: title,
    fallbackTitle: 'Produk',
  });

  const cartSection = sections.find((s) => s.type === 'cart');
  const checkoutSection = sections.find((s) => s.type === 'checkout');
  const ordersSection = sections.find((s) => s.type === 'orders');
  const orderDetailSection = sections.find((s) => s.type === 'order_detail');
  const profileSection = sections.find((s) => s.type === 'profile');
  const chatSection = sections.find((s) => s.type === 'chat');
  const isChatPage = Boolean(chatSection);
  const pageBannerLabel = checkoutSection
    ? 'Checkout'
    : cartSection
      ? 'Daftar Pesanan'
      : ordersSection
        ? 'Daftar Transaksi'
        : orderDetailSection
          ? 'Status Pesanan'
          : profileSection
            ? 'Profil Saya'
            : chatSection
              ? 'Chat Pelanggan'
              : undefined;

  const toLink = (page: NavPage): HeaderNavLink => ({
    href: websiteSlug !== undefined ? buildPageHref(websiteSlug, page) : '#',
    label: page.title,
  });
  const regularNavLinks = pages.filter((p) => p.placement === 'regular').map(toLink);
  const headerNavLinks = pages.filter((p) => p.placement === 'header').map(toLink);
  const footerNavLinks = pages.filter((p) => p.placement === 'footer').map(toLink);
  const homeHref = websiteSlug !== undefined ? websiteSlug || '/' : '#';

  const socialLinks = parseSocialLinks(profile.socialLinks);
  const footerBlocks = normalizeFooterBlocks(profile.footerSettings);
  const primaryLocation = locations.find((l) => l.isPrimary) ?? locations[0];
  const footerAddress = primaryLocation
    ? [primaryLocation.addressLine, primaryLocation.city].filter(Boolean).join(', ')
    : undefined;

  const productsById = new Map(products.map((p) => [p.id, p]));
  // Sembunyikan row varian (warna/ukuran) dari grid/listing — 1 keluarga
  // varian cuma tampil 1 kartu (produk induk). Halaman detail tetap pakai
  // `products` penuh (tidak difilter) supaya varian bisa diakses via slug-nya.
  const topLevelProducts = products.filter((p) => !p.parentProductId);

  return (
    <>
      {fontsUrl ? <link rel="stylesheet" href={fontsUrl} /> : null}
      <div
        className="min-h-screen [&_h1]:text-[color:var(--brand-heading)] [&_h2]:text-[color:var(--brand-heading)] [&_h3]:text-[color:var(--brand-heading)]"
        style={{
          ...cssVars,
          backgroundColor: 'var(--brand-bg)',
          color: 'var(--brand-text)',
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-body-weight)',
        }}
      >
        <StoreClassicHeader
          title={title}
          logoUrl={profile.logoUrl}
          homeHref={homeHref}
          waHref={waHref}
          showWhatsappCta={showWhatsappCta}
          leftNavLinks={regularNavLinks}
          rightNavLinks={headerNavLinks}
          socialLinks={socialLinks}
          auth={auth}
          websiteId={websiteId ?? ''}
          cartHref={auth?.cartHref}
          chatHref={chatHref}
        />

        {productDetailItem ? (
          <PageHeroBanner label={productPageTitle} imageUrl={productDetailItem.image} />
        ) : categoryListingLabel ? (
          <PageHeroBanner label={categoryListingLabel} imageUrl={categoryListingImage} />
        ) : isChatPage ? null : pageBannerLabel ? (
          <PageHeroBanner label={pageBannerLabel} />
        ) : (
          <HeroSection
            title={title}
            tagline={tagline}
            subtitle={heroSubtitle}
            imageUrl={heroImageUrl}
            waHref={waHref}
            chatHref={chatHref}
            showWhatsappCta={showWhatsappCta}
          />
        )}

        {sections
          .filter((section) => section.type !== 'hero')
          .map((section, index) => {
            const key = `${section.type}-${index}`;
            switch (section.type) {
              case 'features_grid': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
                const features: FeatureItem[] = [1, 2, 3].map((n) => ({
                  icon: typeof section.content[`feature_${n}_icon`] === 'string' ? (section.content[`feature_${n}_icon`] as string) : '',
                  title: typeof section.content[`feature_${n}_title`] === 'string' ? (section.content[`feature_${n}_title`] as string) : '',
                  desc: typeof section.content[`feature_${n}_desc`] === 'string' ? (section.content[`feature_${n}_desc`] as string) : '',
                }));
                return <FeaturesGridSection key={key} title={heading} features={features} />;
              }
              case 'featured_product': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
                const subtitle = typeof section.content.subtitle === 'string' ? section.content.subtitle : undefined;
                const buttonText = typeof section.content.button_text === 'string' ? section.content.button_text : undefined;
                const productIds = Array.isArray(section.content.product_ids)
                  ? (section.content.product_ids as unknown[]).filter((id): id is string => typeof id === 'string')
                  : [];
                const product = productIds.length ? productsById.get(productIds[0]) : undefined;
                return (
                  <FeaturedProductSection
                    key={key}
                    title={heading}
                    subtitle={subtitle}
                    product={product}
                    buttonText={buttonText}
                    websiteSlug={websiteSlug}
                  />
                );
              }
              case 'logo_wall': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
                const layout = typeof section.content.layout === 'string' ? section.content.layout : undefined;
                const logos = parseGalleryImages(section.content.logos);
                return <LogoWallSection key={key} title={heading} layout={layout} logos={logos} />;
              }
              case 'category_grid': {
                const heading = typeof section.content.title === 'string' ? section.content.title : 'Kategori Pilihan';
                return (
                  <CategoryGridSection
                    key={key}
                    title={heading}
                    products={topLevelProducts}
                    categories={categories}
                    websiteSlug={websiteSlug}
                  />
                );
              }
              case 'services_grid':
              case 'products_grid': {
                const filterType = typeof section.content.filter_type === 'string' ? section.content.filter_type : undefined;
                const defaultTitle = section.type === 'services_grid' ? 'Layanan Kami' : 'Produk Kami';
                const heading = typeof section.content.title === 'string' ? section.content.title : defaultTitle;
                return (
                  <ProductGridSection
                    key={key}
                    title={heading}
                    filterType={filterType}
                    initialProducts={topLevelProducts}
                    tenantSlug={tenantSlug}
                    websiteSlug={websiteSlug}
                  />
                );
              }
              case 'category_listing': {
                const categoryId = typeof section.content.category_id === 'string' ? section.content.category_id : '';
                const categoryLabel = typeof section.content.category_label === 'string' ? section.content.category_label : '';
                const categoryDetail = categories.find((c) => c.id === categoryId || c.label === categoryLabel);
                const initialItems = topLevelProducts.filter((p) => p.category === categoryLabel);
                return (
                  <CategoryListingSection
                    key={key}
                    categoryId={categoryId}
                    categoryLabel={categoryLabel}
                    categoryDetail={categoryDetail}
                    initialProducts={initialItems}
                    tenantSlug={tenantSlug}
                    websiteSlug={websiteSlug}
                    homeHref={homeHref}
                  />
                );
              }
              case 'locations_list': {
                const filterTypes = Array.isArray(section.content.filter_types)
                  ? (section.content.filter_types as unknown[]).filter((t): t is string => typeof t === 'string')
                  : undefined;
                const items = locations.filter((l) => !filterTypes || filterTypes.includes(l.type));
                const heading = typeof section.content.title === 'string' ? section.content.title : 'Kunjungi Kami';
                return <LocationsSection key={key} title={heading} items={items} />;
              }
              case 'faq_list': {
                const category = typeof section.content.filter_category === 'string' ? section.content.filter_category : undefined;
                const items = faqs.filter((f) => !category || f.category === category);
                const heading = typeof section.content.title === 'string' ? section.content.title : 'Pertanyaan Umum';
                return <FaqSection key={key} title={heading} items={items} />;
              }
              case 'rich_text': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
                const html = typeof section.content.html === 'string' ? section.content.html : '';
                return <RichTextSection key={key} title={heading} html={html} />;
              }
              case 'text_block': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
                const body = typeof section.content.body === 'string' ? section.content.body : '';
                const align = typeof section.content.align === 'string' ? section.content.align : undefined;
                return <TextBlockSection key={key} title={heading} body={body} align={align} />;
              }
              case 'about': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
                const body = typeof section.content.body === 'string' ? section.content.body : '';
                const imageUrl = typeof section.content.image_url === 'string' ? section.content.image_url : undefined;
                return <AboutSection key={key} title={heading} body={body} imageUrl={imageUrl} />;
              }
              case 'gallery': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
                const layout = typeof section.content.layout === 'string' ? section.content.layout : undefined;
                const images = parseGalleryImages(section.content.images);
                return <GallerySection key={key} title={heading} layout={layout} images={images} />;
              }
              case 'cta': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
                const subtitle = typeof section.content.subtitle === 'string' ? section.content.subtitle : undefined;
                const buttonText = typeof section.content.button_text === 'string' ? section.content.button_text : undefined;
                const buttonUrl = typeof section.content.button_url === 'string' ? section.content.button_url : undefined;
                return <CtaSection key={key} title={heading} subtitle={subtitle} buttonText={buttonText} buttonUrl={buttonUrl} />;
              }
              case 'testimonial': {
                const heading = typeof section.content.title === 'string' ? section.content.title : 'Apa Kata Mereka';
                return <TestimonialSection key={key} title={heading} />;
              }
              case 'contact': {
                const heading = typeof section.content.title === 'string' ? section.content.title : 'Hubungi Kami';
                return <ContactSection key={key} title={heading} profile={profile} />;
              }
              case 'blog_list': {
                const heading = typeof section.content.title === 'string' ? section.content.title : 'Artikel Terbaru';
                const limitRaw = section.content.limit;
                const limit = typeof limitRaw === 'string' && limitRaw.trim() ? parseInt(limitRaw, 10) : undefined;
                const items = Number.isFinite(limit) ? blogPosts.slice(0, limit) : blogPosts;
                return <BlogTwoColumnLayout key={key} title={heading} items={items} allPosts={blogPosts} websiteSlug={websiteSlug} />;
              }
              case 'blog_collection': {
                const heading = typeof section.content.title === 'string' ? section.content.title : 'Artikel Pilihan';
                const postIds = Array.isArray(section.content.post_ids)
                  ? (section.content.post_ids as unknown[]).filter((id): id is string => typeof id === 'string')
                  : [];
                const byId = new Map(blogPosts.map((p) => [p.id, p]));
                const items = postIds.map((id) => byId.get(id)).filter((p): p is BlogPostItem => Boolean(p));
                return <BlogTwoColumnLayout key={key} title={heading} items={items} allPosts={blogPosts} websiteSlug={websiteSlug} />;
              }
              case 'blog_search': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
                const placeholder = typeof section.content.placeholder === 'string' ? section.content.placeholder : undefined;
                return <BlogSearchSection key={key} title={heading} placeholder={placeholder} posts={blogPosts} websiteSlug={websiteSlug} />;
              }
              case 'blog_article': {
                const post = section.content.post as BlogPostItem | undefined;
                if (!post) return null;
                return <BlogArticleSection key={key} post={post} allPosts={blogPosts} websiteSlug={websiteSlug} />;
              }
              case 'cart': {
                return <CartContent key={key} basePath={websiteSlug ?? ''} websiteId={websiteId ?? ''} />;
              }
              case 'checkout': {
                const websiteId =
                  typeof section.content.websiteId === 'string' ? section.content.websiteId : '';
                const orderIds = Array.isArray(section.content.orderIds)
                  ? (section.content.orderIds as unknown[]).filter((v): v is string => typeof v === 'string')
                  : [];
                return (
                  <CheckoutContent
                    key={key}
                    basePath={websiteSlug ?? ''}
                    websiteId={websiteId}
                    initialOrderIds={orderIds}
                    locations={locations}
                  />
                );
              }
              case 'orders': {
                return <OrdersContent key={key} basePath={websiteSlug ?? ''} websiteId={websiteId ?? ''} />;
              }
              case 'tagihan': {
                return <TagihanContent key={key} basePath={websiteSlug ?? ''} websiteId={websiteId ?? ''} />;
              }
              case 'gathering_calendar': {
                return <GatheringCalendarContent key={key} basePath={websiteSlug ?? ''} websiteId={websiteId ?? ''} />;
              }
              case 'profile': {
                return <ProfileContent key={key} basePath={websiteSlug ?? ''} auth={auth} />;
              }
              case 'chat': {
                return (
                  <CustomerChatContent
                    key={key}
                    websiteId={websiteId ?? ''}
                    basePath={websiteSlug ?? ''}
                    whatsapp={profile.whatsapp}
                    email={profile.email}
                  />
                );
              }
              case 'order_detail': {
                const transaction = section.content.transaction as TransactionDetail | null | undefined;
                const order = section.content.order as OrderDetail | null | undefined;
                const gatheringPlan = section.content.gatheringPlan as import('../../order-detail-content').GatheringPlanDetail | null | undefined;
                return <OrderDetailContent key={key} transaction={transaction} order={order} gatheringPlan={gatheringPlan} basePath={websiteSlug ?? ''} websiteId={websiteId} loginHref={auth?.loginHref} />;
              }
              case 'product_detail': {
                const item = section.content.product as CatalogItem | undefined;
                if (!item) return null;
                return <ProductDetailSection key={key} item={item} allProducts={products} locations={locations} waHref={waHref} websiteSlug={websiteSlug} tenantSlug={tenantSlug} websiteId={websiteId} isLoggedIn={auth?.isLoggedIn} loginHref={auth?.loginHref} />;
              }
              default:
                return null;
            }
          })}

        {(chatHref || waHref) && !isChatPage && (
          <div className="fixed bottom-4 left-4 right-4 z-10 sm:hidden">
            <a
              href={chatHref || waHref || '#'}
              target={chatHref ? undefined : '_blank'}
              rel={chatHref ? undefined : 'noopener noreferrer'}
              className="flex w-full items-center justify-center rounded-full py-3.5 text-sm font-semibold uppercase tracking-wide shadow-lg"
              style={{ backgroundColor: 'var(--c-btn-primary-bg)', color: 'var(--c-btn-primary-text)' }}
            >
              Hubungi Kami
            </a>
          </div>
        )}

        <TemplateFooter
          blocks={footerBlocks}
          title={title}
          tagline={profile.tagline}
          logoUrl={profile.logoUrl}
          socialLinks={socialLinks}
          pageLinks={footerNavLinks}
          address={footerAddress}
          whatsapp={profile.whatsapp}
          waHref={waHref}
          phone={profile.phone}
          email={profile.email}
          compact={isChatPage}
        />
      </div>
    </>
  );
}
