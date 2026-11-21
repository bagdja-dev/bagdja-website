import { getWebsiteBySlug } from '../../../lib/api-client';
import { tenantCanonicalUrl } from '../../../lib/content-seo';

interface RobotsRouteContext {
  params: { website_slug: string };
}

export async function GET(_request: Request, { params }: RobotsRouteContext): Promise<Response> {
  const website = await getWebsiteBySlug(params.website_slug);
  const rules = website
    ? [
      'User-Agent: *',
      'Disallow: /cart',
      'Disallow: /checkout',
      'Disallow: /orders',
      'Disallow: /order/',
      'Disallow: /profile',
      'Disallow: /tagihan',
      'Disallow: /calendar',
      'Disallow: /chat',
      `Sitemap: ${tenantCanonicalUrl(params.website_slug, '/sitemap.xml', website)}`,
    ]
    : ['User-Agent: *', 'Disallow: /'];

  return new Response(`${rules.join('\n')}\n`, {
    status: website ? 200 : 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
