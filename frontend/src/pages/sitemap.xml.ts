import type { GetServerSideProps } from 'next';
import { SITE_URL, localizedUrl, LOCALES } from '../components/landing/LandingSeo';
import { SECTORS } from '../components/landing/sectors';

const HREFLANG = { pt: 'pt', es: 'es', en: 'en' } as const;

/** Sitemap com todos os idiomas (pt/es/en) e alternativas hreflang absolutas, incluindo x-default. */
function build(): string {
  const day = new Date().toISOString().slice(0, 10);
  const multi = ['/', '/faq', ...SECTORS.map((s) => `/para/${s.slug}`)];
  const ptOnly = ['/privacy-policy', '/terms-of-service', '/data-deletion'];
  const priority = (p: string) => (p === '/' ? '1.0' : p === '/faq' ? '0.8' : p.startsWith('/para/') ? '0.8' : '0.3');
  const entries: string[] = [];
  for (const path of multi) {
    const alts = [
      ...LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${localizedUrl(l, path)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${localizedUrl('pt', path)}"/>`,
    ].join('\n');
    for (const l of LOCALES) {
      entries.push(`  <url>\n    <loc>${localizedUrl(l, path)}</loc>\n    <lastmod>${day}</lastmod>\n    <changefreq>${path === '/' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${priority(path)}</priority>\n${alts}\n  </url>`);
    }
  }
  for (const path of ptOnly) {
    entries.push(`  <url>\n    <loc>${SITE_URL}${path}</loc>\n    <lastmod>${day}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>${priority(path)}</priority>\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(build());
  res.end();
  return { props: {} };
};

export default function Sitemap() {
  return null;
}
