import type { MetadataRoute } from 'next';

import { getWebsiteBySlug } from '../../lib/api-client';
import { tenantCanonicalUrl } from '../../lib/content-seo';

interface RobotsProps {
  params: { website_slug: string };
}

export default async function robots({ params }: RobotsProps): Promise<MetadataRoute.Robots> {
  const website = await getWebsiteBySlug(params.website_slug);
  if (!website) return { rules: { userAgent: '*', disallow: '/' } };

  return {
    rules: {
      userAgent: '*',
      disallow: ['/cart', '/checkout', '/orders', '/order/', '/profile', '/tagihan', '/calendar', '/chat'],
    },
    sitemap: tenantCanonicalUrl(params.website_slug, '/sitemap.xml', website),
  };
}
