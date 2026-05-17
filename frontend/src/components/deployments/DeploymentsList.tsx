'use client';

import { useState, useEffect } from 'react';
import { Rocket, Clock, CheckCircle, XCircle, Loader2, Terminal } from 'lucide-react';

interface Deployment {
  id: string;
  name: string;
  slug: string;
  status: string;
  url: string;
  updatedAt: string;
}

export function DeploymentsList() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeployments();
    const interval = setInterval(fetchDeployments, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeployments = async () => {
    try {
      const res = await fetch('/api/deployments?tenantId=default-tenant');
      const data = await res.json();
      setDeployments(data.deployments || []);
    } catch (err) {
      console.error('Failed to fetch deployments', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'building':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Deployments</h2>
        <p className="text-muted-foreground">Manage your deployed applications</p>
      </div>

      <div className="grid gap-4">
        {deployments.length === 0 && (
          <div className="p-8 text-center rounded-lg border border-border bg-card">
            <Rocket className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-1">No deployments yet</h3>
            <p className="text-sm text-muted-foreground">
              Use the chat to create and deploy your first application
            </p>
          </div>
        )}

        {deployments.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Rocket className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium">{d.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(d.status)}
                  <span className="text-sm text-muted-foreground capitalize">{d.status}</span>
                  <span className="text-muted-foreground">|</span>
                  <a
                    href={`https://${d.slug}.metl.run`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline"
                  >
                    {d.slug}.metl.run
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-accent rounded-lg transition-colors" title="View logs">
                <Terminal className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
