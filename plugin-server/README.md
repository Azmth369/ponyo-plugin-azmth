# Ponyo MCP Plugin Server

A separate, read-only MCP adapter for the existing Ponyo Clash of Clans API. It does not access Supabase directly and does not change the original API service.

## Environment variables

- `PONYO_API_BASE_URL`: base URL of the existing Ponyo API, e.g. `https://ponyo-v845.onrender.com`.
- `PONYO_API_KEY`: API key already configured on the existing API. Add it only to the new Render service's environment; never commit it.
- `PORT`: supplied automatically by Render.

## Deploy separately

Create a new Render Web Service from this repository, with root directory `plugin-server`, runtime Node, and start command `npm start`. Set the two required environment variables in Render. This adapter does not need Supabase credentials or the Clash of Clans API token.

## MCP endpoint

The server exposes Streamable HTTP MCP at `/mcp`. Use the HTTPS service URL plus `/mcp` when adding a custom MCP server in ChatGPT.

## Security

This server exposes read-only clan data tools only. It keeps the backend API key server-side. Do not disable authentication or expose keys in chat, GitHub, or client configuration.
