import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../utils/constants';
import { Plan, PLAN_LABELS, PLAN_COLORS } from '../types';
import LanguageSwitcher from './LanguageSwitcher';
import Logo from './Logo';

const navItems = [
  { href: ROUTES.dashboard,          label: 'Dashboard',   icon: '◈'  },
  { href: ROUTES.agents,             label: 'Agentes',     icon: '🤖' },
  { href: ROUTES.credits,            label: 'Créditos',    icon: '⚡' },
  { href: ROUTES.plans,              label: 'Planos',      icon: '🚀' },
  { href: ROUTES.whitelabelDashboard,label: 'White-label', icon: '🎨' },
  { href: ROUTES.admin,              label: 'Admin',       icon: '🛡️' },
  { href: ROUTES.profile,            label: 'Perfil',      icon: '👤' },
];

// Items shown in the mobile bottom bar (max 5)
const mobileItems = [
  { href: ROUTES.dashboard, label: 'Início',   icon: '◈'  },
  { href: ROUTES.agents,    label: 'Agentes',  icon: '🤖' },
  { href: ROUTES.credits,   label: 'Créditos', icon: '⚡' },
  { href: ROUTES.plans,     label: 'Planos',   icon: '🚀' },
  { href: ROUTES.profile,   label: 'Perfil',   icon: '👤' },
];

export default function Navigation() {
  const router = useRouter();
  const { tenant, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push(ROUTES.home);
  };

  const usedPercent = tenant
    ? Math.round((tenant.creditsUsed / tenant.creditsTotal) * 100)
    : 0;

  const isActive = (href: string) =>
    router.pathname === href || router.pathname.startsWith(href + '/');

  return (
    <>
      {/* ═══ DESKTOP SIDEBAR (md+) ══════════════════════════════════════════ */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 min-h-screen bg-white border-r border-gray-200 px-3 py-5 dark:bg-gray-900 dark:border-gray-800">
        {/* Logo */}
        <div className="mb-6 px-2">
          <Logo />
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
              }`}
            >
              <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="mb-3 px-2">
          <LanguageSwitcher />
        </div>

        {/* Credits bar */}
        {tenant && (
          <div className="mb-3 px-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1 dark:text-gray-400">
              <span>Créditos</span>
              <span>{(tenant.creditsTotal - tenant.creditsUsed).toLocaleString()} rest.</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden dark:bg-gray-700">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPercent >= 90 ? 'bg-red-500' : usedPercent >= 70 ? 'bg-yellow-500' : 'bg-brand-500'
                }`}
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">{usedPercent}% utilizado</p>
          </div>
        )}

        {/* User info */}
        {tenant && (
          <div className="border-t border-gray-200 pt-3 px-2 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm dark:bg-brand-900/40 dark:text-brand-400 shrink-0">
                {tenant.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">{tenant.name}</p>
                <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full ${PLAN_COLORS[tenant.plan as Plan]}`}>
                  {PLAN_LABELS[tenant.plan as Plan]}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left text-xs text-gray-500 hover:text-gray-900 transition-colors mt-1 px-1 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Sair →
            </button>
          </div>
        )}

        {/* Legal */}
        <div className="pt-2 px-2 border-t border-gray-100 dark:border-gray-800 mt-2">
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {[['Privacidade', '/privacy-policy'], ['Termos', '/terms-of-service'], ['Dados', '/data-deletion']].map(([label, href]) => (
              <Link key={href} href={href} className="text-[10px] text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      {/* ═══ MOBILE BOTTOM NAV (< md) ══════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 flex items-center justify-around px-1 py-1 safe-bottom">
        {mobileItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[56px] transition-colors ${
                active
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span className={`text-xl leading-none ${active ? '' : 'opacity-70'}`}>{item.icon}</span>
              <span className={`text-[10px] font-medium leading-none ${active ? 'font-semibold' : ''}`}>{item.label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-brand-600 dark:bg-brand-400 mt-0.5" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
