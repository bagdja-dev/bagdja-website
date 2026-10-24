import type { FooterBlock, SocialLink } from '../../../lib/template-data';
import { MailIcon, MapPinIcon, PhoneIcon, SocialIcon } from '../store-classic/store-classic-icons';

export interface FooterLink {
  href: string;
  label: string;
}

/**
 * Footer global berbasis blok (`websites.footer_settings.blocks`) — dipakai semua template.
 * Warna lewat token `--c-footer-*` (lihat themeToCssVariables), tampilan per template
 * disesuaikan lewat `containerClassName` / `headingClassName`.
 */
interface TemplateFooterProps {
  /** Blok footer global (urutan tampil). Kosong → footer tidak dirender. */
  blocks: FooterBlock[];
  title: string;
  tagline?: string;
  logoUrl?: string;
  socialLinks: SocialLink[];
  pageLinks: FooterLink[];
  address?: string;
  whatsapp?: string;
  waHref?: string;
  phone?: string;
  email?: string;
  /** Halaman chat butuh footer lebih rapat */
  compact?: boolean;
  /** Lebar kontainer, ikut lebar konten template */
  containerClassName?: string;
  /** Kelas tambahan judul kolom (mis. font-mono untuk Workshop) */
  headingClassName?: string;
}

function readString(content: Record<string, unknown>, key: string): string | undefined {
  const value = content[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Toggle blok default-nya tampil; hanya `false` eksplisit yang menyembunyikan. */
function readFlag(content: Record<string, unknown>, key: string): boolean {
  return content[key] !== false;
}

const GRID_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
};

export function TemplateFooter({
  blocks,
  title,
  tagline,
  logoUrl,
  socialLinks,
  pageLinks,
  address,
  whatsapp,
  waHref,
  phone,
  email,
  compact = false,
  containerClassName = 'max-w-6xl',
  headingClassName = '',
}: TemplateFooterProps) {
  const headingClass = `${compact ? 'mb-2' : 'mb-3'} text-xs font-semibold uppercase tracking-wider ${headingClassName}`;
  const linkStyle = { color: 'var(--c-footer-link)', opacity: 0.85 };

  const renderHeading = (text?: string) =>
    text ? (
      <p className={headingClass} style={{ color: 'var(--c-footer-heading)' }}>
        {text}
      </p>
    ) : null;

  const renderSocial = () => (
    <div className="flex flex-wrap gap-2">
      {socialLinks.map((social) => (
        <a
          key={social.platform}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.platform}
          className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--c-footer-border)' }}
        >
          <SocialIcon platform={social.platform} />
        </a>
      ))}
    </div>
  );

  // Render tiap blok kolom; null = blok tidak punya isi untuk ditampilkan (mis. kontak semua dimatikan)
  const renderBlock = (block: FooterBlock) => {
    const { content } = block;
    switch (block.type) {
      case 'brand': {
        const showLogo = readFlag(content, 'show_logo') && logoUrl;
        const showName = readFlag(content, 'show_business_name');
        const showTagline = readFlag(content, 'show_tagline') && tagline;
        if (!showLogo && !showName && !showTagline) return null;
        return (
          <div>
            {(showLogo || showName) && (
              <div className="flex items-center gap-2">
                {showLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
                )}
                {showName && (
                  <span
                    className="text-sm font-bold uppercase tracking-widest"
                    style={{ color: 'var(--c-footer-heading)', fontFamily: 'var(--font-heading)' }}
                  >
                    {title}
                  </span>
                )}
              </div>
            )}
            {showTagline && (
              <p className={`${compact ? 'mt-2' : 'mt-3'} leading-relaxed`} style={{ opacity: 0.85 }}>
                {tagline}
              </p>
            )}
          </div>
        );
      }
      case 'page_links': {
        if (pageLinks.length === 0) return null;
        return (
          <div>
            {renderHeading(readString(content, 'title'))}
            <nav className="flex flex-col gap-2">
              {pageLinks.map((link) => (
                <a key={link.href} href={link.href} className="hover:underline" style={linkStyle}>
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        );
      }
      case 'contact': {
        const showAddress = readFlag(content, 'show_address') && address;
        const showWhatsapp = readFlag(content, 'show_whatsapp') && waHref;
        // Telepon disembunyikan bila sama dengan WhatsApp yang sudah tampil
        const showPhone = readFlag(content, 'show_phone') && phone && !(showWhatsapp && phone === whatsapp);
        const showEmail = readFlag(content, 'show_email') && email;
        if (!showAddress && !showWhatsapp && !showPhone && !showEmail) return null;
        return (
          <div>
            {renderHeading(readString(content, 'title'))}
            <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-2'}`}>
              {showAddress && (
                <span className="flex items-start gap-2" style={{ opacity: 0.85 }}>
                  <MapPinIcon />
                  {address}
                </span>
              )}
              {showWhatsapp && (
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline" style={linkStyle}>
                  <PhoneIcon />
                  {whatsapp}
                </a>
              )}
              {showPhone && (
                <a href={`tel:${phone}`} className="flex items-center gap-2 hover:underline" style={linkStyle}>
                  <PhoneIcon />
                  {phone}
                </a>
              )}
              {showEmail && (
                <a href={`mailto:${email}`} className="flex items-center gap-2 hover:underline" style={linkStyle}>
                  <MailIcon />
                  {email}
                </a>
              )}
            </div>
          </div>
        );
      }
      case 'social_links': {
        if (socialLinks.length === 0) return null;
        return (
          <div>
            {renderHeading(readString(content, 'title'))}
            {renderSocial()}
          </div>
        );
      }
      case 'text': {
        const heading = readString(content, 'title');
        const body = readString(content, 'body');
        if (!heading && !body) return null;
        return (
          <div>
            {renderHeading(heading)}
            {body && (
              <p className="whitespace-pre-line leading-relaxed" style={{ opacity: 0.85 }}>
                {body}
              </p>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const columns = blocks
    .filter((block) => block.type !== 'copyright')
    .map((block) => ({ id: block.id, node: renderBlock(block) }))
    .filter((column) => column.node !== null);
  const copyrightBlock = blocks.find((block) => block.type === 'copyright');
  const copyright = copyrightBlock ? readString(copyrightBlock.content, 'text') ?? `© ${new Date().getFullYear()} ${title}` : undefined;

  if (columns.length === 0 && !copyright) return null;

  const gridColumns = GRID_COLUMNS[columns.length] ?? 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <footer
      className="border-t"
      style={{ backgroundColor: 'var(--c-footer-bg)', borderColor: 'var(--c-footer-border)', color: 'var(--c-footer-text)' }}
    >
      {columns.length > 0 && (
        <div className={`mx-auto grid ${containerClassName} px-4 text-sm sm:px-6 ${gridColumns} ${compact ? 'gap-4 py-5' : 'gap-8 py-12'}`}>
          {columns.map((column) => (
            <div key={column.id}>{column.node}</div>
          ))}
        </div>
      )}
      {copyright && (
        <p
          className={`text-center text-xs ${columns.length > 0 ? 'border-t' : ''} ${compact ? 'py-3' : 'py-6'}`}
          style={{ borderColor: 'var(--c-footer-border)', opacity: 0.7 }}
        >
          {copyright}
        </p>
      )}
    </footer>
  );
}
