import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../utils/constants';
import { Plan, PLAN_LABELS, PLAN_COLORS } from '../types';

const navItems = [
  { href: ROUTES.dashboard, label: 'Dashboard', icon: '◈' },
  { href: ROUTES.agents, label: 'Agentes', icon: '🤖' },
  { href: ROUTES.billing, label: 'Créditos', icon: '💳' },
  { href: ROUTES.admin, label: 'Admin', icon: '🛡️' },
  { href: ROUTES.settings, label: 'Definições', icon: '⚙️' },
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

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-white border-r border-gray-200 px-4 py-6">
      {/* Logo */}
      <div className="mb-8 px-2">
        <span className="text-xl font-bold text-brand-700">Agentfy</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Credits bar */}
      {tenant && (
        <div className="mb-4 px-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Créditos</span>
            <span>{tenant.creditsTotal - tenant.creditsUsed} restantes</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usedPercent >= 90 ? 'bg-red-500' : usedPercent >= 70 ? 'bg-yellow-500' : 'bg-brand-500'
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{usedPercent}% utilizado</p>
        </div>
      )}

      {/* User info */}
      {tenant && (
        <div className="border-t border-gray-200 pt-4 px-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">
              {tenant.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{tenant.name}</p>
              <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full ${PLAN_COLORS[tenant.plan as Plan]}`}>
                {PLAN_LABELS[tenant.plan as Plan]}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-gray-500 hover:text-gray-900 transition-colors mt-1 px-1"
          >
            Sair
          </button>
        </div>
      )}
    </aside>
  );
}
