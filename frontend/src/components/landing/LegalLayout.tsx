import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LandingShell } from './LandingChrome';
import LandingSeo from './LandingSeo';
import { LANDING_COPY, landingLocale } from './copy';
import { EXTRA } from './extra';

export interface TocItem { id: string; label: string }

/**
 * Página legal / de texto longo na identidade da landing: barra de topo, H1 grande,
 * índice (fixo no desktop, recolhível no telemóvel), coluna de 68ch e rodapé.
 */
export default function LegalLayout({ title, description, path, h1, subtitle, toc, children }: {
  title: string; description: string; path: string; h1: string; subtitle: string; toc: TocItem[]; children: ReactNode;
}) {
  const { locale } = useRouter();
  const loc = landingLocale(locale);
  const copy = LANDING_COPY[loc];
  const x = EXTRA[loc];
  const list = (
    <ol className="flex flex-col gap-1 text-[16px]">
      {toc.map((t) => (
        <li key={t.id}><a href={`#${t.id}`} className="block rounded-lg px-3 py-2 text-ink-soft hover:bg-field hover:text-ink">{t.label}</a></li>
      ))}
    </ol>
  );
  return (
    <LandingShell locale={loc} path={path}>
      <LandingSeo copy={copy} locale={loc} path={path} title={title} description={description} withFaq={false} entities={false} localized={false}
        breadcrumbs={[{ name: h1, path }]} />
      <main>
        <div data-tone="field" className="bg-field">
          <div className="mx-auto max-w-[1280px] px-4 pb-14 pt-12 md:px-8 md:pb-20 md:pt-20">
            <nav aria-label="Breadcrumb" className="mb-6 text-[16px] text-ink-soft">
              <Link href="/" locale={loc} className="underline underline-offset-4 hover:text-ink">Agentfy</Link> / <span>{h1}</span>
            </nav>
            <h1 className="lp-r font-display font-extrabold leading-[1] tracking-[-0.045em]" style={{ fontSize: 'clamp(34px, 6vw, 88px)' }}>{h1}</h1>
            <p className="lp-r mt-6 text-[18px] text-ink-soft" style={{ ['--d' as string]: '80ms' }}>{subtitle}</p>
          </div>
        </div>
        <div data-tone="light" className="bg-white">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:gap-8">
            <aside className="lg:col-span-3">
              <div className="lg:sticky lg:top-24">
                <details className="rounded-2xl bg-mist p-4 lg:hidden">
                  <summary className="flex min-h-[44px] items-center justify-between text-[18px] font-semibold">{x.toc}<span className="lp-plus flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white" aria-hidden="true">+</span></summary>
                  <div className="pt-2">{list}</div>
                </details>
                <nav aria-label={x.toc} className="hidden lg:block">
                  <p className="mb-3 px-3 text-[17px] font-semibold">{x.toc}</p>
                  {list}
                </nav>
              </div>
            </aside>
            <article className="lp-prose min-w-0 lg:col-span-8 lg:col-start-5">{children}</article>
          </div>
        </div>
      </main>
    </LandingShell>
  );
}
