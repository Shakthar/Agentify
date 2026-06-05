const TOKEN_KEY = 'agentfy_token';
const REFRESH_KEY = 'agentfy_refresh';
const TENANT_KEY = 'agentfy_tenant';

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
