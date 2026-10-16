import 'server-only';

type LogFields = {
  context: string;
  userId?: string;
  buildingId?: string;
  requestId?: string;
  [field: string]: unknown;
};

type Level = 'info' | 'warn' | 'error';

function write(level: Level, { context, ...fields }: LogFields) {
  const line = JSON.stringify({ level, at: new Date().toISOString(), context, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (fields: LogFields) => write('info', fields),
  warn: (fields: LogFields) => write('warn', fields),
  error: (fields: LogFields) => write('error', fields),
};
