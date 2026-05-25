import pino, { type Logger } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const baseConfig = {
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  base: { app: 'gigs', env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'local' },
  redact: {
    paths: [
      'password', '*.password',
      'token', '*.token',
      'secret', '*.secret',
      'authorization', 'req.headers.authorization',
      'cookie', 'req.headers.cookie',
      'GIGS_TOKEN_SECRET', 'AUTH_SECRET', 'INBOUND_SECRET', 'STRIPE_SECRET_KEY',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

export const log: Logger = isDev
  ? pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,app,env',
          singleLine: false,
        },
      },
    })
  : pino(baseConfig);

export type GigsLogger = typeof log;

export function child(bindings: Record<string, unknown>): Logger {
  return log.child(bindings);
}
