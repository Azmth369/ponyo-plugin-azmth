# Ponyo MCP Plugin Server

A separate, read-only MCP adapter for the existing Ponyo Clash of Clans API. It does not access Supabase directly and does not modify the original API service.

## Existing deployment

- Render service: `ponyo-plugin/azmth`
- Service URL: `https://ponyo-plugin-azmth-tb6o.onrender.com`
- MCP endpoint: `https://ponyo-plugin-azmth-tb6o.onrender.com/mcp`
- Existing Ponyo API base URL: `https://ponyo-azmth.onrender.com`

The Render service is already connected to this repository with root directory `plugin-server/`, Node runtime, and `npm start`. Do not create a duplicate service.

## Environment variables

Configure these only in the existing Render service environment:

- `PONYO_API_BASE_URL=https://ponyo-azmth.onrender.com`
- `PONYO_API_KEY`: the API key already configured on the existing Ponyo API service. Keep it server-side.
- `MCP_BEARER_TOKEN`: a separate, randomly generated secret used by ChatGPT clients to authenticate to this MCP endpoint. Use at least 32 characters. Do not reuse the backend API key.
- `PORT`: supplied automatically by Render.

This adapter does not need Supabase credentials, the Clash of Clans API token, or the Discord bot token.

## Authentication

Every request to `/mcp` must include:

```http
Authorization: Bearer <MCP_BEARER_TOKEN>
```

The backend `PONYO_API_KEY` is sent only from this server to the Ponyo API. Never place either secret in GitHub, chat messages, client-side code, or screenshots.

`GET /health` returns HTTP 200 only when the API base URL, backend API key, and MCP bearer token are configured. It does not reveal secret values.

## Read-only MCP tools

The server exposes these 11 tools:

- `get_clan_members`
- `get_clan_summary`
- `get_current_war`
- `get_clan_activity`
- `get_capital_contribution`
- `get_capital_contribution_activity`
- `get_war_history`
- `get_cwl_history`
- `get_capital_raid_history`
- `get_latest_capital_raid`
- `get_sync_status`

Tool names are snake_case as exposed by MCP. These tools perform GET requests to the existing Ponyo API; no refresh, write, or administrative actions are exposed.

## Local development

Use Node.js 22 or newer. From `plugin-server/` run `npm install` and `npm start` after configuring the required environment variables. Never use production secrets in a committed `.env` file.
