'use client';

import { useState } from 'react';

import type { PortfolioCategoryItem, PortfolioProjectItem } from '../../../lib/template-data';
import { useTemplateText } from '../shared/template-locale';

type PortfolioContent = Record<string, unknown>;

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function stringIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function StoreClassicPortfolio({
  content,
  projects,
  categories,
}: {
  content: PortfolioContent;
  projects: PortfolioProjectItem[];
  categories: PortfolioCategoryItem[];
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
  const limitValue = typeof content.limit === 'number' ? content.limit : Number(content.limit);
  const limit = Number.isFinite(limitValue) ? Math.min(24, Math.max(1, Math.floor(limitValue))) : 6;

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
  if (activeCategory) filteredProjects = filteredProjects.filter((project) =>
    project.categories.some((category) => category.id === activeCategory),
  );
  filteredProjects = filteredProjects.slice(0, limit);

  if (!filteredProjects.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {title.trim() ? (
        <div className="mb-8">
          <h2 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
          {subtitle.trim() ? <p className="mt-2 max-w-2xl text-sm text-default-600 sm:text-base">{subtitle}</p> : null}
        </div>
      ) : null}
      {showCategoryFilter && visibleCategories.length ? (
        <div className="mb-6 flex flex-wrap gap-2" aria-label={t('categoryFilter')}>
          <button
            type="button"
            onClick={() => setActiveCategory('')}
            aria-pressed={!activeCategory}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${!activeCategory ? 'border-primary bg-primary text-white' : 'border-default-300 text-default-700 hover:border-primary'}`}
          >
            {t('all')}
          </button>
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory((current) => current === category.id ? '' : category.id)}
              aria-pressed={activeCategory === category.id}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${activeCategory === category.id ? 'border-primary bg-primary text-white' : 'border-default-300 text-default-700 hover:border-primary'}`}
            >
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
                <div
                  role="img"
                  aria-label={project.title}
                  className="aspect-[16/10] w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${project.image.replace(/[\\"()]/g, (character) => encodeURIComponent(character))}")` }}
                />
              ) : <div className="aspect-[16/10] w-full bg-default-100" />}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-default-500">
                  {showYear && project.year ? <span>{project.year}</span> : null}
                  {showClient && project.clientName ? <span>Klien: {project.clientName}</span> : null}
                </div>
                <h3 className="text-lg font-semibold text-foreground">{project.title}</h3>
                {showExcerpt && project.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-default-600">{project.excerpt}</p> : null}
                {showTags && project.tags.length ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => <span key={tag} className="rounded-full bg-default-100 px-2.5 py-1 text-xs text-default-600">{tag}</span>)}
                  </div>
                ) : null}
              </div>
            </>
          );
          const className = `flex ${layout === 'carousel' ? 'min-w-[min(85vw,360px)] snap-start' : 'min-w-0'} flex-col overflow-hidden rounded-2xl border border-default-200 bg-white shadow-sm`;
          return project.projectUrl ? (
            <a key={project.id} href={project.projectUrl} target="_blank" rel="noopener noreferrer" className={`${className} text-inherit no-underline transition-shadow hover:shadow-md`}>
              {card}
            </a>
          ) : (
            <article key={project.id} className={className}>{card}</article>
          );
        })}
      </div>
    </section>
  );
}
