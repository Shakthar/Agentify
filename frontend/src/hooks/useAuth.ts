import { create } from 'zustand';
import api from '../utils/api';
import { setTokens, clearTokens, saveTenant, getSavedTenant } from '../utils/auth';
import { Tenant } from '../types';

interface AuthState {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, companyName?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  tenant: getSavedTenant<Tenant>(),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      setTokens(data.token, data.refreshToken);
      saveTenant(data.tenant);
      set({ tenant: data.tenant, loading: false });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Login failed';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
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
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Signup failed';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      clearTokens();
      set({ tenant: null });
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
