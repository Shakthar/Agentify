import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../utils/constants';
import Logo from './Logo';
import { exitImpersonation, getImpersonationInfo } from '../utils/auth';
import {
  LayoutDashboard, Bot, Zap, Rocket, Palette, ShieldCheck, User,
  Building2, Users, BookOpen, KeyRound, type LucideIcon,
} from 'lucide-react';

const BASE_NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: ROUTES.dashboard,          label: 'Dashboard',   icon: LayoutDashboard },
  { href: ROUTES.agents,             label: 'Agentes',     icon: Bot             },
  { href: ROUTES.credits,            label: 'Créditos',    icon: Zap             },
  { href: ROUTES.plans,              label: 'Planos',      icon: Rocket          },
  { href: ROUTES.whitelabelDashboard,label: 'White-label', icon: Palette         },
  { href: ROUTES.admin,              label: 'Admin',       icon: ShieldCheck     },
  { href: ROUTES.profile,            label: 'Perfil',      icon: User            },
];

// Items shown in the mobile bottom bar (max 5)
const mobileItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: ROUTES.dashboard, label: 'Início',   icon: LayoutDashboard },
  { href: ROUTES.agents,    label: 'Agentes',  icon: Bot             },
  { href: ROUTES.credits,   label: 'Créditos', icon: Zap             },
  { href: ROUTES.plans,     label: 'Planos',   icon: Rocket          },
  { href: ROUTES.profile,   label: 'Perfil',   icon: User            },
];

export default function Navigation() {
  const router = useRouter();
  const { tenant, logout, loadMe } = useAuth();
  const [impersonation, setImpersonation] = useState({ active: false, tenantName: '' });

  useEffect(() => {
    setImpersonation(getImpersonationInfo());
  }, []);

  async function handleExitImpersonation() {
    exitImpersonation();
    setImpersonation({ active: false, tenantName: '' });
    await loadMe();
    router.push(ROUTES.admin);
  }
  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(tenant?.isAgency || tenant?.isAdmin ? [{ href: ROUTES.agency, label: 'Agência', icon: Building2 }] : []),
    { href: ROUTES.crm, label: 'CRM', icon: Users },
    { href: ROUTES.prompts, label: 'Prompts', icon: BookOpen },
  ];

  const handleLogout = async () => {
    await logout();
    router.push(ROUTES.home);
  };

  const usedPercent = tenant
    ? Math.round((tenant.creditsUsed / tenant.creditsTotal) * 100)
    : 0;

  // "Painel" só fica ativo na própria página; a ficha de um agente
  // (/dashboard/[id]) e a criação contam como "Agentes".
  const isActive = (href: string) => {
    const p = router.pathname;
    if (href === '/dashboard') return p === '/dashboard';
    if (href === '/dashboard/agents') return p === href || p.startsWith(href + '/') || p === '/dashboard/[id]' || p === '/dashboard/create';
    return p === href || p.startsWith(href + '/');
  };

  return (
    <>
      {/* ═══ IMPERSONATION BANNER ══════════════════════════════════════════ */}
      {impersonation.active && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs flex items-center justify-between px-4 py-2 shadow-md">
          <span className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5 shrink-0" /> A gerir como: <strong>{impersonation.tenantName}</strong></span>
          <button
            onClick={handleExitImpersonation}
            className="ml-4 bg-white text-amber-700 font-semibold px-3 py-0.5 rounded-full hover:bg-amber-100 transition-colors"
          >
            Sair da conta
          </button>
        </div>
      )}

      {/* ═══ BARRA LATERAL (md+): no fundo da moldura, sem borda; item ativo = pílula branca neutra ═══ */}
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col bg-app-frame px-3 pb-4 pt-3 md:flex">
        <Link href={ROUTES.dashboard} className="mb-5 flex h-9 items-center px-2" aria-label="Agentfy">
          <Logo size={28} />
        </Link>

        <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Navegação principal">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                  active ? 'bg-app-sheet font-semibold text-app-ink' : 'text-app-muted hover:bg-app-sheet/60 hover:text-app-ink'
                }`}
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-app-accent' : ''}`} strokeWidth={1.75} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {tenant && (
          <div className="mt-3 rounded-lg px-3 py-2">
            <div className="flex justify-between text-xs text-app-muted">
              <span>Créditos usados</span>
              <span className="num">{usedPercent}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-app-edge">
              <div
                className={`h-full rounded-full ${usedPercent >= 90 ? 'bg-app-neg' : usedPercent >= 70 ? 'bg-app-warn' : 'bg-app-accent'}`}
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>
            <p className="num mt-1 text-xs text-app-faint">
              {(tenant.creditsTotal - tenant.creditsUsed).toLocaleString('pt-PT')} de {tenant.creditsTotal.toLocaleString('pt-PT')} restantes
            </p>
          </div>
        )}

        {tenant && (
          <button
            onClick={handleLogout}
            className="mt-1 flex h-9 items-center rounded-lg px-3 text-left text-sm text-app-muted transition-colors hover:bg-app-sheet/60 hover:text-app-ink"
          >
            Sair
          </button>
        )}

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-3">
          {[['Privacidade', '/privacy-policy'], ['Termos', '/terms-of-service'], ['Dados', '/data-deletion'], ['FAQ', '/faq']].map(([label, href]) => (
            <Link key={href} href={href} className="text-xs text-app-faint transition-colors hover:text-app-ink">
              {label}
            </Link>
          ))}
        </div>
      </aside>

      {/* ═══ MOBILE BOTTOM NAV (< md) ══════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-app-frame border-t border-app-edge flex items-center justify-around px-1 py-1 safe-bottom" aria-label="Navegação">
        {mobileItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[56px] transition-colors ${
                active
                  ? 'text-app-ink'
                  : 'text-app-muted'
              }`}
            >
              <item.icon className={`w-5 h-5 ${active ? '' : 'opacity-70'}`} strokeWidth={active ? 2.25 : 2} />
              <span className={`text-[14px] font-medium leading-none ${active ? 'font-semibold' : ''}`}>{item.label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-app-accent mt-0.5" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
