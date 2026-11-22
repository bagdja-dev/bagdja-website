'use client';

import { useState } from 'react';

import type {
  PortfolioCategoryItem,
  PortfolioClientItem,
  PortfolioProjectItem,
} from '../../../lib/template-data';
import { useTemplateText } from './template-locale';

export { PortfolioProjectDetailSection } from './portfolio-project-detail';

type PortfolioContent = Record<string, unknown>;

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function stringIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function sectionLimit(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(24, Math.max(1, Math.floor(parsed))) : fallback;
}

export function PortfolioProjectsSection({
  content,
  projects,
  categories,
  websiteSlug,
}: {
  content: PortfolioContent;
  projects: PortfolioProjectItem[];
  categories: PortfolioCategoryItem[];
  websiteSlug?: string;
}) {
  const t = useTemplateText();
  const [activeCategory, setActiveCategory] = useState('');
  const title = stringValue(content.title, t('featuredProjects'));
  const subtitle = stringValue(content.subtitle);
  const mode = stringValue(content.source_mode, 'latest');
  const selectedProjectIds = stringIds(content.project_ids);
  const selectedCategoryIds = stringIds(content.category_ids);
  const categoryMatch = stringValue(content.category_match, 'any');
  const showCategoryFilter = content.show_category_filter === true;
  const showExcerpt = content.show_excerpt !== false;
  const showYear = content.show_year !== false;
  const showTags = content.show_tags === true;
  const showClient = content.show_client !== false;
  const layout = stringValue(content.layout, 'grid');
  const limit = sectionLimit(content.limit, 6);

  const visibleCategories = categories.filter((category) =>
    selectedCategoryIds.length === 0 || selectedCategoryIds.includes(category.id),
  );
  let filteredProjects = [...projects];
  if (mode === 'selected') {
    const positions = new Map(selectedProjectIds.map((id, index) => [id, index]));
    filteredProjects = filteredProjects.filter((project) => positions.has(project.id))
      .sort((a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0));
  } else if (mode === 'categories' && selectedCategoryIds.length) {
    filteredProjects = filteredProjects.filter((project) => categoryMatch === 'all'
      ? selectedCategoryIds.every((id) => project.categories.some((category) => category.id === id))
      : selectedCategoryIds.some((id) => project.categories.some((category) => category.id === id)));
  } else if (mode === 'latest') {
    filteredProjects.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  if (activeCategory) {
    filteredProjects = filteredProjects.filter((project) =>
      project.categories.some((category) => category.id === activeCategory),
    );
  }
  filteredProjects = filteredProjects.slice(0, limit);
  if (!filteredProjects.length) return null;
  return (
    <section id="portfolio-projects" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {title.trim() || subtitle.trim() ? (
        <div className="mb-8">
          {title.trim() ? <h2 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2> : null}
          {subtitle.trim() ? <p className="mt-2 max-w-2xl text-sm text-[var(--brand-muted)] sm:text-base">{subtitle}</p> : null}
        </div>
      ) : null}
      {showCategoryFilter && visibleCategories.length ? (
        <div className="mb-6 flex flex-wrap gap-2" aria-label={t('categoryFilter')}>
          <button type="button" onClick={() => setActiveCategory('')} aria-pressed={!activeCategory} className="rounded-full border px-4 py-2 text-sm">
            {t('all')}
          </button>
          {visibleCategories.map((category) => (
            <button key={category.id} type="button" onClick={() => setActiveCategory((current) => current === category.id ? '' : category.id)} aria-pressed={activeCategory === category.id} className="rounded-full border px-4 py-2 text-sm">
              {category.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className={layout === 'carousel' ? 'flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3' : 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'}>
        {filteredProjects.map((project) => {
          const card = (
            <>
              {project.image ? (
                <div role="img" aria-label={project.title} className="aspect-[16/10] w-full bg-cover bg-center" style={{ backgroundImage: `url("${project.image.replace(/[\\"()]/g, (character) => encodeURIComponent(character))}")` }} />
              ) : <div className="aspect-[16/10] w-full bg-[var(--brand-surface)]" />}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--brand-muted)]">
                  {showYear && project.year ? <span>{project.year}</span> : null}
                  {showClient && project.clientName ? <span>{t('portfolioClient')} {project.clientName}</span> : null}
                </div>
                <h3 className="text-lg font-semibold">{project.title}</h3>
                {showExcerpt && project.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-[var(--brand-muted)]">{project.excerpt}</p> : null}
                {showTags && project.tags.length ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--brand-surface)] px-2.5 py-1 text-xs">{tag}</span>)}
                  </div>
                ) : null}
                <span className="mt-5 text-sm font-semibold text-[var(--brand-accent)]">
                  {t('viewProject')} →
                </span>
              </div>
            </>
          );
          const className = `flex ${layout === 'carousel' ? 'min-w-[min(85vw,360px)] snap-start' : 'min-w-0'} flex-col overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] shadow-sm`;
          const detailHref = websiteSlug !== undefined
            ? `${websiteSlug}/portfolio/${encodeURIComponent(project.slug)}`
            : undefined;
          return detailHref ? (
            <a key={project.id} href={detailHref} className={`${className} text-inherit no-underline transition-shadow hover:shadow-md`}>
              {card}
            </a>
          ) : <article key={project.id} className={className}>{card}</article>;
        })}
      </div>
    </section>
  );
}

export function PortfolioClientsSection({
  content,
  clients,
  isPreview = false,
}: {
  content: PortfolioContent;
  clients: PortfolioClientItem[];
  isPreview?: boolean;
}) {
  const t = useTemplateText();
  const title = stringValue(content.title, t('trustedBy'));
  const subtitle = stringValue(content.subtitle);
  const layout = stringValue(content.layout, 'grid');
  const showName = content.show_name !== false;
  const selectedCategorySlugs = stringIds(content.category_slugs);
  const visibleClients = clients
    .filter((client) => selectedCategorySlugs.length === 0
      || selectedCategorySlugs.some((slug) => client.categories.some((category) => category.slug === slug)))
    .slice(0, sectionLimit(content.limit, 12));
  if (!visibleClients.length) {
    if (!isPreview) return null;
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {title.trim() ? (
          <div className="mb-4 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
            {subtitle.trim() ? <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--brand-muted)] sm:text-base">{subtitle}</p> : null}
          </div>
        ) : null}
        <p className="rounded-xl border border-dashed border-[var(--brand-border)] px-4 py-8 text-center text-sm text-[var(--brand-muted)]">
          {t('noMatchingClients')}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {title.trim() || subtitle.trim() ? (
        <div className="mb-8 text-center">
          {title.trim() ? <h2 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2> : null}
          {subtitle.trim() ? <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--brand-muted)] sm:text-base">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className={layout === 'carousel' ? 'hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3' : 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'}>
        {visibleClients.map((client) => {
          const contentNode = (
            <>
              {client.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.logoUrl} alt={showName ? client.name : ''} loading="lazy" className="max-h-14 max-w-full object-contain" />
              ) : (
                <span className="text-xl font-bold text-[var(--brand-accent)]">{client.name.slice(0, 1).toUpperCase()}</span>
              )}
              {showName ? <span className="text-sm font-medium">{client.name}</span> : null}
            </>
          );
          const className = `flex min-h-28 ${layout === 'carousel' ? 'min-w-40 snap-start' : ''} flex-col items-center justify-center gap-3 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center`;
          return client.websiteUrl ? (
            <a key={client.id} href={client.websiteUrl} target="_blank" rel="noopener noreferrer" className={`${className} text-inherit no-underline`}>
              {contentNode}
            </a>
          ) : (
            <div key={client.id} className={className}>{contentNode}</div>
          );
        })}
      </div>
    </section>
  );
}
