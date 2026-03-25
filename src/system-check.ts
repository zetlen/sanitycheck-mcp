// src/system-check.ts
import { cpus, loadavg, totalmem, freemem } from "node:os";
import { createLogger } from "./logger.js";

const log = createLogger("system-check");

export interface SystemCheck {
  cpu: {
    cores: number;
    loadAvg1m: number;
    loadAvg5m: number;
    loadPct: number; // load avg 1m as % of cores
  };
  memory: {
    totalMB: number;
    freeMB: number;
    usedPct: number;
  };
  network: {
    latencyMs: number | null; // round-trip to a reliable endpoint
    status: "ok" | "slow" | "failing";
  };
}

async function measureNetworkLatency(): Promise<{
  latencyMs: number | null;
  status: "ok" | "slow" | "failing";
}> {
  const endpoints = [
    "https://dns.google/resolve?name=example.com&type=A",
    "https://1.1.1.1/dns-query?name=example.com&type=A",
  ];

  for (const url of endpoints) {
    try {
      const start = performance.now();
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        headers: { Accept: "application/dns-json" },
      });
      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) continue;

      const status = latencyMs > 2000 ? "slow" : latencyMs > 500 ? "slow" : "ok";
      return { latencyMs, status };
    } catch (err) {
      log.warn("network-probe-failed", { url, error: String(err) });
    }
  }

  return { latencyMs: null, status: "failing" };
}

export async function checkSystem(): Promise<SystemCheck> {
  const cores = cpus().length;
  const [load1, load5] = loadavg();
  const totalBytes = totalmem();
  const freeBytes = freemem();
  const totalMB = Math.round(totalBytes / 1024 / 1024);
  const freeMB = Math.round(freeBytes / 1024 / 1024);
  const usedPct = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);
  const loadPct = Math.round((load1 / cores) * 100);

  const network = await measureNetworkLatency();

  const result: SystemCheck = {
    cpu: {
      cores,
      loadAvg1m: Math.round(load1 * 100) / 100,
      loadAvg5m: Math.round(load5 * 100) / 100,
      loadPct,
    },
    memory: { totalMB, freeMB, usedPct },
    network,
  };

  log.debug("checked", {
    cpu: result.cpu.loadPct,
    mem: result.memory.usedPct,
    net: result.network.status,
  });
  return result;
}

export function formatSystemCheck(sys: SystemCheck): string {
  const lines: string[] = [];

  lines.push("local_system:");
  lines.push(`  cpu_cores: ${sys.cpu.cores}`);
  lines.push(`  cpu_load_1m: ${sys.cpu.loadAvg1m} (${sys.cpu.loadPct}% of capacity)`);
  lines.push(`  cpu_load_5m: ${sys.cpu.loadAvg5m}`);

  if (sys.cpu.loadPct >= 90) {
    lines.push(
      `  cpu_warning: CPU is pegged at ${sys.cpu.loadPct}% — local performance will be degraded`,
    );
  } else if (sys.cpu.loadPct >= 70) {
    lines.push(`  cpu_warning: CPU is under heavy load at ${sys.cpu.loadPct}%`);
  }

  lines.push(`  memory_total: ${sys.memory.totalMB}MB`);
  lines.push(`  memory_free: ${sys.memory.freeMB}MB`);
  lines.push(`  memory_used: ${sys.memory.usedPct}%`);

  if (sys.memory.usedPct >= 95) {
    lines.push(
      `  memory_warning: memory almost exhausted at ${sys.memory.usedPct}% — expect swapping`,
    );
  } else if (sys.memory.usedPct >= 85) {
    lines.push(`  memory_warning: memory pressure at ${sys.memory.usedPct}%`);
  }

  if (sys.network.status === "failing") {
    lines.push(`  network: failing — could not reach any probe endpoint`);
  } else {
    lines.push(`  network_latency: ${sys.network.latencyMs}ms`);
    if (sys.network.status === "slow") {
      lines.push(
        `  network_warning: network latency is high (${sys.network.latencyMs}ms) — API calls will be slow`,
      );
    }
  }

  return lines.join("\n");
}
