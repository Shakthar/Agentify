import type { ReactNode } from 'react';
import { Pill, cx, type PillTone } from './ui';

/** Partes partilhadas pelas páginas de planos, faturação, créditos e conta. */

export const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
export const isoDate = (d: string | Date) => {
  const t = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(t.getTime()) ? '—' : t.toISOString().slice(0, 10);
};

/** Barra de utilização à escala real, com as duas pontas nomeadas. */
export function UsageBar({ used, total, caption }: { used: number; total: number; caption?: ReactNode }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const hot = pct >= 90;
  const warm = pct >= 70 && !hot;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="num text-base font-semibold text-app-ink">
          {fmt(used)} <span className="font-normal text-app-muted">de {fmt(total)} créditos</span>
        </p>
        <span className={cx('num text-sm font-medium', hot ? 'text-app-neg' : warm ? 'text-app-warn' : 'text-app-muted')}>{Math.round(pct)}%</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-app-raised"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={used}
        aria-label="Créditos utilizados"
      >
        <div className={cx('h-full rounded-full', hot ? 'bg-app-neg' : warm ? 'bg-app-warn' : 'bg-app-accent')} style={{ width: `${pct}%` }} />
      </div>
      <div className="num mt-1.5 flex justify-between text-xs text-app-faint">
        <span>0</span>
        <span>{fmt(total)}</span>
      </div>
      {caption && <p className="mt-2 text-sm text-app-muted">{caption}</p>}
    </div>
  );
}

export const REASON_LABEL: Record<string, string> = {
  chat: 'Conversas com IA (tokens)',
  wamsg: 'Mensagem WhatsApp/Instagram',
  'signup-bonus': 'Bónus de registo',
  purchase: 'Compra de créditos',
  refund: 'Reembolso',
  'monthly-reset': 'Renovação mensal',
};

export interface PlatformInvoice {
  id: string; plan: string; amount: number; currency?: string; method: string; status: string;
  reference: string | null; entity: string | null;
  periodStart: string; periodEnd: string; paidAt: string | null; createdAt: string;
}

const METHOD_LABEL: Record<string, string> = { stripe: 'Cartão (Stripe)', ifthenpay_mbway: 'MB Way', ifthenpay_multibanco: 'Multibanco', pix: 'PIX', manual: 'Manual' };
const STATUS: Record<string, { tone: PillTone; label: string }> = {
  paid: { tone: 'pos', label: 'Pago' },
  pending: { tone: 'warn', label: 'Pendente' },
  failed: { tone: 'neg', label: 'Falhou' },
  expired: { tone: 'neg', label: 'Expirado' },
  cancelled: { tone: 'neutral', label: 'Cancelado' },
};
const planName = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);
const amountOf = (inv: PlatformInvoice) => `${inv.currency === 'BRL' ? 'R$' : '€'}${inv.amount.toLocaleString(inv.currency === 'BRL' ? 'pt-BR' : 'pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Faturas: data ISO e valor à direita, estado em pílula. */
export function InvoiceTable({ invoices, onConfirm, confirmingId, canConfirm }: { invoices: PlatformInvoice[]; onConfirm?: (id: string) => void; confirmingId?: string | null; canConfirm?: boolean }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-app-muted">
              <th className="py-2 pr-3 font-medium">Plano</th>
              <th className="px-3 py-2 font-medium">Método</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 text-right font-medium">Data</th>
              <th className="py-2 pl-3 text-right font-medium">Valor</th>
              {canConfirm && <th className="py-2 pl-3" />}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const st = STATUS[inv.status] ?? { tone: 'neutral' as PillTone, label: inv.status };
              return (
                <tr key={inv.id} className="border-t border-app-rule">
                  <td className="py-3 pr-3 font-medium text-app-ink">{planName(inv.plan)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-app-muted">{METHOD_LABEL[inv.method] ?? inv.method}</td>
                  <td className="px-3 py-3"><Pill tone={st.tone}>{st.label}</Pill></td>
                  <td className="num whitespace-nowrap px-3 py-3 text-right text-app-muted">{isoDate(inv.createdAt)}</td>
                  <td className="num py-3 pl-3 text-right font-medium text-app-ink">{amountOf(inv)}</td>
                  {canConfirm && (
                    <td className="py-3 pl-3 text-right">
                      {inv.status === 'pending' && onConfirm && (
                        <button type="button" onClick={() => onConfirm(inv.id)} disabled={confirmingId === inv.id} className="btn-secondary !h-8 whitespace-nowrap !px-3 text-xs">
                          {confirmingId === inv.id ? '…' : 'Confirmar (teste)'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden">
        {invoices.map((inv) => {
          const st = STATUS[inv.status] ?? { tone: 'neutral' as PillTone, label: inv.status };
          return (
            <li key={inv.id} className="flex items-start justify-between gap-3 border-t border-app-rule py-3 first:border-t-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-app-ink">{planName(inv.plan)}</p>
                <p className="num text-xs text-app-faint">{isoDate(inv.createdAt)} · {METHOD_LABEL[inv.method] ?? inv.method}</p>
                {canConfirm && inv.status === 'pending' && onConfirm && (
                  <button type="button" onClick={() => onConfirm(inv.id)} disabled={confirmingId === inv.id} className="btn-secondary mt-2 !h-8 !px-3 text-xs">
                    {confirmingId === inv.id ? '…' : 'Confirmar (teste)'}
                  </button>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="num text-sm font-medium text-app-ink">{amountOf(inv)}</span>
                <Pill tone={st.tone}>{st.label}</Pill>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
