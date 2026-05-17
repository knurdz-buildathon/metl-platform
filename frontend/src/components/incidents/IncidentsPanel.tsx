'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Info, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface Incident {
  id: string;
  severity: string;
  category: string;
  message: string;
  source: string;
  createdAt: string;
  resolvedAt: string | null;
}

export function IncidentsPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await fetch('/api/incidents?tenantId=default-tenant');
      const data = await res.json();
      setIncidents(data.incidents || []);
    } catch (err) {
      console.error('Failed to fetch incidents', err);
    }
  };

  const resolveIncident = async (id: string) => {
    try {
      await fetch(`/api/incidents/${id}/resolve`, { method: 'POST' });
      fetchIncidents();
    } catch (err) {
      console.error('Failed to resolve incident', err);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const filtered = incidents.filter((i) => {
    if (filter === 'all') return true;
    if (filter === 'active') return !i.resolvedAt;
    return i.severity === filter;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Incidents</h2>
          <p className="text-muted-foreground">Real-time alerts from the SRE monitoring system</p>
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'critical', 'warning'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-sm capitalize transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-accent text-muted-foreground hover:bg-accent'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="p-8 text-center rounded-lg border border-border bg-card">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <h3 className="text-lg font-medium">All clear</h3>
            <p className="text-sm text-muted-foreground">No incidents to report</p>
          </div>
        )}

        {filtered.map((incident) => (
          <div
            key={incident.id}
            className={`p-4 rounded-lg border ${
              incident.resolvedAt
                ? 'border-border bg-card/50 opacity-60'
                : incident.severity === 'critical'
                ? 'border-red-900/50 bg-red-900/10'
                : 'border-amber-900/50 bg-amber-900/10'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {getSeverityIcon(incident.severity)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{incident.category}</span>
                    <span className="text-xs text-muted-foreground">{incident.source}</span>
                  </div>
                  <p className="text-sm text-foreground mt-1">{incident.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(incident.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {!incident.resolvedAt && (
                <button
                  onClick={() => resolveIncident(incident.id)}
                  className="p-1 hover:bg-accent rounded transition-colors"
                  title="Resolve"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
