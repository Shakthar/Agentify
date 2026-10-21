import { useEffect, useState } from 'react';
import type { LandingCopy } from './copy';

/**
 * Demonstração de conversa no formato visual do WhatsApp (cabeçalho verde,
 * fundo bege, balões verdes do cliente), com separadores por setor. As
 * mensagens aparecem uma a uma; com "reduzir movimento" aparecem todas.
 */
export default function WhatsAppDemo({ demo }: { demo: LandingCopy['demo'] }) {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(99);
  const scenario = demo.scenarios[active];

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(99);
      return;
    }
    setShown(1);
    const timers = scenario.messages.slice(1).map((_, i) => setTimeout(() => setShown(i + 2), 900 * (i + 1)));
    const done = setTimeout(() => setShown(99), 900 * scenario.messages.length);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [active, scenario.messages]);

  const visible = scenario.messages.slice(0, shown);
  const finished = shown >= scenario.messages.length;

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={demo.tablist} className="flex flex-wrap gap-2">
        {demo.scenarios.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls="wa-demo-panel"
            onClick={() => setActive(i)}
            className={`min-h-[44px] rounded-full px-4 text-[17px] font-semibold transition-colors ${
              i === active ? 'bg-ink text-white' : 'bg-field text-ink hover:bg-line'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div id="wa-demo-panel" role="tabpanel" className="overflow-hidden rounded-[22px] border border-line bg-wa-wall shadow-[0_24px_60px_-28px_rgba(19,33,60,0.45)]">
        <div className="flex items-center gap-3 bg-wa-header px-4 py-3 text-white">
          <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-[17px] font-semibold">
            {scenario.business.charAt(0)}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[17px] font-semibold">{scenario.business}</span>
            <span className="text-[14px] text-white/80">{demo.online}</span>
          </div>
        </div>

        <div className="flex min-h-[420px] flex-col gap-2 px-3 py-4" aria-live="polite">
          <span className="mx-auto mb-1 rounded-md bg-white/80 px-2 py-0.5 text-[13px] text-wa-meta">{scenario.hour}</span>
          {visible.map((m, i) => (
            <div key={`${scenario.id}-${i}`} className={`flex ${m.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`relative max-w-[82%] rounded-lg px-3 pb-1.5 pt-2 text-[16px] leading-snug text-wa-text shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
                  m.from === 'customer' ? 'rounded-tr-none bg-wa-bubble' : 'rounded-tl-none bg-white'
                }`}
              >
                <span>{m.text}</span>
                <span className="ml-2 inline-flex translate-y-1 items-center gap-0.5 whitespace-nowrap text-[11px] text-wa-meta">
                  {m.time}
                  {m.from === 'customer' && (
                    <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true" className="text-wa-tick">
                      <path d="M11.07.65 4.82 7.4 2.2 4.85l-.9.92 3.54 3.45L12 1.56zM14.8.65 8.55 7.4l-.73-.71-.9.92 1.66 1.61L15.73 1.56z" fill="currentColor" />
                    </svg>
                  )}
                </span>
              </div>
            </div>
          ))}
          {!finished && (
            <div className="flex justify-start" aria-hidden="true">
              <div className="flex gap-1 rounded-lg rounded-tl-none bg-white px-3 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-wa-meta [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-wa-meta [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-wa-meta" />
              </div>
            </div>
          )}
        </div>

        <div className={`mx-3 mb-3 flex items-center justify-between gap-3 rounded-xl border-2 border-brand-600 bg-white px-4 py-3 transition-opacity ${finished ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex min-w-0 flex-col">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-brand-600">{scenario.resultLabel}</span>
            <span className="text-[17px] font-semibold text-ink">{scenario.resultText}</span>
          </div>
          <span className="shrink-0 text-right text-[14px] text-ink-soft">{scenario.resultMeta}</span>
        </div>
      </div>
    </div>
  );
}
