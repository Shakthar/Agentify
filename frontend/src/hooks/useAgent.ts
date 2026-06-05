import { useState, useCallback } from 'react';
import api from '../utils/api';
import { Agent, CreateAgentInput } from '../types';

export function useAgent() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async (skip = 0, take = 10, search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ skip: String(skip), take: String(take) });
      if (search) params.set('search', search);
      const { data } = await api.get(`/api/agents?${params}`);
      setAgents(data.agents);
      setTotal(data.total);
    } catch {
      setError('Erro ao carregar agentes');
    } finally {
      setLoading(false);
    }
  }, []);

  const createAgent = useCallback(async (input: CreateAgentInput): Promise<Agent> => {
    const { data } = await api.post('/api/agents', input);
    return data;
  }, []);

  const updateAgent = useCallback(async (id: string, input: Partial<CreateAgentInput>): Promise<Agent> => {
    const { data } = await api.patch(`/api/agents/${id}`, input);
    return data;
  }, []);

  const deleteAgent = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/api/agents/${id}`);
    setAgents((prev) => prev.filter((a) => a.id !== id));
    setTotal((prev) => prev - 1);
  }, []);

  const toggleAgent = useCallback(async (id: string): Promise<void> => {
    const { data } = await api.patch(`/api/agents/${id}/toggle`);
    setAgents((prev) => prev.map((a) => a.id === id ? { ...a, isActive: data.isActive } : a));
  }, []);

  return { agents, total, loading, error, fetchAgents, createAgent, updateAgent, deleteAgent, toggleAgent };
}
