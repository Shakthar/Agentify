import Head from 'next/head';
import type { LandingCopy, LandingLocale } from './copy';
import { PLAN_PRICING } from '../../utils/pricing';

/** Domínio de produção. Pode ser sobreposto por NEXT_PUBLIC_SITE_URL (ex.: preview). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://agentfy.shaklabs.tech').replace(/\/$/, '');
export const OG_IMAGE = `${SITE_URL}/og-agentfy.jpg`;
export const LOCALES: LandingLocale[] = ['pt', 'es', 'en'];
const HREFLANG: Record<LandingLocale, string> = { pt: 'pt', es: 'es', en: 'en' };

export function localizedUrl(locale: LandingLocale, path = '/'): string {
  const prefix = locale === 'pt' ? '' : `/${locale}`;
  const clean = path === '/' ? '' : path;
  return `${SITE_URL}${prefix || clean ? `${prefix}${clean}` : '/'}`;
}

interface Props {
  copy: LandingCopy;
  locale: LandingLocale;
  path?: string;
  /** FAQPage JSON-LD: por omissão usa as perguntas da landing; passa a lista para outras páginas. */
  withFaq?: boolean;
  faqItems?: { q: string; a: string }[];
  /** Sobrepõe o título e a descrição (páginas de setor, FAQ). */
  title?: string;
  description?: string;
  /** Migalhas: [{ name, path }] a seguir à home. */
  breadcrumbs?: { name: string; path: string }[];
  /** Inclui Organization + SoftwareApplication (landing). */
  entities?: boolean;
  noindex?: boolean;
  /** false: página só em português (legais) — canonical em PT e sem alternativas de idioma. */
  localized?: boolean;
}

/** title, description, canonical, hreflang (pt/es/en + x-default), Open Graph, Twitter e JSON-LD. */
export default function LandingSeo({ copy, locale, path = '/', withFaq = true, faqItems, title, description, breadcrumbs, entities = true, noindex, localized = true }: Props) {
  if (!localized) locale = 'pt';
  const url = localizedUrl(locale, path);
  const t = title ?? copy.meta.title;
  const d = description ?? copy.meta.description;
  const faq = faqItems ?? copy.faq.items;

  const graph: Record<string, unknown>[] = [];
  if (entities) {
    graph.push(
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Agentfy',
        legalName: 'ShakLabs, Lda.',
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        email: 'contact@solutions.shaklabs.tech',
        areaServed: ['PT', 'ES', 'BR'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Agentfy',
        url: SITE_URL,
        inLanguage: LOCALES.map((l) => HREFLANG[l]),
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: 'Agentfy',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: copy.meta.description,
        url: SITE_URL,
        image: OG_IMAGE,
        publisher: { '@id': `${SITE_URL}/#organization` },
        offers: (['free', 'starter', 'business', 'enterprise'] as const).map((id) => ({
          '@type': 'Offer',
          name: id.charAt(0).toUpperCase() + id.slice(1),
          price: PLAN_PRICING[id].EUR.price,
          priceCurrency: 'EUR',
          url: `${SITE_URL}/#precos`,
          availability: 'https://schema.org/InStock',
        })),
      },
    );
  }
  if (breadcrumbs?.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [{ name: 'Agentfy', path: '/' }, ...breadcrumbs].map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: localizedUrl(locale, b.path),
      })),
    });
  }
  if (withFaq && faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: HREFLANG[locale],
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  const jsonLd = { '@context': 'https://schema.org', '@graph': graph };

  return (
    <Head>
      <title>{t}</title>
      <meta name="description" content={d} />
      {noindex ? <meta name="robots" content="noindex,follow" /> : <meta name="robots" content="index,follow,max-image-preview:large" />}
      <link rel="canonical" href={url} />
      {localized && LOCALES.map((l) => <link key={`alt-${l}`} rel="alternate" hrefLang={HREFLANG[l]} href={localizedUrl(l, path)} />)}
      {localized && <link rel="alternate" hrefLang="x-default" href={localizedUrl('pt', path)} />}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Agentfy" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={t} />
      <meta property="og:description" content={d} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Agentfy" />
      <meta property="og:locale" content={copy.meta.ogLocale} />
      {localized && LOCALES.filter((l) => l !== locale).map((l) => <meta key={`ogl-${l}`} property="og:locale:alternate" content={l === 'pt' ? 'pt_PT' : l === 'es' ? 'es_ES' : 'en_GB'} />)}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={t} />
      <meta name="twitter:description" content={d} />
      <meta name="twitter:image" content={OG_IMAGE} />
      {graph.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
    </Head>
  );
}
