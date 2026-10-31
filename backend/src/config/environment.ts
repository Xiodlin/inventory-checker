import 'dotenv/config';
import { z } from 'zod';
import cron from 'node-cron';

const schema = z.object({
  DATABASE_URL: z.string().url().refine(v => /^postgres(ql)?:\/\//.test(v)),
  REDIS_URL: z.string().url().refine(v => /^rediss?:\/\//.test(v)),
  JWT_SECRET: z.string().min(32).refine(v => !/^(change|replace|your|example)/i.test(v), 'Use a strong random secret'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173,null,file://').refine(value => {
    return value.split(',').every(entry => {
      if (['null', 'file://'].includes(entry.trim())) return true;
      try {
        const url = new URL(entry.trim());
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
      } catch { return false; }
    });
  }, 'Use comma-separated HTTP(S) origins, null, or file:// for packaged Electron').transform(value =>
    value.split(',').map(entry => ['null', 'file://'].includes(entry.trim()) ? entry.trim() : new URL(entry.trim()).origin)),
  CHECK_CRON: z.string().default('* * * * *').refine(v => cron.validate(v), 'Invalid cron expression'),
  FIREBASE_ENABLED: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  BESTBUY_API_KEY: z.string().optional(),
});

export function parseConfig(env: NodeJS.ProcessEnv) {
  const config = schema.parse(env);
  if (config.FIREBASE_ENABLED && !config.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required when FIREBASE_ENABLED=true');
  }
  return config;
}
export type Config = ReturnType<typeof parseConfig>;
