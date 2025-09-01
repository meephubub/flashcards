import type { MetadataRoute } from 'next';

// Configuration constants for better maintainability
const SITEMAP_CONFIG = {
  baseUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  defaultChangeFreq: 'weekly' as const,
  highPriority: 1.0,
  mediumPriority: 0.8,
  lowPriority: 0.5,
} as const;

// Route definitions with metadata
const ROUTES = [
  {
    path: '/home',
    changeFrequency: 'weekly',
    priority: SITEMAP_CONFIG.highPriority,
    description: 'Homepage - Main landing page',
  },
  {
    path: '/home/pricing',
    changeFrequency: 'weekly',
    priority: SITEMAP_CONFIG.highPriority,
    description: 'Pricing page - Service pricing information',
  },
  {
    path: '/home/about-us',
    changeFrequency: 'weekly',
    priority: SITEMAP_CONFIG.highPriority,
    description: 'About Us - Company information',
  },
  {
    path: '/home/careers',
    changeFrequency: 'monthly',
    priority: SITEMAP_CONFIG.mediumPriority,
    description: 'Careers - Job opportunities',
  },
  {
    path: '/home/privacy-policy',
    changeFrequency: 'monthly',
    priority: SITEMAP_CONFIG.mediumPriority,
    description: 'Privacy Policy - Data protection information',
  },
  {
    path: '/home/terms-of-service',
    changeFrequency: 'weekly',
    priority: SITEMAP_CONFIG.highPriority,
    description: 'Terms of Service - Legal terms and conditions',
  },
  {
    path: '/home/contact',
    changeFrequency: 'monthly',
    priority: SITEMAP_CONFIG.mediumPriority,
    description: 'Contact - Get in touch with us',
  },
] as const;

/**
 * Generates the sitemap for the application
 * @returns MetadataRoute.Sitemap - Array of sitemap entries
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date().toISOString();

  // Transform routes into sitemap entries
  const sitemapEntries: MetadataRoute.Sitemap = ROUTES.map((route) => ({
    url: `${SITEMAP_CONFIG.baseUrl}${route.path}`,
    lastModified: currentDate,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Log sitemap generation for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('📄 Sitemap generated with', sitemapEntries.length, 'entries');
    console.table(
      sitemapEntries.map((entry, index) => ({
        '#': index + 1,
        URL: entry.url,
        Priority: entry.priority,
        'Change Freq': entry.changeFrequency,
        Description: ROUTES[index]?.description || 'N/A',
      }))
    );
  }

  return sitemapEntries;
}
