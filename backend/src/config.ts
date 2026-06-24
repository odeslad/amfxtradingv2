import fs from 'fs';

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

export interface BrokerConfig {
  name: string;
  bridgePath: string;
}

function loadBrokers(): BrokerConfig[] {
  const file = required('BROKERS_FILE');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const brokers = JSON.parse(raw) as BrokerConfig[];
    if (!Array.isArray(brokers) || brokers.length === 0) {
      throw new Error('brokers.json must be a non-empty array');
    }
    return brokers;
  } catch (err) {
    throw new Error(`Failed to load brokers from ${file}: ${err}`);
  }
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  brokers: loadBrokers(),
  // Web Push (VAPID). Optional: when unset, push notifications are disabled.
  vapidPublicKey: process.env['VAPID_PUBLIC_KEY'] ?? '',
  vapidPrivateKey: process.env['VAPID_PRIVATE_KEY'] ?? '',
  vapidSubject: process.env['VAPID_SUBJECT'] ?? 'mailto:info@amfxtrading.com',
};
