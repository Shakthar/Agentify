import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Primitivas da app Agentfy (out/2026, estilo "framed sheet"). Use sempre os
 * tokens app-* (ver tailwind.config.js e styles/globals.css): funcionam em
 * claro e escuro com contraste certo. Nada de gradientes, sombras em repouso,
 * ícones em quadrados coloridos ou emoji.
 */

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** Linha de título: h1 substantivo, uma frase cinza opcional, ações à direita. */
export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-sm text-app-muted hover:text-app-ink">
            <span aria-hidden="true">←</span> {back.label}
          </Link>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight text-app-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-app-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Painel com cabeçalho (título à esquerda, ação/período à direita). */
export function Panel({ title, action, children, className, bodyClassName }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cx('rounded-xl border border-app-edge bg-app-sheet', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          {title && <h2 className="text-base font-semibold text-app-ink">{title}</h2>}
          {action && <div className="text-sm text-app-muted">{action}</div>}
        </div>
      )}
      <div className={cx('p-5', title || action ? 'pt-3' : '', bodyClassName)}>{children}</div>
    </section>
  );
}

export interface Kpi {
  label: ReactNode;
  value: ReactNode;
  /** Linha pequena que nomeia a base/janela ("hoje", "vs. ontem"). */
  caption?: ReactNode;
  tone?: 'default' | 'pos' | 'neg' | 'warn';
}

/** KPIs como tipo, não como cartões: um contentor dividido por linhas de 1px. */
export function KpiStrip({ items }: { items: Kpi[] }) {
  const cols = items.length >= 4 ? 'sm:grid-cols-4' : items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <div className={cx('grid grid-cols-2 overflow-hidden rounded-xl border border-app-edge bg-app-sheet', cols)}>
      {items.map((k, i) => (
        <div key={i} className={cx('flex flex-col gap-1 border-app-rule p-4', i % 2 === 1 && 'border-l', i >= 2 && 'border-t sm:border-t-0', i > 0 && 'sm:border-l')}>
          <span className="text-sm text-app-muted">{k.label}</span>
          <span className={cx('num text-2xl font-semibold leading-tight', k.tone === 'neg' ? 'text-app-neg' : k.tone === 'warn' ? 'text-app-warn' : 'text-app-ink')}>{k.value}</span>
          {k.caption && <span className={cx('text-xs', k.tone === 'pos' ? 'text-app-pos' : 'text-app-faint')}>{k.caption}</span>}
        </div>
      ))}
    </div>
  );
}

export type PillTone = 'neutral' | 'accent' | 'pos' | 'neg' | 'warn';
const PILL: Record<PillTone, string> = {
  neutral: 'bg-app-raised text-app-muted',
  accent: 'bg-app-accent-soft text-app-accent',
  pos: 'bg-app-pos-soft text-app-pos',
  neg: 'bg-app-neg-soft text-app-neg',
  warn: 'bg-app-warn-soft text-app-warn',
};
/** Estado numa linha: tinta pálida com texto escuro do mesmo tom. */
export function Pill({ tone = 'neutral', children, dot }: { tone?: PillTone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx('inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', PILL[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Abas sublinhadas sobre uma linha de 1px; o indicador é 2px em tinta. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-5 flex gap-5 overflow-x-auto border-b border-app-rule">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cx(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors',
              active ? 'border-app-ink text-app-ink' : 'border-transparent text-app-muted hover:text-app-ink',
            )}
          >
            {t.label}
            {typeof t.count === 'number' && <span className="num text-xs text-app-faint">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Estado vazio: mantém a moldura e diz o próximo passo numa frase. */
export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-app-edge px-5 py-6">
      <p className="text-sm font-semibold text-app-ink">{title}</p>
      {body && <p className="text-sm text-app-muted">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Esqueleto de carregamento no tamanho real do valor (sem shimmer). */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('block rounded bg-app-raised', className)} aria-hidden="true" />;
}

/** Erro dentro do bloco que falhou, com "Tentar de novo". */
export function InlineError({ message, onRetry }: { message: ReactNode; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-app-neg-soft px-4 py-3 text-sm text-app-neg">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
          Tentar de novo
        </button>
      )}
    </div>
  );
}
