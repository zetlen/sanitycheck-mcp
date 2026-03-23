// src/registry.ts
import type { ServiceCategory } from "./types.js";

export interface ServiceEntry {
  name: string;
  slug: string;           // lowercase id, e.g. "github"
  category: ServiceCategory;
  statusUrl: string;      // official status page URL
  statuspageId?: string;  // for Atlassian Statuspage-based services
  downdetectorSlug?: string; // for Downdetector URL construction
}

// Atlassian Statuspage-based services share a common API format:
// GET https://<domain>/api/v2/summary.json
export const SERVICES: ServiceEntry[] = [
  // Cloud
  { name: "AWS", slug: "aws", category: "cloud", statusUrl: "https://health.aws.amazon.com/health/status", downdetectorSlug: "aws-amazon-web-services" },
  { name: "GCP", slug: "gcp", category: "cloud", statusUrl: "https://status.cloud.google.com/", downdetectorSlug: "google-cloud" },
  { name: "Azure", slug: "azure", category: "cloud", statusUrl: "https://status.azure.com/en-us/status", downdetectorSlug: "windows-azure" },

  // CDN
  { name: "Cloudflare", slug: "cloudflare", category: "cdn", statusUrl: "https://www.cloudflarestatus.com", statuspageId: "yh6f0r4529hb", downdetectorSlug: "cloudflare" },
  { name: "Fastly", slug: "fastly", category: "cdn", statusUrl: "https://status.fastly.com", statuspageId: "889929qfzmz6", downdetectorSlug: "fastly" },
  { name: "Akamai", slug: "akamai", category: "cdn", statusUrl: "https://www.akamaistatus.com", downdetectorSlug: "akamai" },

  // Dev Tools
  { name: "GitHub", slug: "github", category: "devtools", statusUrl: "https://www.githubstatus.com", statuspageId: "kctbh9vbitze", downdetectorSlug: "github" },
  { name: "GitLab", slug: "gitlab", category: "devtools", statusUrl: "https://status.gitlab.com", statuspageId: "5b36dc6502d06804c08349f7", downdetectorSlug: "gitlab" },
  { name: "Vercel", slug: "vercel", category: "devtools", statusUrl: "https://www.vercel-status.com", statuspageId: "2s0kfq7n6gkl", downdetectorSlug: "vercel" },
  { name: "Netlify", slug: "netlify", category: "devtools", statusUrl: "https://www.netlifystatus.com", statuspageId: "hyyhlpkm1l3q", downdetectorSlug: "netlify" },

  // AI
  { name: "OpenAI", slug: "openai", category: "ai", statusUrl: "https://status.openai.com", statuspageId: "t56hlsb30k1c", downdetectorSlug: "openai" },
  { name: "Anthropic", slug: "anthropic", category: "ai", statusUrl: "https://status.anthropic.com", statuspageId: "2fxwrmymcl5j", downdetectorSlug: "anthropic" },
  { name: "Google AI", slug: "google-ai", category: "ai", statusUrl: "https://status.cloud.google.com/", downdetectorSlug: "google-cloud" },

  // Comms
  { name: "Slack", slug: "slack", category: "comms", statusUrl: "https://slack-status.com", downdetectorSlug: "slack" },
  { name: "Discord", slug: "discord", category: "comms", statusUrl: "https://discordstatus.com", statuspageId: "srhpyqt94yxb", downdetectorSlug: "discord" },

  // Infra
  { name: "Datadog", slug: "datadog", category: "infra", statusUrl: "https://status.datadoghq.com", statuspageId: "1k6wydy513d6", downdetectorSlug: "datadog" },
  { name: "PagerDuty", slug: "pagerduty", category: "infra", statusUrl: "https://status.pagerduty.com", downdetectorSlug: "pagerduty" },
  { name: "npm", slug: "npm", category: "infra", statusUrl: "https://status.npmjs.org", statuspageId: "wby3g916dnvk", downdetectorSlug: "npm" },
];

export const SERVICE_ALIASES: Record<string, string> = {
  "s3": "aws",
  "ec2": "aws",
  "lambda": "aws",
  "rds": "aws",
  "actions": "github",
  "gh": "github",
  "gl": "gitlab",
  "cf": "cloudflare",
  "dd": "datadog",
  "pd": "pagerduty",
  "gpt": "openai",
  "chatgpt": "openai",
  "claude": "anthropic",
  "gemini": "google-ai",
  "bard": "google-ai",
};

export function resolveService(query: string): ServiceEntry[] {
  const q = query.toLowerCase().trim();

  // Check aliases first
  if (SERVICE_ALIASES[q]) {
    const slug = SERVICE_ALIASES[q];
    const match = SERVICES.filter((s) => s.slug === slug);
    if (match.length > 0) return match;
  }

  // Exact slug match
  const exact = SERVICES.filter((s) => s.slug === q);
  if (exact.length > 0) return exact;

  // Substring match on name or slug
  const substring = SERVICES.filter(
    (s) => s.name.toLowerCase().includes(q) || s.slug.includes(q)
  );
  return substring;
}

export function getServicesByCategory(category: ServiceCategory): ServiceEntry[] {
  return SERVICES.filter((s) => s.category === category);
}

export function getAllServices(): ServiceEntry[] {
  return [...SERVICES];
}
