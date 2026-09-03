const TOKEN_KEY = 'agentfy_token';
const REFRESH_KEY = 'agentfy_refresh';
const TENANT_KEY = 'agentfy_tenant';
const IMPERSONATION_BACKUP_TOKEN_KEY = 'agentfy_impersonation_backup_token';
const IMPERSONATION_BACKUP_TENANT_KEY = 'agentfy_impersonation_backup_tenant';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(token: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(TENANT_KEY);
}

export function saveTenant(tenant: object): void {
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

export function getSavedTenant<T>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Impersonation helpers ────────────────────────────────────────────────────

export function startImpersonation(impersonationToken: string, impersonatedTenantName: string): void {
  const originalToken = localStorage.getItem(TOKEN_KEY) ?? '';
  const originalTenant = localStorage.getItem(TENANT_KEY) ?? '';
  localStorage.setItem(IMPERSONATION_BACKUP_TOKEN_KEY, originalToken);
  localStorage.setItem(IMPERSONATION_BACKUP_TENANT_KEY, originalTenant);
  // Store impersonated tenant name for the banner
  localStorage.setItem('agentfy_impersonation_name', impersonatedTenantName);
  localStorage.setItem(TOKEN_KEY, impersonationToken);
  // No refresh token for impersonation sessions (short-lived)
  localStorage.removeItem(REFRESH_KEY);
}

export function exitImpersonation(): void {
  const originalToken = localStorage.getItem(IMPERSONATION_BACKUP_TOKEN_KEY) ?? '';
  const originalTenant = localStorage.getItem(IMPERSONATION_BACKUP_TENANT_KEY) ?? '';
  localStorage.setItem(TOKEN_KEY, originalToken);
  if (originalTenant) localStorage.setItem(TENANT_KEY, originalTenant);
  localStorage.removeItem(IMPERSONATION_BACKUP_TOKEN_KEY);
  localStorage.removeItem(IMPERSONATION_BACKUP_TENANT_KEY);
  localStorage.removeItem('agentfy_impersonation_name');
}

export function getImpersonationInfo(): { active: boolean; tenantName: string } {
  if (typeof window === 'undefined') return { active: false, tenantName: '' };
  const backup = localStorage.getItem(IMPERSONATION_BACKUP_TOKEN_KEY);
  const name = localStorage.getItem('agentfy_impersonation_name') ?? '';
  return { active: !!backup, tenantName: name };
}
