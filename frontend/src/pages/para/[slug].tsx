import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import WhatsAppDemo from '../../components/landing/WhatsAppDemo';
import LandingSeo from '../../components/landing/LandingSeo';
import { LandingShell } from '../../components/landing/LandingChrome';
import { LANDING_COPY, landingLocale, type LandingLocale } from '../../components/landing/copy';
import { SECTORS } from '../../components/landing/sectors';

interface Props {
  slug: string;
  locale: LandingLocale;
}

export const getStaticPaths: GetStaticPaths = async ({ locales = ['pt'] }) => ({
  paths: SECTORS.flatMap((s) => locales.map((locale) => ({ params: { slug: s.slug }, locale }))),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async ({ params, locale }) => {
  const slug = String(params?.slug ?? '');
  if (!SECTORS.some((s) => s.slug === slug)) return { notFound: true };
  return { props: { slug, locale: landingLocale(locale) } };
};

/** Página de setor: título grande, demo do setor num campo cobalto, 4 pontos e ligação para a landing. */
export default function SectorPage({ slug, locale }: Props) {
  const sector = SECTORS.find((s) => s.slug === slug)!;
  const copy = LANDING_COPY[locale];
  const page = sector.copy[locale];
  const scenario = copy.demo.scenarios.find((s) => s.id === sector.scenarioId) ?? copy.demo.scenarios[0];
  const sectorName = copy.sectors.items.find((i) => i.slug === slug)?.title ?? slug;
  const tiles = ['bg-brand-600 text-white', 'bg-ink text-white', 'bg-field text-ink', 'bg-brand-100 text-ink'];

  return (
    <LandingShell locale={locale} path={`/para/${slug}`}>
      <LandingSeo copy={copy} locale={locale} path={`/para/${slug}`} title={page.title} description={page.description}
        withFaq={false} entities={false} breadcrumbs={[{ name: copy.nav.sectors, path: '/#setores' }, { name: sectorName, path: `/para/${slug}` }]} />
      <main>
        <div data-tone="field" className="bg-field">
          <div className="mx-auto max-w-[1280px] px-4 pb-14 pt-12 md:px-8 md:pb-20 md:pt-20">
            <nav aria-label="Breadcrumb" className="mb-6 text-[16px] text-ink-soft">
              <Link href="/" locale={locale} className="underline underline-offset-4 hover:text-ink">Agentfy</Link> / <Link href="/#setores" locale={locale} className="underline underline-offset-4 hover:text-ink">{copy.nav.sectors}</Link> / <span>{sectorName}</span>
            </nav>
            <h1 className="lp-r max-w-[1200px] font-display font-extrabold leading-[1] tracking-[-0.045em]" style={{ fontSize: 'clamp(26px, 4.9vw, 70px)' }}>{page.h1}</h1>
          </div>
        </div>
        <section data-tone="brand" className="bg-brand-600 text-white">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-4 pb-20 pt-12 md:px-8 md:pb-28 md:pt-16 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col gap-8 lg:col-span-5">
              <p className="lp-r max-w-[560px] text-[20px] leading-[1.55] text-white md:text-[22px]">{page.intro}</p>
              <div className="lp-r" style={{ ['--d' as string]: '100ms' }}>
                <Link href="/?signup=1" locale={locale} className="lp-press inline-flex min-h-[56px] items-center justify-center rounded-xl bg-white px-7 text-[19px] font-semibold text-ink hover:bg-field">{copy.hero.cta}</Link>
              </div>
              <ul className="lp-r flex flex-col gap-3 text-[17px] text-white" style={{ ['--d' as string]: '200ms' }}>
                {copy.hero.checks.map((t) => <li key={t} className="lp-tick lp-tick-w">{t}</li>)}
              </ul>
            </div>
            <div className="lp-r lp-r-s lg:col-span-6 lg:col-start-7" style={{ ['--d' as string]: '150ms' }}>
              <WhatsAppDemo demo={{ ...copy.demo, scenarios: [scenario] }} />
            </div>
          </div>
        </section>

        <section data-tone="light" className="bg-white">
          <ul className="mx-auto grid max-w-[1280px] gap-x-10 gap-y-12 px-4 py-24 md:px-8 md:py-32 sm:grid-cols-2">
            {page.points.map((p, i) => (
              <li key={p.title} className="lp-r flex flex-col gap-3" style={{ ['--d' as string]: `${(i % 2) * 90}ms` }}>
                <h2 className="font-display text-[clamp(26px,3vw,38px)] font-extrabold leading-[1.05] tracking-[-0.03em]">{p.title}</h2>
                <p className="max-w-[56ch] text-[19px] leading-[1.55] text-ink-soft">{p.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section data-tone="field" className="bg-field">
          <div className="mx-auto max-w-[1280px] px-4 py-20 md:px-8 md:py-28">
            <h2 className="lp-r mb-10 max-w-[900px] font-display font-extrabold leading-[1] tracking-[-0.04em]" style={{ fontSize: 'clamp(30px, 4.4vw, 60px)' }}>{copy.sectors.title}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {copy.sectors.items.filter((i) => i.slug !== slug).map((i, k) => (
                <li key={i.slug} className="lp-r" style={{ ['--d' as string]: `${k * 90}ms` }}>
                  <Link href={`/para/${i.slug}`} locale={locale} className={`lp-lift group flex min-h-[200px] flex-col justify-between gap-8 rounded-[24px] p-7 ${tiles[k % 4]}`}>
                    <span className="font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.02em]">{i.title}</span>
                    <span className="flex items-center gap-2 text-[17px] font-semibold">{copy.sectors.more}<span className="lp-arrow" aria-hidden="true">→</span></span>
                  </Link>
                </li>
              ))}
              <li className="lp-r" style={{ ['--d' as string]: '270ms' }}>
                <Link href="/#porque" locale={locale} className="lp-lift group flex min-h-[200px] flex-col justify-between gap-8 rounded-[24px] bg-white p-7 text-ink">
                  <span className="font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.02em]">{copy.vsMeta.title}</span>
                  <span className="flex items-center gap-2 text-[17px] font-semibold">{copy.sectors.more}<span className="lp-arrow" aria-hidden="true">→</span></span>
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </LandingShell>
  );
}
