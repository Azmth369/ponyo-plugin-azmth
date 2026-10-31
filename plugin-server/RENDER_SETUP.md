# Existing Render service setup and ChatGPT connection

This repository is already deployed as the Render service `ponyo-plugin/azmth`. Do not create another service.

## Existing service

- Render service URL: `https://ponyo-plugin-azmth-tb6o.onrender.com`
- MCP URL: `https://ponyo-plugin-azmth-tb6o.onrender.com/mcp`
- Root directory: `plugin-server/`
- Runtime: Node.js 22+
- Build command: `npm install`
- Start command: `npm start`

## Required Render environment variables

Set these in the existing service's Environment page:

1. `PONYO_API_BASE_URL` = `https://ponyo-azmth.onrender.com`
2. `PONYO_API_KEY` = the existing backend API key used by the main Ponyo API. Do not copy it into GitHub or ChatGPT.
3. `MCP_BEARER_TOKEN` = a separate random secret of at least 32 characters. This is the credential ChatGPT uses to call the MCP server. Do not reuse `PONYO_API_KEY`.

Render supplies `PORT` automatically. Do not add the Clash of Clans API token, Supabase service-role key, or Discord token to this adapter.

## Health check

Open `https://ponyo-plugin-azmth-tb6o.onrender.com/health`. A correctly configured service should return HTTP 200:

```json
{"ok":true,"service":"ponyo-mcp-plugin"}
```

HTTP 503 means one or more required server-side settings are missing or too short. The endpoint intentionally does not identify which secret is missing.

## Connect ChatGPT

In the ChatGPT client that supports custom MCP servers:

1. Add a custom remote MCP server.
2. Server URL: `https://ponyo-plugin-azmth-tb6o.onrender.com/mcp`
3. Authentication type: Bearer.
4. Supply the value of `MCP_BEARER_TOKEN` in the client's secure authentication field. Never paste it into a normal chat or save it in a public schema.
5. Save and test tool discovery.

The exact menu labels may vary by ChatGPT client and account availability.

## Verify the integration

- A request without a bearer token should receive HTTP 401.
- A request with an incorrect token should receive HTTP 401.
- A valid authenticated MCP connection should discover the 11 read-only tools listed in the README.
- Test `get_current_war`, then `get_clan_members` with `limit=100`.
- Test a player-specific capital contribution lookup and the stored war/CWL/raid history tools.
- Confirm that all responses come through the existing Ponyo API.

The MCP adapter does not write to Supabase, trigger sync jobs, or change Discord/dashboard behavior.
