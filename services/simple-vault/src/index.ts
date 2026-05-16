import crypto from 'crypto';
import express from 'express';
import dotenv from 'dotenv';
import { logger, initTelemetry } from '@metl/logger';

dotenv.config();
initTelemetry();

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);
const ENCRYPTION_KEY = process.env.VAULT_KEY || crypto.randomBytes(32).toString('hex');
const VAULT_FILE = process.env.VAULT_FILE || '/tmp/metl-vault.json';

// In-memory store with file persistence
let vaultStore: Record<string, string> = {};

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(hash: string): string {
  const [ivHex, authTagHex, encrypted] = hash.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'simple-vault' });
});

// Store secret
app.post('/secret/:name', (req, res) => {
  try {
    const { name } = req.params;
    const { value } = req.body;
    if (!value) {
      res.status(400).json({ error: 'value is required' });
      return;
    }
    vaultStore[name] = encrypt(value);
    res.json({ stored: true, name });
  } catch (err) {
    logger.error({ err }, 'Store secret error');
    res.status(500).json({ error: 'Failed to store secret' });
  }
});

// Get secret
app.get('/secret/:name', (req, res) => {
  try {
    const { name } = req.params;
    const encrypted = vaultStore[name];
    if (!encrypted) {
      res.status(404).json({ error: 'Secret not found' });
      return;
    }
    const value = decrypt(encrypted);
    res.json({ name, value });
  } catch (err) {
    logger.error({ err }, 'Get secret error');
    res.status(500).json({ error: 'Failed to get secret' });
  }
});

// Delete secret
app.delete('/secret/:name', (req, res) => {
  delete vaultStore[req.params.name];
  res.json({ deleted: true });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'Simple Vault listening');
});

function shutdown(signal: string) {
  logger.info({ signal }, 'Simple Vault shutting down');
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
