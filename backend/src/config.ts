const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  databaseUrl: required('DATABASE_URL'),
  bridgePath: required('BRIDGE_PATH'),
  brokerName: required('BROKER_NAME'),
};
