import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { BlobServiceClient } from '@azure/storage-blob';
import { PostgreSQLManagementFlexibleServerClient } from '@azure/arm-postgresql-flexible';
import { RedisManagementClient } from '@azure/arm-rediscache';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { logger } from '@metl/logger';

const credential = new DefaultAzureCredential();

// Key Vault
const keyVaultUrl = process.env.KEYVAULT_URL;
export const secretClient = keyVaultUrl
  ? new SecretClient(keyVaultUrl, credential)
  : null;

export async function setSecret(name: string, value: string): Promise<void> {
  if (!secretClient) throw new Error('Key Vault not configured');
  await secretClient.setSecret(name, value);
  logger.info({ secretName: name }, 'Secret stored in Key Vault');
}

export async function getSecret(name: string): Promise<string | undefined> {
  if (!secretClient) throw new Error('Key Vault not configured');
  const secret = await secretClient.getSecret(name);
  return secret.value || undefined;
}

// Blob Storage
const storageAccount = process.env.STORAGE_ACCOUNT;
const blobServiceUrl = storageAccount
  ? `https://${storageAccount}.blob.core.windows.net`
  : null;
export const blobServiceClient = blobServiceUrl
  ? new BlobServiceClient(blobServiceUrl, credential)
  : null;

export async function ensureContainer(containerName: string): Promise<void> {
  if (!blobServiceClient) throw new Error('Blob Storage not configured');
  await blobServiceClient.createContainer(containerName, { access: 'blob' });
}

export async function uploadBlob(
  containerName: string,
  blobName: string,
  content: Buffer | string,
): Promise<string> {
  if (!blobServiceClient) throw new Error('Blob Storage not configured');
  const container = blobServiceClient.getContainerClient(containerName);
  await container.createIfNotExists();
  const blob = container.getBlockBlobClient(blobName);
  await blob.upload(content, Buffer.byteLength(content));
  return blob.url;
}

// PostgreSQL
const postgresConfig = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'metl',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

export const pgPool = postgresConfig.host ? new Pool(postgresConfig) : null;

export async function queryPostgres<T = any>(sql: string, params?: any[]): Promise<T[]> {
  if (!pgPool) throw new Error('PostgreSQL not configured');
  const result = await pgPool.query(sql, params);
  return result.rows;
}

// Redis
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6380'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_PORT === '6380' ? {} : undefined,
};

export const redisClient = redisConfig.host
  ? new Redis(redisConfig)
  : null;

export async function redisSet(key: string, value: string, ttl?: number): Promise<void> {
  if (!redisClient) throw new Error('Redis not configured');
  if (ttl) {
    await redisClient.setex(key, ttl, value);
  } else {
    await redisClient.set(key, value);
  }
}

export async function redisGet(key: string): Promise<string | null> {
  if (!redisClient) throw new Error('Redis not configured');
  return redisClient.get(key);
}

// Azure Resource Management
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

export async function createPostgresFlexibleServer(
  resourceGroup: string,
  serverName: string,
  location: string,
): Promise<string> {
  const client = new PostgreSQLManagementFlexibleServerClient(credential, subscriptionId!);
  const server = await client.servers.beginCreateAndWait(resourceGroup, serverName, {
    location,
    sku: { name: 'Standard_B2ms', tier: 'Burstable' },
    administratorLogin: `metl_${serverName}`,
    administratorLoginPassword: generatePassword(),
    version: '15',
    storage: { storageSizeGB: 32 },
    highAvailability: { mode: 'ZoneRedundant' },
  });
  logger.info({ serverName }, 'Created Azure PostgreSQL Flexible Server');
  return server.fullyQualifiedDomainName || '';
}

export async function deletePostgresFlexibleServer(
  resourceGroup: string,
  serverName: string,
): Promise<void> {
  const client = new PostgreSQLManagementFlexibleServerClient(credential, subscriptionId!);
  await client.servers.beginDeleteAndWait(resourceGroup, serverName);
  logger.info({ serverName }, 'Deleted Azure PostgreSQL Flexible Server');
}

export async function createRedisEnterprise(
  resourceGroup: string,
  name: string,
  location: string,
): Promise<string> {
  const client = new RedisManagementClient(credential, subscriptionId!);
  const cluster = await client.redis.beginCreateAndWait(resourceGroup, name, {
    location,
    sku: { name: 'Enterprise', family: 'E', capacity: 2 },
  });
  logger.info({ name }, 'Created Azure Redis Enterprise');
  return cluster.hostName || '';
}

function generatePassword(length = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
