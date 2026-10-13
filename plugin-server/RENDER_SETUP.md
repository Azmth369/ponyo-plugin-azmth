# Render setup checklist

1. In Render, create a **new Web Service** and connect repository `Azmth369/ponyo-plugin-azmth`.
2. Set the **Root Directory** to `plugin-server`.
3. Use Node runtime and start command `npm start`. Node version must be 22 or newer.
4. Add environment variables:
   - `PONYO_API_BASE_URL` = `https://ponyo-v845.onrender.com`
   - `PONYO_API_KEY` = the same secret value already used by the existing Ponyo API service.
5. Do not add the Clash of Clans token or Supabase service-role key to this plugin adapter. They are not required.
6. Deploy and open `https://<new-service-host>/health`. It should return HTTP 200 and `{"ok":true,"service":"ponyo-mcp-plugin"}`.
7. In ChatGPT on the web, go to Plugins → + → Add custom MCP server. Use `https://<new-service-host>/mcp`, configure authentication as None only for this initial read-only setup because the endpoint itself delegates authenticated calls to the existing API. Do not publish or share the endpoint until testing is complete.
8. Test tool listing and call `get_current_war`, then `get_clan_members`.

Security reminder: The MCP endpoint is intended for read-only queries only, but anyone who can call it can read the configured clan data. Before sharing with others, add per-user access controls or MCP authentication and review whether public read access is acceptable.
