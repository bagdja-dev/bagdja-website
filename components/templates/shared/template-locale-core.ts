export type RendererLocale = 'en' | 'id';

export function resolveTemplateLocale(acceptLanguage?: string | null): RendererLocale {
  const candidates = (acceptLanguage ?? '')
    .split(',')
    .map((part, index) => {
      const [tag, ...parameters] = part.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase().split('-')[0], quality, index };
    })
    .filter(({ tag, quality }) => (tag === 'en' || tag === 'id') && Number.isFinite(quality) && quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  return candidates[0]?.tag === 'en' ? 'en' : 'id';
}
