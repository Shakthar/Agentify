import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { ROUTES } from '../../utils/constants';
import { Plan, PLAN_LABELS } from '../../types';
import LanguageSwitcher from '../LanguageSwitcher';
import { LogoMark } from '../Logo';

/** Barra de topo (48px) no mesmo fundo da moldura: âmbito à esquerda, créditos, idioma, tema e conta à direita. */
export default function TopBar() {
  const { tenant } = useAuth();
  const { isDark, toggle } = useTheme();
  const left = tenant ? Math.max(0, tenant.creditsTotal - tenant.creditsUsed) : null;
  const low = tenant ? tenant.creditsUsed / Math.max(1, tenant.creditsTotal) >= 0.9 : false;

  return (
    <div className="flex h-12 items-center justify-between gap-3 px-4 md:pl-2 md:pr-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="md:hidden">
          <LogoMark size={26} />
        </span>
        {tenant && (
          <p className="truncate text-sm text-app-muted">
            <span className="font-semibold text-app-ink">{tenant.name}</span>
            {tenant.plan && <span className="hidden sm:inline"> · {PLAN_LABELS[tenant.plan as Plan] ?? tenant.plan}</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {left !== null && (
          <Link
            href={ROUTES.credits}
            className={`num inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${low ? 'bg-app-neg-soft text-app-neg' : 'bg-app-sheet text-app-ink hover:bg-app-raised'}`}
            title="Créditos disponíveis"
          >
            {left.toLocaleString('pt-PT')} <span className="font-normal text-app-muted">créditos</span>
          </Link>
        )}
        <span className="hidden sm:block">
          <LanguageSwitcher />
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-app-muted transition-colors hover:bg-app-sheet hover:text-app-ink"
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        {tenant && (
          <Link
            href={ROUTES.profile}
            aria-label="Perfil"
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-app-ink text-sm font-semibold text-app-sheet"
          >
            {tenant.name?.[0]?.toUpperCase() ?? '?'}
          </Link>
        )}
      </div>
    </div>
  );
}
