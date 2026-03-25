# Voidbox

Temporary email service built on Cloudflare Workers in Rust, optimized for Cloudflare free tier limits.

## Features

- Receive emails via Cloudflare Email Routing
- Store emails in Cloudflare D1 database
- Configurable FIFO emails storage eviction policy
- Token authentication
- Agent-friendly API docs at `/llms.txt`

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+) for frontend build
- [Rust](https://rustup.rs/) with wasm target: `rustup target add wasm32-unknown-unknown`
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`
- GNU Make
- A Cloudflare account with a domain

## Quick Start

```bash
# 1. Login to Cloudflare
wrangler login

# 2. Clone example configuration, and edit it according to Configuration section
cp wrangler.example.toml wrangler.toml

# 3. Create D1 database and Copy database_id and database_name from the output into wrangler.toml
wrangler d1 create voidbox

# 4. Apply database schema
wrangler d1 migrations apply voidbox --remote

# 5. Set auth token, it's recommended to set a strong token
wrangler secret put AUTH_TOKEN

# 6. Optional: Configure custom domain in wrangler.toml
# By default, the Worker is accessible at <name>.workers.dev with preview URLs enabled.
# To route a custom domain, add to wrangler.toml:
#   workers_dev = false
#   preview_urls = false
#   routes = [{ pattern = "mail.example.com", custom_domain = true }]

# 7. Deploy (builds frontend + WASM automatically)
wrangler deploy

# 8. Set up Email Routing (see below)
```

## Development

```bash
# Build frontend + backend
make build

# Frontend dev server with HMR, proxy API to wrangler dev
make dev

# Deploy to Cloudflare
make deploy

# Clean build artifacts
make clean
```

## Email Routing Setup

After deploying, configure Cloudflare to forward emails to your Worker:

1. Cloudflare Dashboard > Email > Email Routing > Catch-all > Send to Worker > `voidbox`
2. Optional: To use a subdomain, go to Email Routing > Settings > Subdomains and add your subdomain
3. Optional: You can bind more than one domain catch-all rules to `voidbox`

### CLI Setup Tool

A CLI tool to manage Cloudflare Email Routing configuration without the Dashboard:

```bash
cd setup
npm install
npm run email-setup
```

Or with API token as env var:

```bash
cd setup
CF_API_TOKEN=xxx npm run email-setup
```

The tool supports:
- Enable/disable zone email routing
- Add/remove subdomain email routing, wildcard supported
- Configure catch-all → Worker
- Scan email routing domains across all zones

Required API Token permissions:
- Email Routing Rules: Edit
- Zone Settings: Edit
- Zone: Read
- DNS: Edit

## Configuration

| Variable | Default | Example | Description |
|----------|---------|---------|-------------|
| `AUTH_TOKEN` | - | `a1b2c3d4e5f6` | Bearer token for API and internal auth |
| `MAIL_DOMAINS` | - | `mail.example.com,example.org` | Comma-separated allowed email domains |
| `MAX_INBOXES` | `50` | `200` | Max concurrent inboxes, oldest evicted first |
| `MAX_MAILS_PER_INBOX` | `100` | `50` | Max emails per inbox, oldest trimmed |
| `MAX_MAIL_SIZE` | `262144` | `524288` | Max single email size in bytes, oversized emails rejected |

## Free Tier Limits

This project is designed to run entirely within Cloudflare's free tier. Each inbox lifecycle (register -> receive 1 email -> read) consumes:

| Resource | Per Inbox | Free Daily Limit | Max Inboxes/Day |
|----------|-----------|-------------------|-----------------|
| [Workers Requests](https://developers.cloudflare.com/workers/platform/pricing/) | ~7 | 100,000 | ~14,000 |
| [D1 Writes](https://developers.cloudflare.com/d1/platform/pricing/) | 4 | 100,000 | ~25,000 |
| [D1 Reads](https://developers.cloudflare.com/d1/platform/pricing/) | 5 | 5,000,000 | ~1,000,000 |
| [D1 Storage](https://developers.cloudflare.com/d1/platform/pricing/) | ~5 KB | 5 GB | ~1,000,000 cumulative |

## License

MIT
