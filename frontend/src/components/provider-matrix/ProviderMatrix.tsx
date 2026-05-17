'use client';

import { useState, useEffect } from 'react';
import {
  Database, HardDrive, Mail, Monitor, Shield, Globe,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Check, AlertCircle, Server, ExternalLink
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ProviderConfig {
  mode: 'metl' | 'byok';
  provider?: string;
  [key: string]: any;
}

interface MatrixState {
  database: ProviderConfig;
  storage: ProviderConfig;
  mail: ProviderConfig;
  monitoring: ProviderConfig;
  auth: ProviderConfig;
  hosting: ProviderConfig;
}

interface ProviderDef {
  id: keyof MatrixState;
  label: string;
  icon: React.ElementType;
  description: string;
  metlLabel: string;
  metlProvider: string;
  byokProviders: { value: string; label: string }[];
  byokFields: Record<string, { label: string; type: 'text' | 'password' | 'number'; placeholder?: string; required?: boolean }>;
}

/* ------------------------------------------------------------------ */
/* Provider Definitions                                                */
/* ------------------------------------------------------------------ */

const PROVIDERS: ProviderDef[] = [
  {
    id: 'database',
    label: 'Database',
    icon: Database,
    description: 'PostgreSQL / Supabase storage engine',
    metlLabel: 'Supabase Stack (K3s)',
    metlProvider: 'metl_supabase',
    byokProviders: [
      { value: 'byok_supabase', label: 'External Supabase' },
      { value: 'byok_postgres', label: 'External Postgres' },
      { value: 'byok_mysql', label: 'External MySQL' },
      { value: 'byok_mongodb', label: 'MongoDB Atlas' },
    ],
    byokFields: {
      externalUrl: { label: 'Connection URL', type: 'password', placeholder: 'postgres://user:pass@host:5432/db', required: true },
      externalUsername: { label: 'Username', type: 'text', placeholder: 'optional username' },
      externalPassword: { label: 'Password', type: 'password', placeholder: 'optional password' },
    },
  },
  {
    id: 'storage',
    label: 'File Storage',
    icon: HardDrive,
    description: 'S3-compatible object storage',
    metlLabel: 'MinIO (K3s)',
    metlProvider: 'metl_minio',
    byokProviders: [
      { value: 'byok_s3', label: 'AWS S3' },
      { value: 'byok_azure_blob', label: 'Azure Blob' },
      { value: 'byok_digitalocean', label: 'DigitalOcean Spaces' },
    ],
    byokFields: {
      awsAccessKeyId: { label: 'Access Key ID', type: 'text', required: true },
      awsSecretAccessKey: { label: 'Secret Access Key', type: 'password', required: true },
      bucketName: { label: 'Bucket Name', type: 'text', required: true },
      region: { label: 'Region', type: 'text', placeholder: 'us-east-1', required: true },
      endpoint: { label: 'Custom Endpoint (optional)', type: 'text', placeholder: 'e.g. https://s3.custom.com' },
    },
  },
  {
    id: 'mail',
    label: 'Mail Client',
    icon: Mail,
    description: 'Transactional email delivery',
    metlLabel: 'Listmonk (K3s)',
    metlProvider: 'metl_listmonk',
    byokProviders: [
      { value: 'byok_resend', label: 'Resend' },
      { value: 'byok_sendgrid', label: 'SendGrid' },
      { value: 'byok_postmark', label: 'Postmark' },
    ],
    byokFields: {
      apiKey: { label: 'API Key', type: 'password', required: true },
      endpoint: { label: 'API Endpoint (optional)', type: 'text', placeholder: 'e.g. https://api.resend.com' },
      smtpHost: { label: 'SMTP Host (optional)', type: 'text' },
      smtpPort: { label: 'SMTP Port', type: 'number' },
      smtpUser: { label: 'SMTP User', type: 'text' },
      smtpPassword: { label: 'SMTP Password', type: 'password' },
    },
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: Monitor,
    description: 'Metrics, traces, and alerting',
    metlLabel: 'OpenTelemetry + SigNoz (K3s)',
    metlProvider: 'metl_signoz_otel',
    byokProviders: [
      { value: 'byok_sentry', label: 'Sentry' },
      { value: 'byok_datadog', label: 'Datadog' },
    ],
    byokFields: {
      sentryDsn: { label: 'Sentry DSN', type: 'password', placeholder: 'https://...@sentry.io/...' },
      datadogApiKey: { label: 'Datadog API Key', type: 'password' },
      otelEndpoint: { label: 'OTel Endpoint (optional)', type: 'text', placeholder: 'https://otel.collector.com' },
    },
  },
  {
    id: 'auth',
    label: 'Auth Gateway',
    icon: Shield,
    description: 'Identity and access management',
    metlLabel: 'Keycloak (K3s)',
    metlProvider: 'metl_keycloak',
    byokProviders: [
      { value: 'byok_clerk', label: 'Clerk' },
      { value: 'byok_auth0', label: 'Auth0' },
      { value: 'byok_firebase', label: 'Firebase Auth' },
    ],
    byokFields: {
      clerkPublishableKey: { label: 'Clerk Publishable Key', type: 'text' },
      clerkSecretKey: { label: 'Clerk Secret Key', type: 'password' },
      auth0Domain: { label: 'Auth0 Domain', type: 'text', placeholder: 'tenant.auth0.com' },
      auth0ClientId: { label: 'Auth0 Client ID', type: 'text' },
      auth0ClientSecret: { label: 'Auth0 Client Secret', type: 'password' },
      firebaseProjectId: { label: 'Firebase Project ID', type: 'text' },
      firebaseServiceAccount: { label: 'Firebase Service Account JSON', type: 'password' },
    },
  },
  {
    id: 'hosting',
    label: 'Hosting Target',
    icon: Globe,
    description: 'Deployment and build target',
    metlLabel: 'Metl K3s Grid + Traefik',
    metlProvider: 'metl_k3s_traefik',
    byokProviders: [
      { value: 'byok_vercel', label: 'Vercel' },
      { value: 'byok_netlify', label: 'Netlify' },
      { value: 'byok_cloudflare', label: 'Cloudflare Pages' },
    ],
    byokFields: {
      vercelToken: { label: 'Vercel Token', type: 'password' },
      vercelTeamId: { label: 'Vercel Team ID (optional)', type: 'text' },
      netlifyToken: { label: 'Netlify Token', type: 'password' },
      netlifySiteId: { label: 'Netlify Site ID (optional)', type: 'text' },
      cloudflareApiToken: { label: 'Cloudflare API Token', type: 'password' },
      cloudflareAccountId: { label: 'Cloudflare Account ID', type: 'text' },
    },
  },
];

const DEFAULT_MATRIX: MatrixState = {
  database: { mode: 'metl', provider: 'metl_supabase' },
  storage: { mode: 'metl', provider: 'metl_minio' },
  mail: { mode: 'metl', provider: 'metl_listmonk' },
  monitoring: { mode: 'metl', provider: 'metl_signoz_otel' },
  auth: { mode: 'metl', provider: 'metl_keycloak' },
  hosting: { mode: 'metl', provider: 'metl_k3s_traefik' },
};

/* ------------------------------------------------------------------ */
/* Helper Components                                                   */
/* ------------------------------------------------------------------ */

function StatusBadge({ mode }: { mode: 'metl' | 'byok' }) {
  if (mode === 'metl') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-600/15 text-blue-400 border border-blue-600/20">
        <Server className="w-3 h-3" />
        Metl Local
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-600/15 text-amber-400 border border-amber-600/20">
      <ExternalLink className="w-3 h-3" />
      BYOK
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function ProviderMatrix() {
  const [matrix, setMatrix] = useState<MatrixState>(DEFAULT_MATRIX);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch initial matrix from API
  useEffect(() => {
    fetch('/api/provider/default-tenant')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setMatrix((prev) => ({
            database: { ...prev.database, ...data.database },
            storage: { ...prev.storage, ...data.storage },
            mail: { ...prev.mail, ...data.mail },
            monitoring: { ...prev.monitoring, ...data.monitoring },
            auth: { ...prev.auth, ...data.auth },
            hosting: { ...prev.hosting, ...data.hosting },
          }));
        }
      })
      .catch(() => null);
  }, []);

  const toggleMode = (id: keyof MatrixState) => {
    setMatrix((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        mode: prev[id].mode === 'metl' ? 'byok' : 'metl',
        provider: prev[id].mode === 'metl'
          ? PROVIDERS.find((p) => p.id === id)?.byokProviders[0]?.value
          : PROVIDERS.find((p) => p.id === id)?.metlProvider,
      },
    }));
    setExpanded(id);
  };

  const updateField = (id: keyof MatrixState, field: string, value: string | number) => {
    setMatrix((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${id}.${field}`];
      return next;
    });
  };

  const validate = (def: ProviderDef): boolean => {
    const config = matrix[def.id];
    const nextErrors: Record<string, string> = {};
    if (config.mode === 'byok') {
      Object.entries(def.byokFields).forEach(([key, fieldDef]) => {
        if (fieldDef.required && !config[key]) {
          nextErrors[`${def.id}.${key}`] = `${fieldDef.label} is required`;
        }
      });
    }
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const saveProvider = async (def: ProviderDef) => {
    if (!validate(def)) return;

    setSaving(def.id);
    try {
      const res = await fetch('/api/provider/default-tenant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [def.id]: {
            provider: matrix[def.id].provider,
            ...matrix[def.id],
          },
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(def.id);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      console.error('Failed to save provider', err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Provider Matrix</h2>
        <p className="text-muted-foreground">
          Choose between Metl's self-hosted open-source services or bring your own keys
        </p>
      </div>

      <div className="grid gap-4">
        {PROVIDERS.map((def) => {
          const config = matrix[def.id];
          const isMetl = config.mode === 'metl';
          const isExpanded = expanded === def.id;
          const Icon = def.icon;

          return (
            <div
              key={def.id}
              className="rounded-lg border border-border bg-card hover:border-border transition-colors overflow-hidden"
            >
              {/* Header Row */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isMetl ? 'bg-blue-600/20 text-blue-400' : 'bg-amber-600/20 text-amber-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{def.label}</h3>
                      <StatusBadge mode={config.mode} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isMetl ? def.metlLabel : `External ${config.provider?.replace('byok_', '').toUpperCase() || 'Provider'}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleMode(def.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:bg-accent"
                  >
                    {isMetl ? (
                      <>
                        <ToggleRight className="w-6 h-6 text-blue-500" />
                        <span className="text-sm text-blue-400">Metl</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-6 h-6 text-amber-500" />
                        <span className="text-sm text-amber-400">BYOK</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : def.id)}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Expandable Configuration Panel */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border">
                  {isMetl ? (
                    <div className="pt-4 space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-600/5 border border-blue-600/10">
                        <Server className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-300">
                            {def.metlLabel} will be provisioned
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Metl deploys an isolated, self-hosted open-source pod in your tenant's
                            K3s namespace. No external credentials needed.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-4 space-y-4">
                      {/* Provider Selector */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          External Provider
                        </label>
                        <select
                          aria-label="External Provider"
                          title="External Provider"
                          value={config.provider || ''}
                          onChange={(e) => updateField(def.id, 'provider', e.target.value)}
                          className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        >
                          {def.byokProviders.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                          </option>
                          ))}
                        </select>
                      </div>

                      {/* Credential Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(def.byokFields).map(([fieldKey, fieldDef]) => {
                          const errKey = `${def.id}.${fieldKey}`;
                          const hasError = !!errors[errKey];
                          return (
                            <div key={fieldKey} className={fieldDef.type === 'password' ? 'md:col-span-1' : ''}>
                              <label className="block text-sm font-medium text-foreground mb-1.5">
                                {fieldDef.label}
                                {fieldDef.required && <span className="text-red-400 ml-0.5">*</span>}
                              </label>
                              <input
                                type={fieldDef.type}
                                value={config[fieldKey] || ''}
                                onChange={(e) => updateField(def.id, fieldKey, e.target.value)}
                                placeholder={fieldDef.placeholder}
                                className={`w-full rounded-lg bg-background border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 ${
                                  hasError
                                    ? 'border-red-500 focus:ring-red-500/40'
                                    : 'border-border focus:ring-amber-500/40'
                                }`}
                              />
                              {hasError && (
                                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {errors[errKey]}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => saveProvider(def)}
                          disabled={saving === def.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                        >
                          {saved === def.id ? (
                            <>
                              <Check className="w-4 h-4" />
                              Saved
                            </>
                          ) : saving === def.id ? (
                            'Saving...'
                          ) : (
                            'Save & Apply'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 rounded-lg bg-card border border-border">
        <h4 className="font-medium text-foreground mb-2">How it works</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-blue-400">Metl Local</strong> deploys isolated open-source pods inside your tenant's
          K3s namespace (Supabase/PostgreSQL, MinIO, Listmonk, Keycloak, OpenTelemetry/SigNoz).
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2">
          <strong className="text-amber-400">Bring Your Own Keys</strong> lets you inject external provider credentials
          (AWS S3, Resend, Sentry, Clerk, Vercel, etc.). Your application code reads standardized environment variables
          so you can switch providers anytime with zero code changes.
        </p>
      </div>
    </div>
  );
}
