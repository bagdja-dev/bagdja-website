/**
 * Template: Barber Classic (shared renderer)
 * Dipakai oleh:
 *  - /templates/barber-classic (dev preview via searchParams + sample data)
 *  - /[website_slug] (render tenant sungguhan dari master data + sections)
 */

import {
  buildBlogPostHref,
  buildCategoryHref,
  buildMapEmbedUrl,
  buildPageHref,
  buildProductHref,
  buildWhatsAppHref,
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
} from '../../../lib/template-data';
import {
  getGoogleFontsUrl,
  resolveTheme,
  themeToCssVariables,
  type WebsiteTheme,
} from '../../../lib/website-theme';
import { BarberClassicBlogSearch } from './barber-classic-blog-search';
import { CatalogGridSection, CategoryListingSection, VariantTreeSelector } from './barber-classic-catalog';
import { BarberClassicGalleryCarousel } from './barber-classic-gallery-carousel';
import { BarberClassicHeader, type HeaderNavLink } from './barber-classic-header';
import { SocialIcon } from './barber-classic-icons';

export interface BarberClassicProfile {
  name?: string;
  tagline?: string;
  logoUrl?: string;
  whatsapp?: string;
  phone?: string;
  email?: string;
  socialLinks?: Record<string, unknown>;
}

export interface BarberClassicViewProps {
  /** true saat dirender di dalam iframe live-preview admin — sembunyikan footer branding */
  isPreview: boolean;
  profile: BarberClassicProfile;
  templateTheme?: WebsiteTheme;
  websiteTheme?: WebsiteTheme;
  sections: SectionEntry[];
  products: CatalogItem[];
  categories?: CategoryItem[];
  locations: LocationItem[];
  faqs: FaqItem[];
  /** Slug asli tenant (bukan basePath) — dipakai fetch client-side (pagination/filter) ke API publik. */
  tenantSlug?: string;
  /**
   * BUKAN raw slug — ini base path yang sudah di-resolve caller lewat
   * `resolveTenantLinkBase()` ('' untuk subdomain/custom domain, `/{slug}`
   * untuk path-based/local dev). Dipakai membangun link antar-halaman
   * (header/footer nav, kartu produk/blog). `undefined` = belum siap
   * (preview tanpa tenant nyata), string kosong `''` tetap valid (bukan
   * "belum siap") — jangan pakai truthy check `websiteSlug ? ... : ...`,
   * pakai `websiteSlug !== undefined`.
   */
  websiteSlug?: string;
  /** semua halaman website, dipakai untuk nav header/footer (filter by placement) */
  pages?: NavPage[];
  /** artikel blog terbit — dipakai section blog_list/blog_search/blog_collection */
  blogPosts?: BlogPostItem[];
}

export function CatalogCard({ item, websiteSlug }: { item: CatalogItem; websiteSlug?: string }) {
  const href = websiteSlug !== undefined ? buildProductHref(websiteSlug, item.slug) : undefined;
  const Wrapper = href ? 'a' : 'div';
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="block overflow-hidden rounded-xl border text-left transition-colors hover:opacity-90"
      style={{
        backgroundColor: 'var(--brand-surface)',
        borderColor: 'var(--brand-border)',
      }}
    >
      {item.image ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="p-5">
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
    </Wrapper>
  );
}

interface CategoryEntry {
  image?: string;
  count: number;
}

function CategoryTile({
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className={`absolute inset-x-0 bottom-0 p-4 text-white ${featured ? 'sm:p-6' : ''}`}>
        <p
          className={`font-bold uppercase tracking-wide ${featured ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {category}
        </p>
        {featured && <p className="mt-1 text-sm text-white/70">{entry.count} item</p>}
      </div>
    </a>
  );
}

/** Hero khusus halaman listing kategori — background foto kategori, judul = nama kategori. */
function CategoryHeroSection({ label, imageUrl }: { label: string; imageUrl?: string }) {
  return (
    <section
      className="relative flex items-center justify-center overflow-hidden px-4 py-16 text-center sm:py-20"
      style={imageUrl ? undefined : { backgroundColor: 'var(--brand-accent)' }}
    >
      {imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}
      <h1
        className="relative z-10 text-3xl font-semibold sm:text-5xl"
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
  for (const [label, entry] of byCategory) {
    const cover = categories.find((c) => c.label === label)?.images[0];
    if (cover) entry.image = cover;
  }

  const groupedEntries = [...byCategory.entries()];
  if (groupedEntries.length === 0) return null;

  const basePath = websiteSlug ?? '';
  const [[featuredCategory, featuredEntry], ...rest] = groupedEntries;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {title?.trim() && (
        <div
          className="mb-6 flex justify-center px-3 py-2 items-center text-center text-xl font-semibold sm:text-2xl radius-lg"
          style={{
            backgroundImage: 'radial-gradient(circle at center, var(--brand-accent), transparent)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--brand-on-accent)',
            borderColor: 'var(--brand-accent)',
          }}
        >
          <h2
            className="text-xl font-semibold sm:text-2xl"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
          >
            {title}
          </h2>
        </div>
      )}
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

function LocationCard({ location }: { location: LocationItem }) {
  const waHref = buildWhatsAppHref(location.whatsapp);
  return (
    <div
      className="rounded-xl border p-5 text-left"
      style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
    >
      <p className="font-medium" style={{ fontFamily: 'var(--font-heading)' }}>
        {location.name}
        {location.isPrimary && (
          <span
            className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
          >
            Utama
          </span>
        )}
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
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--brand-accent-muted)' }}
          >
            WhatsApp
          </a>
        )}
        {location.phone && <span style={{ color: 'var(--brand-muted)' }}>{location.phone}</span>}
        {location.mapsUrl && (
          <a
            href={location.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--brand-accent-muted)' }}
          >
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
  const showList = items.length > 1;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex justify-center px-3 py-2 items-center mb-6 text-center text-xl font-semibold sm:text-2xl radius-lg" style={{ backgroundImage: 'radial-gradient(circle at center, var(--brand-accent), transparent)', borderRadius: 'var(--radius-lg)', color: 'var(--brand-on-accent)', borderColor: 'var(--brand-accent)' }}>
        <h2
          className="text-xl font-semibold sm:text-2xl"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
          {title?.trim()}
        </h2>
      </div>
      <div className={showList ? 'grid gap-4 sm:grid-cols-5' : ''}>
        {showList && (
          <div className="flex flex-col gap-4 sm:col-span-2">
            {items.map((location) => (
              <LocationCard key={location.id} location={location} />
            ))}
          </div>
        )}
        <div
          className={`overflow-hidden rounded-xl border ${showList ? 'sm:col-span-3' : ''}`}
          style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
        >
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
            <div
              className="flex h-72 items-center justify-center px-4 text-center text-sm sm:h-full sm:min-h-[320px]"
              style={{ color: 'var(--brand-muted)' }}
            >
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
      <h2
        className="mb-6 text-center text-xl font-semibold sm:text-2xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
      >
        {title}
      </h2>
      <div className="space-y-3">
        {items.map((faq) => (
          <details
            key={faq.id}
            className="rounded-xl border p-4"
            style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
          >
            <summary
              className="cursor-pointer marker:content-none"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
            >
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
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl p-6 text-gray-800 shadow-sm sm:p-8">
        {title && (
          <h2 className="mb-4 text-center text-xl font-semibold sm:text-2xl" style={{ color: 'var(--brand-on-accent)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}>
            {title}
          </h2>
        )}
        <div
          className="overflow-x-auto text-sm leading-relaxed sm:text-base [&_a]:text-blue-600 [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_ul]:list-disc"
          style={{ color: 'var(--brand-muted)' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}

function TextBlockSection({
  title,
  body,
  align,
}: {
  title?: string;
  body: string;
  align?: string;
}) {
  if (!body.trim()) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className={align === 'center' ? 'text-center' : 'text-left'}>
        {title && (
          <h2
            className="mb-4 text-xl font-semibold sm:text-2xl"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
          >
            {title}
          </h2>
        )}
        <p
          className="whitespace-pre-line text-sm leading-relaxed sm:text-base"
          style={{ color: 'var(--brand-muted)' }}
        >
          {body}
        </p>
      </div>
    </section>
  );
}

function AboutSection({
  title,
  body,
  imageUrl,
}: {
  title?: string;
  body: string;
  imageUrl?: string;
}) {
  if (!body.trim() && !imageUrl) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className={`grid gap-6 ${imageUrl ? 'sm:grid-cols-2 sm:items-center' : ''}`}>
        {imageUrl && (
          <div className="overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        )}
        <div>
          {title && (
            <h2
              className="mb-3 text-xl font-semibold sm:text-2xl"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
            >
              {title}
            </h2>
          )}
          {body && (
            <p
              className="whitespace-pre-line text-sm leading-relaxed sm:text-base"
              style={{ color: 'var(--brand-muted)' }}
            >
              {body}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function GalleryFigure({ image }: { image: GalleryImageItem }) {
  return (
    <figure
      className="overflow-hidden rounded-xl"
      style={{ backgroundColor: 'var(--brand-surface)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={image.alt ?? ''} className="aspect-square w-full object-cover" loading="lazy" />
      {image.caption && (
        <figcaption className="p-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

function GallerySection({
  title,
  layout,
  images,
}: {
  title?: string;
  layout?: string;
  images: GalleryImageItem[];
}) {
  if (!images.length) return null;
  return (
    <section className="mx-auto w-full">
      {title && layout !== 'carousel' && (
        <h2
          className="mb-6 text-center text-xl font-semibold sm:text-2xl"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
          {title}
        </h2>
      )}
      {layout === 'carousel' ? (
        <BarberClassicGalleryCarousel images={images} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <GalleryFigure key={index} image={image} />
          ))}
        </div>
      )}
    </section>
  );
}

function CtaSection({
  title,
  subtitle,
  buttonText,
  buttonUrl,
}: {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  if (!title && !subtitle && !buttonUrl) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
      {title && (
        <h2
          className="text-xl font-semibold sm:text-2xl"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
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
          className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-medium transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
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
      <h2
        className="text-xl font-semibold sm:text-2xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
      >
        {title}
      </h2>
    </section>
  );
}

function ContactSection({ title, profile }: { title: string; profile: BarberClassicProfile }) {
  const waHref = buildWhatsAppHref(profile.whatsapp);
  if (!profile.phone && !profile.email && !waHref) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
      <h2
        className="mb-4 text-xl font-semibold sm:text-2xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
      >
        {title}
      </h2>
      <div
        className="flex flex-col items-center gap-2 text-sm sm:flex-row sm:justify-center sm:gap-6"
        style={{ color: 'var(--brand-muted)' }}
      >
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--brand-accent-muted)' }}
          >
            WhatsApp: {profile.whatsapp}
          </a>
        )}
        {profile.phone && <span>{profile.phone}</span>}
        {profile.email && <span>{profile.email}</span>}
      </div>
    </section>
  );
}

function MapPinIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h1.5a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.5 1.5 0 0 0-1.417.39l-.97.97a1.5 1.5 0 0 1-1.65.313 11.25 11.25 0 0 1-5.373-5.373 1.5 1.5 0 0 1 .313-1.65l.97-.97a1.5 1.5 0 0 0 .39-1.417L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
      />
    </svg>
  );
}

function BlogPostCard({ post, websiteSlug }: { post: BlogPostItem; websiteSlug?: string }) {
  const href = websiteSlug !== undefined ? buildBlogPostHref(websiteSlug, post.slug) : '#';
  return (
    <a
      href={href}
      className="block overflow-hidden rounded-xl border text-left transition-colors hover:opacity-90"
      style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
    >
      {post.coverImage ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/20">
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
        <p
          className="mt-1 font-medium"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
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

function BlogListSection({
  title,
  posts,
  limit,
  websiteSlug,
}: {
  title: string;
  posts: BlogPostItem[];
  limit?: number;
  websiteSlug?: string;
}) {
  const items = limit ? posts.slice(0, limit) : posts;
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h2
        className="mb-6 text-center text-xl font-semibold sm:text-2xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
      >
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((post) => (
          <BlogPostCard key={post.id} post={post} websiteSlug={websiteSlug} />
        ))}
      </div>
    </section>
  );
}

function BlogCollectionSection({
  title,
  posts,
  postIds,
  websiteSlug,
}: {
  title: string;
  posts: BlogPostItem[];
  postIds: string[];
  websiteSlug?: string;
}) {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const items = postIds.map((id) => byId.get(id)).filter((p): p is BlogPostItem => Boolean(p));
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h2
        className="mb-6 text-center text-xl font-semibold sm:text-2xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
      >
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((post) => (
          <BlogPostCard key={post.id} post={post} websiteSlug={websiteSlug} />
        ))}
      </div>
    </section>
  );
}

function BlogArticleSection({ post }: { post: BlogPostItem }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {post.publishedAtLabel && (
        <p className="text-center text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--brand-accent)' }}>
          {post.publishedAtLabel}
        </p>
      )}
      <h1
        className="mt-3 text-center text-2xl font-semibold sm:text-4xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
      >
        {post.title}
      </h1>
      {post.coverImage && (
        <div className="mt-8 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImage} alt="" className="aspect-[16/9] w-full object-cover" />
        </div>
      )}
      <div
        className="mt-8 text-sm leading-relaxed sm:text-base [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-4 [&_ul]:list-disc"
        style={{ color: 'var(--brand-muted)' }}
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </section>
  );
}

/** Klik swatch/tombol navigasi ke halaman produk varian itu sendiri (setiap varian punya slug sendiri) — tidak butuh state client. */
function ProductDetailSection({
  item,
  allProducts,
  waHref,
  websiteSlug,
}: {
  item: CatalogItem;
  allProducts: CatalogItem[];
  waHref?: string;
  websiteSlug?: string;
}) {
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];
  const familyId = item.parentProductId ?? item.id;
  const family = allProducts.filter((p) => p.id === familyId || p.parentProductId === familyId);
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {images.length > 0 && (
        <BarberClassicGalleryCarousel images={images.map((url) => ({ url }))} />
      )}
      <h1
        className="mt-8 text-center text-2xl font-semibold sm:text-4xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
      >
        {item.name}
      </h1>
      {item.priceLabel && (
        <p className="mt-3 text-center text-lg font-bold" style={{ color: 'var(--brand-accent-muted)' }}>
          {item.priceLabel}
        </p>
      )}
      {item.description && (
        <p className="mt-4 text-center text-sm sm:text-base" style={{ color: 'var(--brand-muted)' }}>
          {item.description}
        </p>
      )}

      <VariantTreeSelector family={family} currentId={item.id} websiteSlug={websiteSlug} />

      {item.detail && (
        <div
          className="mt-8 text-sm leading-relaxed sm:text-base [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-4 [&_ul]:list-disc"
          style={{ color: 'var(--brand-muted)' }}
          dangerouslySetInnerHTML={{ __html: item.detail }}
        />
      )}
      {waHref && (
        <div className="mt-8 flex justify-center">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-full px-6 py-3 text-sm font-medium transition-transform hover:scale-105 active:scale-95"
            style={{
              backgroundColor: 'var(--brand-accent)',
              color: 'var(--brand-on-accent)',
            }}
          >
            Booking via WhatsApp
          </a>
        </div>
      )}
    </section>
  );
}

export function BarberClassicView({
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
  blogPosts = [],
}: BarberClassicViewProps) {
  const title = profile.name?.trim() || 'Nama Barbershop Anda';
  const tagline =
    profile.tagline?.trim() ||
    'Barbershop terpercaya dengan layanan potong rambut, cukur, dan grooming premium.';
  const waHref = buildWhatsAppHref(profile.whatsapp);

  const resolved = resolveTheme(templateTheme, websiteTheme);
  const cssVars = themeToCssVariables(resolved);
  const fontsUrl = getGoogleFontsUrl(resolved.typography);

  const heroContent = sections.find((s) => s.type === 'hero')?.content ?? {};
  const heroSubtitle =
    typeof heroContent.subtitle === 'string' ? heroContent.subtitle : 'Premium Barbershop';
  const showWhatsappCta = heroContent.show_whatsapp_cta !== false;

  const categoryListingContent = sections.find((s) => s.type === 'category_listing')?.content;
  const categoryListingLabel =
    typeof categoryListingContent?.category_label === 'string' ? categoryListingContent.category_label : undefined;
  const categoryListingImage = categoryListingLabel
    ? categories.find((c) => c.label === categoryListingLabel)?.images[0]
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
  const primaryLocation = locations.find((l) => l.isPrimary) ?? locations[0];
  const footerAddress = primaryLocation
    ? [primaryLocation.addressLine, primaryLocation.city].filter(Boolean).join(', ')
    : undefined;

  // Sembunyikan row varian (warna/ukuran) dari grid/listing — 1 keluarga
  // varian cuma tampil 1 kartu (produk induk). Halaman detail tetap pakai
  // `products` penuh supaya varian bisa diakses via slug-nya.
  const topLevelProducts = products.filter((p) => !p.parentProductId);

  return (
    <>
      {fontsUrl ? <link rel="stylesheet" href={fontsUrl} /> : null}
      <div
        className="min-h-screen"
        style={{
          ...cssVars,
          backgroundColor: 'var(--brand-bg)',
          color: 'var(--brand-text)',
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-body-weight)',
        }}
      >
        <BarberClassicHeader
          title={title}
          logoUrl={profile.logoUrl}
          homeHref={homeHref}
          waHref={waHref}
          showWhatsappCta={showWhatsappCta}
          leftNavLinks={regularNavLinks}
          rightNavLinks={headerNavLinks}
          socialLinks={socialLinks}
        />

        {categoryListingLabel && (
          <CategoryHeroSection label={categoryListingLabel} imageUrl={categoryListingImage} />
        )}

        {/* <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--brand-accent)' }}>
            {heroSubtitle}
          </p>
          <h1
            className="mt-4 font-semibold"
            style={{
              fontSize: 'calc(1.875rem * var(--heading-scale))',
              fontFamily: 'var(--font-heading)',
              fontWeight: 'var(--font-heading-weight)',
            }}
          >
            <span className="sm:hidden">{title}</span>
            <span className="hidden sm:inline" style={{ fontSize: 'calc(3.75rem * var(--heading-scale))' }}>
              {title}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-sm sm:text-base" style={{ color: 'var(--brand-muted)' }}>
            {tagline}
          </p>
          {showWhatsappCta && (
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full px-6 py-3 text-sm font-medium transition-transform hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: 'var(--brand-accent)',
                    color: 'var(--brand-on-accent)',
                  }}
                >
                  Booking via WhatsApp
                </a>
              ) : (
                <span
                  className="inline-flex rounded-full px-6 py-3 text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--brand-accent)',
                    color: 'var(--brand-on-accent)',
                  }}
                >
                  Booking via WhatsApp
                </span>
              )}
            </div>
          )}
          {(profile.phone || profile.email) && (
            <p className="mt-6 text-xs" style={{ color: 'var(--brand-muted)', opacity: 0.8 }}>
              {[profile.phone, profile.email].filter(Boolean).join(' · ')}
            </p>
          )}
        </section> */}

        {sections
          .filter((section) => section.type !== 'hero')
          .map((section, index) => {
            const key = `${section.type}-${index}`;
            switch (section.type) {
              case 'category_grid': {
                const heading = typeof section.content.title === 'string' ? section.content.title : undefined;
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
                  <CatalogGridSection
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
                const initialItems = topLevelProducts.filter((p) => p.category === categoryLabel);
                return (
                  <CategoryListingSection
                    key={key}
                    categoryId={categoryId}
                    categoryLabel={categoryLabel}
                    initialProducts={initialItems}
                    tenantSlug={tenantSlug}
                    websiteSlug={websiteSlug}
                    homeHref={homeHref}
                  />
                );
              }
              case 'locations_list': {
                const filterTypes = Array.isArray(section.content.filter_types)
                  ? (section.content.filter_types as unknown[]).filter(
                    (t): t is string => typeof t === 'string',
                  )
                  : undefined;
                const items = locations.filter((l) => !filterTypes || filterTypes.includes(l.type));
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : 'Kunjungi Kami';
                return <LocationsSection key={key} title={heading} items={items} />;
              }
              case 'faq_list': {
                const category =
                  typeof section.content.filter_category === 'string'
                    ? section.content.filter_category
                    : undefined;
                const items = faqs.filter((f) => !category || f.category === category);
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : 'Pertanyaan Umum';
                return <FaqSection key={key} title={heading} items={items} />;
              }
              case 'rich_text': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : undefined;
                const html = typeof section.content.html === 'string' ? section.content.html : '';
                return <RichTextSection key={key} title={heading} html={html} />;
              }
              case 'text_block': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : undefined;
                const body = typeof section.content.body === 'string' ? section.content.body : '';
                const align = typeof section.content.align === 'string' ? section.content.align : undefined;
                return <TextBlockSection key={key} title={heading} body={body} align={align} />;
              }
              case 'about': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : undefined;
                const body = typeof section.content.body === 'string' ? section.content.body : '';
                const imageUrl =
                  typeof section.content.image_url === 'string' ? section.content.image_url : undefined;
                return <AboutSection key={key} title={heading} body={body} imageUrl={imageUrl} />;
              }
              case 'gallery': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : undefined;
                const layout =
                  typeof section.content.layout === 'string' ? section.content.layout : undefined;
                const images = parseGalleryImages(section.content.images);
                return <GallerySection key={key} title={heading} layout={layout} images={images} />;
              }
              case 'cta': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : undefined;
                const subtitle =
                  typeof section.content.subtitle === 'string' ? section.content.subtitle : undefined;
                const buttonText =
                  typeof section.content.button_text === 'string' ? section.content.button_text : undefined;
                const buttonUrl =
                  typeof section.content.button_url === 'string' ? section.content.button_url : undefined;
                return (
                  <CtaSection
                    key={key}
                    title={heading}
                    subtitle={subtitle}
                    buttonText={buttonText}
                    buttonUrl={buttonUrl}
                  />
                );
              }
              case 'testimonial': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : 'Apa Kata Mereka';
                return <TestimonialSection key={key} title={heading} />;
              }
              case 'contact': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : 'Hubungi Kami';
                return <ContactSection key={key} title={heading} profile={profile} />;
              }
              case 'blog_list': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : 'Artikel Terbaru';
                const limitRaw = section.content.limit;
                const limit =
                  typeof limitRaw === 'string' && limitRaw.trim() ? parseInt(limitRaw, 10) : undefined;
                return (
                  <BlogListSection
                    key={key}
                    title={heading}
                    posts={blogPosts}
                    limit={Number.isFinite(limit) ? limit : undefined}
                    websiteSlug={websiteSlug}
                  />
                );
              }
              case 'blog_collection': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : 'Artikel Pilihan';
                const postIds = Array.isArray(section.content.post_ids)
                  ? (section.content.post_ids as unknown[]).filter((id): id is string => typeof id === 'string')
                  : [];
                return (
                  <BlogCollectionSection
                    key={key}
                    title={heading}
                    posts={blogPosts}
                    postIds={postIds}
                    websiteSlug={websiteSlug}
                  />
                );
              }
              case 'blog_search': {
                const heading =
                  typeof section.content.title === 'string' ? section.content.title : undefined;
                const placeholder =
                  typeof section.content.placeholder === 'string' ? section.content.placeholder : undefined;
                return (
                  <BarberClassicBlogSearch
                    key={key}
                    title={heading}
                    placeholder={placeholder}
                    posts={blogPosts}
                    websiteSlug={websiteSlug}
                  />
                );
              }
              case 'blog_article': {
                const post = section.content.post as BlogPostItem | undefined;
                if (!post) return null;
                return <BlogArticleSection key={key} post={post} />;
              }
              case 'product_detail': {
                const item = section.content.product as CatalogItem | undefined;
                if (!item) return null;
                return (
                  <ProductDetailSection key={key} item={item} allProducts={products} waHref={waHref} websiteSlug={websiteSlug} />
                );
              }
              default:
                return null;
            }
          })}

        {waHref && (
          <div className="fixed bottom-4 left-4 right-4 z-10 sm:hidden">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center rounded-full py-3.5 text-sm font-semibold shadow-lg"
              style={{
                backgroundColor: 'var(--brand-accent)',
                color: 'var(--brand-on-accent)',
              }}
            >
              Booking via WhatsApp
            </a>
          </div>
        )}

        {!isPreview && (
          <footer className="border-t" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>
            <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 text-sm sm:grid-cols-3 sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  {profile.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
                  )}
                  <span
                    className="text-sm tracking-widest"
                    style={{
                      color: 'var(--brand-accent-muted)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 'var(--font-heading-weight)',
                    }}
                  >
                    {title.toUpperCase()}
                  </span>
                </div>
                {profile.tagline && <p className="mt-3 leading-relaxed" style={{ opacity: 0.85 }}>{profile.tagline}</p>}
                {socialLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {socialLinks.map((social) => (
                      <a
                        key={social.platform}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.platform}
                        className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:opacity-80"
                        style={{ borderColor: 'var(--brand-border)' }}
                      >
                        <SocialIcon platform={social.platform} />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {footerNavLinks.length > 0 && (
                <div>
                  <p
                    className="mb-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--brand-accent-muted)' }}
                  >
                    Halaman
                  </p>
                  <nav className="flex flex-col gap-2">
                    {footerNavLinks.map((link) => (
                      <a key={link.href} href={link.href} className="hover:underline" style={{ opacity: 0.85 }}>
                        {link.label}
                      </a>
                    ))}
                  </nav>
                </div>
              )}

              {(footerAddress || profile.phone || waHref || profile.email) && (
                <div>
                  <p
                    className="mb-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--brand-accent-muted)' }}
                  >
                    Kontak
                  </p>
                  <div className="flex flex-col gap-2">
                    {footerAddress && (
                      <span className="flex items-start gap-2" style={{ opacity: 0.85 }}>
                        <MapPinIcon />
                        {footerAddress}
                      </span>
                    )}
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline"
                        style={{ opacity: 0.85 }}
                      >
                        <PhoneIcon />
                        {profile.whatsapp}
                      </a>
                    )}
                    {!waHref && profile.phone && (
                      <span className="flex items-center gap-2" style={{ opacity: 0.85 }}>
                        <PhoneIcon />
                        {profile.phone}
                      </span>
                    )}
                    {profile.email && (
                      <a
                        href={`mailto:${profile.email}`}
                        className="flex items-center gap-2 hover:underline"
                        style={{ opacity: 0.85 }}
                      >
                        <MailIcon />
                        {profile.email}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="border-t py-6 text-center text-xs" style={{ borderColor: 'var(--brand-border)', opacity: 0.7 }}>
              © Bagdja Website Builder
            </p>
          </footer>
        )}
      </div>
    </>
  );
}
