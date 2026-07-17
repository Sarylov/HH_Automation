type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export function createLogger(scope: string) {
  const write = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
    const entry = {
      ts: new Date().toISOString(),
      level,
      scope,
      message,
      ...context,
    };
    const line = JSON.stringify(entry, (_key, value) =>
      value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value,
    );
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
    error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
    debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  };
}
