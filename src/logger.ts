interface LogData {
  [key: string]: unknown;
}

interface Logger {
  debug(event: string, data?: LogData): void;
  warn(event: string, data?: LogData): void;
  error(event: string, data?: LogData): void;
}

function isEnabled(): boolean {
  return process.env.VIBECHECK_DEBUG === "1";
}

function emit(level: string, component: string, event: string, data?: LogData): void {
  if (!isEnabled()) return;
  const line = JSON.stringify({ level, component, event, ...data });
  process.stderr.write(line + "\n");
}

export function createLogger(component: string): Logger {
  return {
    debug: (event, data) => emit("debug", component, event, data),
    warn: (event, data) => emit("warn", component, event, data),
    error: (event, data) => emit("error", component, event, data),
  };
}
