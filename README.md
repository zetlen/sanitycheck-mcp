# sanitycheck-mcp

An MCP server that gives AI coding agents awareness of internet and service health. When your deploys fail, APIs timeout, or your AI assistant starts acting weird, these tools help figure out if it's you or if something is actually down.

## Tools

### `is_the_internet_on_fire`

Check the health of major internet infrastructure at a glance. Fetches status from 18 tracked services across cloud, CDN, devtools, AI, communications, and infrastructure categories.

```
Optional: category = "cloud" | "cdn" | "devtools" | "ai" | "comms" | "infra"
```

### `whats_going_on_with`

Investigate a specific service in detail. Pulls official status, component health, active incidents, plus third-party reports from Downdetector and StatusGator.

```
Required: service = "github" | "aws" | "vercel" | "npm" | ...
```

Supports aliases like `s3` → `aws`, `gh` → `github`, `claude` → `anthropic`.

### `how_am_i_feeling`

Lets an AI model check its own provider's health and community-reported quality. Auto-detects which model is asking based on MCP client info, or accepts an explicit `model` parameter.

```
Optional: model = "claude" | "gpt" | "gemini"
```

## Tracked Services

| Category | Services |
|----------|----------|
| Cloud | AWS, GCP, Azure |
| CDN | Cloudflare, Fastly, Akamai |
| DevTools | GitHub, GitLab, Vercel, Netlify |
| AI | OpenAI, Anthropic, Google AI |
| Comms | Slack, Discord |
| Infra | Datadog, PagerDuty, npm |

## Data Sources

- **Official status pages** — Atlassian Statuspage API, custom scrapers for AWS, Azure, Akamai, GCP, GitLab, Slack, PagerDuty
- **Downdetector** — crowd-sourced outage reports
- **StatusGator** — aggregated status monitoring
- **AI community sites** — AI Daily Check, LM Arena, IsClaudeCodeDumb, AI Stupid Level (requires headless Chrome)

## Setup

Add to your MCP client config:

```json
{
  "mcpServers": {
    "sanitycheck": {
      "command": "npx",
      "args": ["-y", "sanitycheck-mcp"]
    }
  }
}
```

Or with Claude Code:

```bash
claude mcp add sanitycheck -- npx -y sanitycheck-mcp
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SANITYCHECK_DEBUG=1` | Enable debug logging to stderr |
| `SANITYCHECK_CHROME_PATH` | Path to Chrome binary for headless browser features |

## Development

```bash
npm run dev          # watch mode
npm test             # run tests
npm run test:watch   # watch mode
```

## License

ISC
