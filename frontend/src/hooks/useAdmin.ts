import { useState, useCallback } from 'react';
import api from '../utils/api';
import { AdminMetrics, AuditLogEntry } from '../types';

interface AuditLogsResult {
  logs: AuditLogEntry[];
  total: number;
}

export function useAdmin() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<AdminMetrics>('/api/admin/metrics');
      setMetrics(data);
    } catch {
      setError('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (skip = 0, take = 50) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<AuditLogsResult>('/api/admin/audit-logs', {
        params: { skip, take },
      });
      setAuditLogs(data.logs);
      setAuditTotal(data.total);
    } catch {
      setError('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, []);

  return { metrics, auditLogs, auditTotal, loading, error, fetchMetrics, fetchAuditLogs };
}
