'use client';

import { useState } from 'react';
import { Download, Package, FileArchive, Container, Database } from 'lucide-react';

export function EjectionPanel() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  };

  const pollStatus = async () => {
    try {
      const res = await fetch('/api/eject/default-tenant/status');
      const data = await res.json();

      if (data.status === 'complete') {
        setDownloadUrl(data.downloadUrl);
        setStatus(`Ejection complete! Package size: ${(data.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
        clearPoll();
        setLoading(false);
      } else {
        setStatus('Ejection in progress...');
      }
    } catch {
      setStatus('Error checking ejection status');
      clearPoll();
      setLoading(false);
    }
  };

  const handleEject = async () => {
    setLoading(true);
    setStatus('Preparing ejection package...');
    setDownloadUrl(null);
    clearPoll();

    try {
      const res = await fetch('/api/eject/default-tenant', { method: 'POST' });
      const data = await res.json();

      if (data.status === 'started') {
        setStatus('Ejection started! This may take a minute...');
        const interval = setInterval(pollStatus, 3000);
        setPollInterval(interval);
      } else {
        setStatus(data.message || 'Ejection initiated');
      }
    } catch (err) {
      setStatus('Error: Failed to start ejection');
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Ejection Engine</h2>
        <p className="text-slate-400">
          Export your entire application stack with zero lock-in
        </p>
      </div>

      <div className="p-6 rounded-lg border border-amber-600/30 bg-amber-900/10 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-8 h-8 text-amber-400" />
          <div>
            <h3 className="font-medium text-amber-200">Zero Lock-In Guarantee</h3>
            <p className="text-sm text-amber-200/70">
              Your code, your data, your infrastructure. Always.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="p-3 rounded-lg bg-slate-900/50">
            <FileArchive className="w-5 h-5 text-blue-400 mb-2" />
            <p className="text-xs font-medium">Helm Chart</p>
            <p className="text-xs text-slate-500">K8s deployment package</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50">
            <Container className="w-5 h-5 text-green-400 mb-2" />
            <p className="text-xs font-medium">Docker Compose</p>
            <p className="text-xs text-slate-500">Standalone deployment</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50">
            <Database className="w-5 h-5 text-purple-400 mb-2" />
            <p className="text-xs font-medium">Schema Export</p>
            <p className="text-xs text-slate-500">PostgreSQL migration</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleEject}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg px-6 py-3 transition-colors font-medium"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Ejecting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Eject Project
          </>
        )}
      </button>

      {status && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-center text-amber-300">{status}</p>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="flex items-center justify-center gap-2 mx-auto w-fit bg-green-600 hover:bg-green-700 text-white rounded-lg px-6 py-2 transition-colors font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              Download Package
            </a>
          )}
        </div>
      )}

      <div className="mt-8 space-y-3">
        <h4 className="font-medium text-sm">What gets exported</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex items-center gap-2">
            <CheckIcon /> Complete application source code
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon /> Database schema (pg_dump SQL)
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon /> Infrastructure manifests (Helm + Docker Compose)
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon /> Environment configuration templates
          </li>
        </ul>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
