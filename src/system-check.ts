// src/system-check.ts
import { cpus, loadavg, totalmem, freemem, platform } from "node:os";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
    availableMB: number;
    usedPct: number; // real usage excluding reclaimable caches
  };
  network: {
    latencyMs: number | null; // round-trip to a reliable endpoint
    status: "ok" | "slow" | "failing";
  };
}

/**
 * Get available memory that accounts for reclaimable caches.
 * os.freemem() only reports truly free pages, which on macOS and Linux
 * is misleadingly low because the OS fills RAM with file caches that
 * can be reclaimed instantly.
 */
function getAvailableMemoryBytes(): number {
  const os = platform();

  if (os === "linux") {
    try {
      const meminfo = readFileSync("/proc/meminfo", "utf-8");
      const match = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
      if (match) return parseInt(match[1], 10) * 1024;
    } catch (err) {
      log.warn("meminfo-failed", { error: String(err) });
    }
  }

  if (os === "darwin") {
    try {
      const output = execFileSync("memory_pressure", {
        encoding: "utf-8",
        timeout: 3000,
      });
      const match = output.match(/System-wide memory free percentage:\s+(\d+)%/);
      if (match) {
        const freePct = parseInt(match[1], 10);
        return Math.round(totalmem() * (freePct / 100));
      }
    } catch (err) {
      log.warn("memory-pressure-failed", { error: String(err) });
    }
  }

  // Fallback: os.freemem() — inaccurate but better than nothing
  return freemem();
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

      const status = latencyMs > 500 ? "slow" : "ok";
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
  const availableBytes = getAvailableMemoryBytes();
  const totalMB = Math.round(totalBytes / 1024 / 1024);
  const availableMB = Math.round(availableBytes / 1024 / 1024);
  const usedPct = Math.round(((totalBytes - availableBytes) / totalBytes) * 100);
  const loadPct = Math.round((load1 / cores) * 100);

  const network = await measureNetworkLatency();

  const result: SystemCheck = {
    cpu: {
      cores,
      loadAvg1m: Math.round(load1 * 100) / 100,
      loadAvg5m: Math.round(load5 * 100) / 100,
      loadPct,
    },
    memory: { totalMB, availableMB, usedPct },
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
  lines.push(`  memory_available: ${sys.memory.availableMB}MB`);
  lines.push(`  memory_used: ${sys.memory.usedPct}%`);

  if (sys.memory.usedPct >= 90) {
    lines.push(
      `  memory_warning: memory almost exhausted at ${sys.memory.usedPct}% — expect swapping`,
    );
  } else if (sys.memory.usedPct >= 75) {
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
