import Head from 'next/head';
import type { LandingCopy, LandingLocale } from './copy';
import { PLAN_PRICING } from '../../utils/pricing';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://agentfy.tech').replace(/\/$/, '');
const LOCALES: LandingLocale[] = ['pt', 'es', 'en'];
const HREFLANG: Record<LandingLocale, string> = { pt: 'pt-PT', es: 'es', en: 'en' };

export function localizedUrl(locale: LandingLocale, path = '/'): string {
  const prefix = locale === 'pt' ? '' : `/${locale}`;
  const clean = path === '/' ? '' : path;
  return `${SITE_URL}${prefix}${clean}` || SITE_URL;
}

/** canonical, hreflang (pt/es/en + x-default), Open Graph e JSON-LD da landing. */
export default function LandingSeo({ copy, locale, path = '/', withFaq = true }: { copy: LandingCopy; locale: LandingLocale; path?: string; withFaq?: boolean }) {
  const url = localizedUrl(locale, path);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Agentfy',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      email: 'contact@solutions.shaklabs.tech',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Agentfy',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: copy.meta.description,
      url,
      offers: (['free', 'starter', 'business', 'enterprise'] as const).map((id) => ({
        '@type': 'Offer',
        name: id.charAt(0).toUpperCase() + id.slice(1),
        price: PLAN_PRICING[id].EUR.price,
        priceCurrency: 'EUR',
      })),
    },
    ...(withFaq
      ? [{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: copy.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }]
      : []),
  ];
  return (
    <Head>
      <link rel="canonical" href={url} />
      {LOCALES.map((l) => <link key={l} rel="alternate" hrefLang={HREFLANG[l]} href={localizedUrl(l, path)} />)}
      <link rel="alternate" hrefLang="x-default" href={localizedUrl('pt', path)} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Agentfy" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={copy.meta.title} />
      <meta property="og:description" content={copy.meta.description} />
      <meta property="og:image" content={`${SITE_URL}/og.png`} />
      <meta property="og:locale" content={copy.meta.ogLocale} />
      <meta name="twitter:card" content="summary_large_image" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </Head>
  );
}
