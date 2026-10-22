import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LandingShell } from '../components/landing/LandingChrome';
import LandingSeo from '../components/landing/LandingSeo';
import { LANDING_COPY, landingLocale } from '../components/landing/copy';
import { FAQ_PAGE } from '../components/landing/faqData';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function FaqPage() {
  const { locale, asPath } = useRouter();
  const loc = landingLocale(locale);
  const copy = LANDING_COPY[loc];
  const f = FAQ_PAGE[loc];
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const allItems = useMemo(() => f.categories.flatMap((c) => c.items), [f]);
  const q = norm(query.trim());
  const filtered = useMemo(
    () => f.categories
      .map((c) => ({ ...c, items: c.items.filter((it) => !q || norm(`${it.q} ${it.a}`).includes(q)) }))
      .filter((c) => c.items.length > 0),
    [f, q],
  );
  const total = filtered.reduce((n, c) => n + c.items.length, 0);

  // Ligação direta a uma pergunta (/faq#q-planos-2) abre-a.
  useEffect(() => {
    const id = asPath.split('#')[1];
    if (id && id.startsWith('q-')) {
      setOpenId(id);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'center' }), 60);
    }
  }, [asPath]);

  return (
    <LandingShell locale={loc} path="/faq">
      <LandingSeo copy={copy} locale={loc} path="/faq" title={f.meta.title} description={f.meta.description}
        faqItems={allItems} entities={false} breadcrumbs={[{ name: f.h1, path: '/faq' }]} />
      <main>
        <div data-tone="field" className="bg-field">
          <div className="mx-auto max-w-[1280px] px-4 pb-14 pt-12 md:px-8 md:pb-20 md:pt-20">
            <nav aria-label="Breadcrumb" className="mb-6 text-[16px] text-ink-soft">
              <Link href="/" locale={loc} className="underline underline-offset-4 hover:text-ink">Agentfy</Link> / <span>{f.h1}</span>
            </nav>
            <h1 className="lp-r font-display font-extrabold leading-[1] tracking-[-0.045em]" style={{ fontSize: 'clamp(34px, 7vw, 104px)' }}>{f.h1}</h1>
            <p className="lp-r mt-6 max-w-[62ch] text-[20px] leading-[1.55] text-ink-soft" style={{ ['--d' as string]: '80ms' }}>{f.intro}</p>
            <div className="lp-r mt-10 max-w-[640px]" style={{ ['--d' as string]: '160ms' }}>
              <label htmlFor="faq-search" className="mb-2 block text-[17px] font-semibold">{f.searchLabel}</label>
              <input id="faq-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={f.searchPlaceholder} autoComplete="off"
                className="min-h-[56px] w-full rounded-xl bg-white px-5 text-[18px] text-ink placeholder:text-ink-mute focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-400" />
              <p role="status" aria-live="polite" className="mt-3 min-h-[28px] text-[16px] text-ink-soft">{q ? f.results(total) : f.updated}</p>
            </div>
          </div>
        </div>

        <div data-tone="light" className="bg-white">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:gap-8">
            <aside className="lg:col-span-3">
              <nav aria-label={f.indexLabel} className="lg:sticky lg:top-24">
                <p className="mb-3 px-3 text-[17px] font-semibold">{f.indexLabel}</p>
                <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <a href={`#${c.id}`} className="flex min-h-[44px] items-center justify-between gap-4 rounded-xl bg-mist px-4 py-2 text-[16px] font-medium text-ink hover:bg-field lg:bg-transparent">
                        <span>{c.title}</span><span className="text-ink-soft">{c.items.length}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            <div className="flex flex-col gap-16 lg:col-span-8 lg:col-start-5">
              {filtered.length === 0 && (
                <p className="rounded-2xl bg-mist p-8 text-[19px] leading-[1.55]">
                  {f.noResults}{' '}
                  <a href="mailto:contact@solutions.shaklabs.tech" className="font-semibold text-brand-700 underline underline-offset-4">contact@solutions.shaklabs.tech</a>
                </p>
              )}
              {filtered.map((c) => (
                <section key={c.id} id={c.id} aria-labelledby={`h-${c.id}`} className="scroll-mt-24">
                  <h2 id={`h-${c.id}`} className="lp-r mb-6 font-display text-[clamp(28px,3.6vw,44px)] font-extrabold leading-[1.05] tracking-[-0.035em]">{c.title}</h2>
                  <div className="flex flex-col">
                    {c.items.map((it, i) => {
                      const id = `q-${c.id}-${i + 1}`;
                      return (
                        <details key={`${id}-${q}`} id={id} open={!!q || openId === id} className={`${i % 2 === 0 ? 'bg-mist' : 'bg-white'} rounded-2xl px-6 md:px-8`}>
                          <summary className="flex min-h-[72px] items-center justify-between gap-6 py-4">
                            <h3 className="text-[19px] font-semibold leading-snug md:text-[21px]">{it.q}</h3>
                            <span className="lp-plus flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-white" aria-hidden="true">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                            </span>
                          </summary>
                          <p className="max-w-[66ch] pb-7 text-[18px] leading-[1.6] text-ink-soft">{it.a}</p>
                        </details>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>

        <section data-tone="brand" className="bg-brand-600 text-white">
          <div className="mx-auto max-w-[1280px] px-4 py-20 md:px-8 md:py-28">
            <h2 className="lp-r max-w-[1000px] font-display font-extrabold leading-[1] tracking-[-0.045em]" style={{ fontSize: 'clamp(32px, 5.6vw, 80px)' }}>{f.ctaTitle}</h2>
            <p className="lp-r mt-6 max-w-[56ch] text-[20px] leading-[1.55] text-white" style={{ ['--d' as string]: '80ms' }}>{f.ctaSub}</p>
            <div className="lp-r mt-10 flex flex-col gap-3 sm:flex-row" style={{ ['--d' as string]: '160ms' }}>
              <Link href="/?signup=1" locale={loc} className="lp-press flex min-h-[56px] items-center justify-center rounded-xl bg-white px-8 text-[19px] font-semibold text-ink hover:bg-field">{f.ctaButton}</Link>
              <a href="mailto:contact@solutions.shaklabs.tech" className="lp-press flex min-h-[56px] items-center justify-center rounded-xl bg-white/15 px-8 text-[19px] font-semibold text-white hover:bg-white/25">{f.ctaContact}</a>
            </div>
          </div>
        </section>
      </main>
    </LandingShell>
  );
}
