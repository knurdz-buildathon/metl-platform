import { z } from 'zod';

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(50),
  email: z.string().email(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Tenant = z.infer<typeof TenantSchema>;

export const ProviderModeSchema = z.enum(['metl', 'byok']);
export type ProviderMode = z.infer<typeof ProviderModeSchema>;

export const DatabaseProviderSchema = z.enum([
  'metl_supabase',
  'metl_postgres',
  'byok_supabase',
  'byok_postgres',
  'byok_mysql',
  'byok_mongodb',
]);

export const StorageProviderSchema = z.enum([
  'metl_minio',
  'byok_s3',
  'byok_azure_blob',
  'byok_digitalocean',
]);

export const MailProviderSchema = z.enum([
  'metl_listmonk',
  'metl_smtp',
  'byok_resend',
  'byok_sendgrid',
  'byok_postmark',
]);

export const MonitoringProviderSchema = z.enum([
  'metl_signoz_otel',
  'byok_sentry',
  'byok_datadog',
]);

export const AuthProviderSchema = z.enum([
  'metl_keycloak',
  'metl_supabase_auth',
  'byok_clerk',
  'byok_auth0',
  'byok_firebase',
]);

export const HostingProviderSchema = z.enum([
  'metl_k3s_traefik',
  'byok_vercel',
  'byok_netlify',
  'byok_cloudflare',
]);

export const ProviderMatrixSchema = z.object({
  database: z.object({
    mode: ProviderModeSchema,
    provider: DatabaseProviderSchema.optional(),
    externalUrl: z.string().optional(),
    externalUsername: z.string().optional(),
    externalPassword: z.string().optional(),
  }),
  storage: z.object({
    mode: ProviderModeSchema,
    provider: StorageProviderSchema.optional(),
    awsAccessKeyId: z.string().optional(),
    awsSecretAccessKey: z.string().optional(),
    bucketName: z.string().optional(),
    region: z.string().optional(),
    azureConnectionString: z.string().optional(),
    endpoint: z.string().optional(),
  }),
  mail: z.object({
    mode: ProviderModeSchema,
    provider: MailProviderSchema.optional(),
    apiKey: z.string().optional(),
    endpoint: z.string().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpUser: z.string().optional(),
    smtpPassword: z.string().optional(),
  }),
  monitoring: z.object({
    mode: ProviderModeSchema,
    provider: MonitoringProviderSchema.optional(),
    sentryDsn: z.string().optional(),
    datadogApiKey: z.string().optional(),
    otelEndpoint: z.string().optional(),
  }),
  auth: z.object({
    mode: ProviderModeSchema,
    provider: AuthProviderSchema.optional(),
    clerkPublishableKey: z.string().optional(),
    clerkSecretKey: z.string().optional(),
    auth0Domain: z.string().optional(),
    auth0ClientId: z.string().optional(),
    auth0ClientSecret: z.string().optional(),
    firebaseProjectId: z.string().optional(),
    firebaseServiceAccount: z.string().optional(),
  }),
  hosting: z.object({
    mode: ProviderModeSchema,
    provider: HostingProviderSchema.optional(),
    vercelToken: z.string().optional(),
    vercelTeamId: z.string().optional(),
    netlifyToken: z.string().optional(),
    netlifySiteId: z.string().optional(),
    cloudflareAccountId: z.string().optional(),
    cloudflareApiToken: z.string().optional(),
  }),
});

export type ProviderMatrix = z.infer<typeof ProviderMatrixSchema>;

export const DeploymentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(50),
  gitUrl: z.string().url(),
  branch: z.string().default('main'),
  status: z.enum(['pending', 'building', 'running', 'error', 'scaled_zero']),
  imageTag: z.string().optional(),
  containerPort: z.number().int().min(1).max(65535).default(3000),
  scalingTier: z.enum(['warm', 'cold']).default('warm'),
  memoryLimitMb: z.number().int().min(128).default(512),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Deployment = z.infer<typeof DeploymentSchema>;

export const ResourceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  deploymentId: z.string().uuid().optional(),
  type: z.enum(['postgres', 'redis', 'blob', 'mail', 'monitoring', 'auth', 'hosting']),
  mode: ProviderModeSchema,
  status: z.enum(['provisioning', 'running', 'error', 'deleting']),
  credentials: z.record(z.string()).optional(),
  endpoint: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Resource = z.infer<typeof ResourceSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'codegen',
    'security.scan',
    'deploy.build',
    'deploy.apply',
    'resource.provision',
    'resource.deprovision',
    'orchestrate.apply',
    'sre.health.check',
    'eco.scale.zero',
    'eco.scale.up',
    'ai.chat',
    'ai.generate',
  ]),
  tenantId: z.string().uuid(),
  deploymentId: z.string().uuid().optional(),
  payload: z.record(z.unknown()),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Task = z.infer<typeof TaskSchema>;

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  deploymentId: z.string().uuid().optional(),
  severity: z.enum(['info', 'warning', 'critical']),
  category: z.string(),
  message: z.string(),
  source: z.string(),
  resolvedAt: z.date().optional(),
  createdAt: z.date(),
});

export type Incident = z.infer<typeof IncidentSchema>;

export const GlassBoxNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['pod', 'service', 'ingress', 'deployment', 'secret', 'configmap']),
  label: z.string(),
  status: z.enum(['running', 'pending', 'error', 'scaled_zero']),
  metadata: z.record(z.unknown()),
});

export type GlassBoxNode = z.infer<typeof GlassBoxNodeSchema>;

export const GlassBoxEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
});

export type GlassBoxEdge = z.infer<typeof GlassBoxEdgeSchema>;

export const TopologySchema = z.object({
  nodes: z.array(GlassBoxNodeSchema),
  edges: z.array(GlassBoxEdgeSchema),
});

export type Topology = z.infer<typeof TopologySchema>;
