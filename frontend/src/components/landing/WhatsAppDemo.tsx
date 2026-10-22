import { useEffect, useState } from 'react';
import type { LandingCopy } from './copy';

/**
 * Demonstração de conversa no formato visual do WhatsApp (cabeçalho verde,
 * fundo bege, balões verdes do cliente), com separadores por setor. As
 * mensagens aparecem uma a uma; com "reduzir movimento" aparecem todas.
 * A raiz do fragmento leva data-ui: é um pedaço real da interface do produto.
 */
export default function WhatsAppDemo({ demo, tone = 'brand' }: { demo: LandingCopy['demo']; tone?: 'brand' | 'light' }) {
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
  const onBrand = tone === 'brand';

  return (
    <div className="flex flex-col gap-3">
      {demo.scenarios.length > 1 && (
        <div role="tablist" aria-label={demo.tablist} className="flex flex-wrap gap-2">
          {demo.scenarios.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`wa-tab-${s.id}`}
              aria-selected={i === active}
              aria-controls="wa-demo-panel"
              onClick={() => setActive(i)}
              className={`lp-press min-h-[44px] rounded-full px-4 text-[17px] font-semibold ${
                i === active
                  ? onBrand ? 'bg-white text-ink' : 'bg-ink text-white'
                  : onBrand ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-field text-ink hover:bg-line'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div id="wa-demo-panel" role="tabpanel" aria-labelledby={`wa-tab-${scenario.id}`} data-ui className="overflow-hidden rounded-[22px] bg-[#EFEAE2] shadow-[0_30px_60px_-30px_rgba(8,14,40,0.6)]">
        <div className="flex items-center gap-3 bg-[#008069] px-4 py-3 text-white">
          <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-[17px] font-semibold">
            {scenario.business.charAt(0)}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[17px] font-semibold">{scenario.business}</span>
            <span className="flex items-center gap-2 text-[14px] text-white">
              <span className="relative flex h-2 w-2" aria-hidden="true"><span className="lp-pulse absolute inset-0 rounded-full bg-[#7CFFB2]" /><span className="relative h-2 w-2 rounded-full bg-[#7CFFB2]" /></span>
              {demo.online}
            </span>
          </div>
        </div>

        <div className="flex min-h-[392px] flex-col gap-2 px-3 py-4" aria-live="polite">
          <span className="mx-auto mb-1 rounded-md bg-white/90 px-2 py-0.5 text-[13px] text-[#3F4F59]">{scenario.hour}</span>
          {visible.map((m, i) => (
            <div key={`${scenario.id}-${i}`} className={`flex ${m.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`relative max-w-[84%] rounded-lg px-3 pb-1.5 pt-2 text-[16px] leading-snug text-[#111B21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
                  m.from === 'customer' ? 'rounded-tr-none bg-[#D9FDD3]' : 'rounded-tl-none bg-white'
                }`}
              >
                <span>{m.text}</span>
                <span className="ml-2 inline-flex translate-y-1 items-center gap-0.5 whitespace-nowrap text-[12px] text-[#3F4F59]">
                  {m.time}
                  {m.from === 'customer' && (
                    <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true" className="text-[#1D8FC4]">
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
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#3F4F59] [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#3F4F59] [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#3F4F59]" />
              </div>
            </div>
          )}
        </div>

        <div className={`mx-3 mb-3 flex flex-col gap-1 rounded-xl bg-[#13213C] sm:flex-row sm:items-center sm:justify-between sm:gap-3 px-4 py-3 text-white transition-opacity duration-500 ${finished ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-[#A9C0FF]">{scenario.resultLabel}</span>
            <span className="text-[17px] font-semibold">{scenario.resultText}</span>
          </div>
          <span className="shrink-0 text-[14px] text-[#D6DDEC] sm:text-right">{scenario.resultMeta}</span>
        </div>
      </div>
    </div>
  );
}
