import type { ExtraCopy } from './extra';

/**
 * Fragmentos reais da interface do produto (caixa de entrada, painel, ecrã da
 * cozinha, passagem para humano). Cada raiz leva data-ui: são recortes da app,
 * com os seus próprios raios e bordas. Os números somam (96+31+14+7 = 148).
 */

const CHANNEL_COLOR: Record<string, string> = {
  WhatsApp: '#007A63',
  Instagram: '#B02A74',
  Telegram: '#1A76A5',
};

export function ChannelBadge({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  const bg = CHANNEL_COLOR[name] ?? '#13213C';
  return (
    <span data-ui className={`inline-flex shrink-0 items-center rounded-md font-semibold text-white ${size === 'lg' ? 'px-3 py-1.5 text-[16px]' : 'px-2 py-0.5 text-[13px]'}`} style={{ background: bg }}>
      {name}
    </span>
  );
}

export function InboxFragment({ x }: { x: ExtraCopy }) {
  return (
    <div data-ui className="overflow-hidden rounded-2xl bg-white text-[#13213C] shadow-[0_30px_60px_-34px_rgba(19,33,60,0.5)]">
      <div className="flex items-center justify-between bg-[#F4F6FA] px-5 py-3.5">
        <span className="text-[17px] font-semibold">{x.inbox.title}</span>
        <span className="flex items-center gap-2 text-[14px] text-[#3A4660]"><span className="h-2 w-2 rounded-full bg-[#1E9E5A]" aria-hidden="true" />{x.dash.sample}</span>
      </div>
      <ul>
        {x.inbox.rows.map((r, i) => (
          <li key={r.who} className={`flex items-start gap-3 px-5 py-4 ${i === 0 ? 'bg-[#EAEFF8]' : ''}`}>
            <ChannelBadge name={r.channel} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center justify-between gap-3"><span className="truncate text-[16px] font-semibold">{r.who}</span><span className="shrink-0 text-[13px] text-[#3A4660]">{r.time}</span></span>
              <span className="text-[15px] leading-snug text-[#3A4660]">{r.text}</span>
              {r.tag && <span className="mt-1.5 self-start rounded bg-[#FFF1D6] px-2 py-0.5 text-[13px] font-semibold text-[#7A3A00]">{r.tag}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardFragment({ x }: { x: ExtraCopy }) {
  const max = Math.max(...x.dash.channels.map((c) => c.value));
  return (
    <div data-ui className="overflow-hidden rounded-2xl bg-white text-[#13213C] shadow-[0_30px_60px_-34px_rgba(19,33,60,0.5)]">
      <div className="flex items-center justify-between bg-[#F4F6FA] px-5 py-3.5">
        <span className="text-[17px] font-semibold">{x.dash.title} · {x.dash.today}</span>
        <span className="text-[14px] text-[#3A4660]">{x.dash.sample}</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-[#E3E8F2]">
        {x.dash.stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 bg-white px-5 py-4">
            <span className="text-[14px] text-[#3A4660]">{s.label}</span>
            <span className="font-display text-[32px] font-extrabold leading-none tabular-nums">{s.value}</span>
            <span className="text-[13px] font-semibold text-[#0F6B3E]">{s.delta}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 px-5 py-5">
        <span className="text-[15px] font-semibold">{x.dash.chartTitle}</span>
        <ul className="flex flex-col gap-2.5">
          {x.dash.channels.map((c, i) => (
            <li key={c.name} className="grid grid-cols-[96px_1fr_36px] items-center gap-3 text-[14px]">
              <span className="truncate text-[#3A4660]">{c.name}</span>
              <span className="h-3 overflow-hidden rounded-sm bg-[#EAEFF8]"><span className="lp-bar block h-full rounded-sm bg-[#2346D8]" style={{ width: `${(c.value / max) * 100}%`, ['--d' as string]: `${i * 120}ms` }} /></span>
              <span className="text-right font-semibold tabular-nums">{c.value}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 rounded-lg bg-[#FFF1D6] px-3 py-2 text-[14px] font-semibold text-[#7A3A00]"><span className="h-2 w-2 rounded-full bg-[#C2570C]" aria-hidden="true" />{x.dash.handoffLabel}</p>
      </div>
    </div>
  );
}

export function KitchenFragment({ x }: { x: ExtraCopy }) {
  return (
    <div data-ui className="flex flex-col overflow-hidden rounded-2xl bg-[#13213C] text-white">
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="text-[17px] font-semibold">{x.kitchen.title}</span>
        <span className="flex items-center gap-2 text-[14px] text-[#D6DDEC]"><span className="relative flex h-2 w-2" aria-hidden="true"><span className="lp-pulse absolute inset-0 rounded-full bg-[#7CFFB2]" /><span className="relative h-2 w-2 rounded-full bg-[#7CFFB2]" /></span>live</span>
      </div>
      <div className="grid flex-1 gap-3 px-3 pb-4 sm:grid-cols-3">
        {x.kitchen.cols.map((col) => (
          <div key={col.name} className="flex flex-col gap-2 rounded-xl bg-[#1B2D50] p-3">
            <span className="text-[14px] font-semibold text-[#D6DDEC]">{col.name}</span>
            {col.tickets.map((t) => (
              <div key={t.n} className="flex flex-col gap-1 rounded-lg bg-white p-3 text-[#13213C]">
                <span className="flex items-center justify-between"><span className="font-display text-[20px] font-extrabold tabular-nums">#{t.n}</span>{t.paid && <span className="rounded bg-[#D7F5E3] px-1.5 py-0.5 text-[12px] font-semibold text-[#0F5B34]">{x.kitchen.paid}</span>}</span>
                {t.lines.map((l) => <span key={l} className="text-[14px] leading-snug">{l}</span>)}
                <span className="text-[13px] text-[#3A4660]">{t.meta}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HandoffFragment({ label, text, meta }: { label: string; text: string; meta: string }) {
  return (
    <div data-ui className="flex max-w-[560px] flex-col gap-1.5 rounded-2xl bg-white p-5 text-[#13213C]">
      <span className="flex items-center gap-2 text-[15px] font-semibold text-[#2346D8]"><span className="h-2 w-2 rounded-full bg-[#C2570C]" aria-hidden="true" />{label}</span>
      <span className="text-[19px] font-semibold leading-snug">{text}</span>
      <span className="text-[15px] text-[#3A4660]">{meta}</span>
    </div>
  );
}
