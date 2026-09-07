import dotenv from 'dotenv';
dotenv.config();

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: getEnv('SUPABASE_URL'),
    anonKey: getEnv('SUPABASE_ANON_KEY'),
    serviceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },
  tma: {
    baseUrl: getEnv('TMA_BASE_URL', 'http://localhost:5173'),
  },
};