import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Logo from '../../components/Logo';
import WhatsAppDemo from '../../components/landing/WhatsAppDemo';
import LandingSeo from '../../components/landing/LandingSeo';
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

/** Página de setor: hero + demo do setor + 4 pontos + ligação para a landing. */
export default function SectorPage({ slug, locale }: Props) {
  const sector = SECTORS.find((s) => s.slug === slug)!;
  const copy = LANDING_COPY[locale];
  const page = sector.copy[locale];
  const scenario = copy.demo.scenarios.find((s) => s.id === sector.scenarioId) ?? copy.demo.scenarios[0];
  const pageCopy = { ...copy, meta: { ...copy.meta, title: page.title, description: page.description } };

  return (
    <>
      <Head>
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
      </Head>
      <LandingSeo copy={pageCopy} locale={locale} path={`/para/${slug}`} withFaq={false} />
      <div className="min-h-screen bg-white font-sans text-ink">
        <header className="border-b border-line">
          <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-4 md:px-8">
            <Link href="/" locale={locale} aria-label="Agentfy"><Logo size={36} /></Link>
            <Link href="/?signup=1" locale={locale} className="flex min-h-[44px] items-center rounded-[10px] bg-brand-600 px-4 text-[17px] font-semibold text-white hover:bg-brand-700">{copy.nav.cta}</Link>
          </div>
        </header>
        <main>
          <section className="mx-auto grid max-w-[1280px] gap-12 px-4 py-16 md:px-8 lg:grid-cols-12 lg:py-20">
            <div className="flex flex-col gap-6 lg:col-span-6">
              <nav aria-label="Breadcrumb" className="text-[16px] text-ink-mute">
                <Link href="/" locale={locale} className="hover:text-ink">Agentfy</Link> / <span>{copy.sectors.items.find((i) => i.slug === slug)?.title}</span>
              </nav>
              <h1 className="font-display text-[44px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[64px]">{page.h1}</h1>
              <p className="text-[20px] leading-[1.55] text-ink-soft">{page.intro}</p>
              <Link href="/?signup=1" locale={locale} className="flex min-h-[56px] items-center justify-center self-start rounded-xl bg-brand-600 px-7 text-[19px] font-semibold text-white hover:bg-brand-700">{copy.hero.cta}</Link>
            </div>
            <div className="lg:col-span-5 lg:col-start-8">
              <WhatsAppDemo demo={{ ...copy.demo, scenarios: [scenario] }} />
            </div>
          </section>
          <section className="bg-mist">
            <ul className="mx-auto grid max-w-[1280px] gap-4 px-4 py-16 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
              {page.points.map((p) => (
                <li key={p.title} className="flex flex-col gap-2 rounded-2xl bg-white p-7">
                  <h2 className="text-[21px] font-semibold">{p.title}</h2>
                  <p className="text-[17px] leading-[1.5] text-ink-soft">{p.desc}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="mx-auto max-w-[1280px] px-4 py-16 md:px-8">
            <h2 className="mb-6 font-display text-[32px] font-extrabold tracking-[-0.03em] md:text-[44px]">{copy.sectors.title}</h2>
            <ul className="flex flex-wrap gap-3">
              {copy.sectors.items.filter((i) => i.slug !== slug).map((i) => (
                <li key={i.slug}><Link href={`/para/${i.slug}`} locale={locale} className="flex min-h-[48px] items-center rounded-full border-[1.5px] border-line px-5 text-[17px] font-semibold hover:border-brand-600">{i.title}</Link></li>
              ))}
              <li><Link href="/#porque" locale={locale} className="flex min-h-[48px] items-center rounded-full bg-ink px-5 text-[17px] font-semibold text-white">{copy.vsMeta.title}</Link></li>
            </ul>
          </section>
        </main>
        <footer className="bg-ink px-4 py-8 text-[14px] text-[#AEB9D1] md:px-8">
          <div className="mx-auto max-w-[1280px]">© {new Date().getFullYear()} Agentfy · Shaklabs · {copy.footer.made}</div>
        </footer>
      </div>
    </>
  );
}
