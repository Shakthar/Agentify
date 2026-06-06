import { create } from 'zustand';
import api from '../utils/api';
import { setTokens, clearTokens, saveTenant, getSavedTenant } from '../utils/auth';
import { Tenant } from '../types';

interface AuthState {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  // Estado intermédio quando 2FA está ativo
  pendingTwoFactor: boolean;
  twoFactorToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  completeTwoFactorLogin: (code: string) => Promise<void>;
  cancelTwoFactor: () => void;
  signup: (email: string, password: string, name: string, companyName?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  tenant: getSavedTenant<Tenant>(),
  loading: false,
  error: null,
  pendingTwoFactor: false,
  twoFactorToken: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });

      if (data.requiresTwoFactor) {
        // Primeiro fator OK — aguarda o código TOTP
        set({ pendingTwoFactor: true, twoFactorToken: data.twoFactorToken, loading: false });
        return;
      }

      setTokens(data.token, data.refreshToken);
      saveTenant(data.tenant);
      set({ tenant: data.tenant, loading: false });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Login failed';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  completeTwoFactorLogin: async (code: string) => {
    const { twoFactorToken } = get();
    if (!twoFactorToken) return;
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/api/auth/2fa/verify', { twoFactorToken, code });
      setTokens(data.token, data.refreshToken);
      saveTenant(data.tenant);
      set({ tenant: data.tenant, pendingTwoFactor: false, twoFactorToken: null, loading: false });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Código inválido';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  cancelTwoFactor: () => {
    set({ pendingTwoFactor: false, twoFactorToken: null, error: null });
  },

  signup: async (email, password, name, companyName) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/api/auth/signup', { email, password, name, companyName });
      setTokens(data.token, data.refreshToken);
      const tenant: Tenant = {
        id: data.id, email: data.email, name: data.name,
        companyName: data.companyName, plan: data.plan,
        creditsTotal: data.creditsTotal, creditsUsed: 0, createdAt: new Date().toISOString(),
      };
      saveTenant(tenant);
      set({ tenant, loading: false });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } }; message?: string; code?: string };
      let msg = axiosErr?.response?.data?.error;
      if (!msg) {
        // Sem resposta do servidor — mostra causa real
        if (axiosErr?.code === 'ERR_NETWORK' || !axiosErr?.response) {
          msg = `Sem resposta do servidor. Verifique se o backend está online. (${axiosErr?.message ?? 'Network Error'})`;
        } else {
          msg = `Erro ${axiosErr?.response?.status ?? ''}: ${axiosErr?.message ?? 'Signup failed'}`;
        }
      }
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      clearTokens();
      set({ tenant: null, pendingTwoFactor: false, twoFactorToken: null });
    }
  },

  loadMe: async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      saveTenant(data);
      set({ tenant: data });
    } catch {
      if (!get().tenant) clearTokens();
    }
  },

  clearError: () => set({ error: null }),
}));
