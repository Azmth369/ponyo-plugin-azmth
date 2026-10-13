import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const PORT = Number(process.env.PORT || 8787);
const API_BASE = (process.env.PONYO_API_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.PONYO_API_KEY || '';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => res.json({ ok: true, service: 'ponyo-mcp-plugin', mcp: '/mcp' }));
app.get('/health', (_req, res) => {
  const configured = Boolean(API_BASE && API_KEY.length >= 32);
  res.status(configured ? 200 : 503).json({ ok: configured, service: 'ponyo-mcp-plugin' });
});

async function ponyoGet(path, params = {}) {
  if (!API_BASE || API_KEY.length < 32) throw new Error('Ponyo API connection is not configured on the server.');
  const url = new URL(path, API_BASE + '/');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: 'Ponyo API returned invalid JSON.' }; }
  if (!response.ok) {
    const message = response.status === 401 ? 'The plugin service could not authenticate to the Ponyo API. Check its Render environment variable.' :
      (body.error || `Ponyo API request failed (${response.status}).`);
    throw new Error(message);
  }
  return body;
}

const tools = [
  { name: 'get_clan_members', description: 'Fetch the latest live roster of members in the configured Ponyo clan. Supports optional name search and result limit.', inputSchema: { type: 'object', properties: { search: { type: 'string', description: 'Optional substring of player name to search for.' }, limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum members to return; defaults to 100.' } }, additionalProperties: false } },
  { name: 'get_clan_summary', description: 'Get the current configured clan overview and summary metrics from Ponyo.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_current_war', description: 'Get latest current clan war status from the live Clash of Clans API via Ponyo.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_clan_activity', description: 'Get observed member activity changes within a window. Results depend on stored snapshot coverage.', inputSchema: { type: 'object', properties: { hours: { type: 'integer', minimum: 1, maximum: 168, description: 'Lookback hours; defaults to 24.' } }, additionalProperties: false } },
  { name: 'get_capital_contribution', description: 'Get a player lifetime Clan Capital contribution total. This is not raid-weekend loot.', inputSchema: { type: 'object', properties: { player: { type: 'string', minLength: 1, maxLength: 80, description: 'Player name or tag.' } }, required: ['player'], additionalProperties: false } },
  { name: 'get_capital_contribution_activity', description: 'Compare stored lifetime contribution snapshots around the latest stored raid end. Coverage may be incomplete; this is not raid-weekend loot.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_war_history', description: 'Get stored regular Clan War history, excluding CWL rounds.', inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum wars; defaults to 10.' } }, additionalProperties: false } },
  { name: 'get_cwl_history', description: 'Get stored Clan War League history from Ponyo.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_capital_raid_history', description: 'Get stored Clan Capital raid history from Ponyo.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_latest_capital_raid', description: 'Get latest stored Clan Capital Raid Weekend information from Ponyo.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_sync_status', description: 'Check Ponyo data-sync health and latest sync status.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }
];

const routeByTool = {
  get_clan_members: a => ponyoGet('/api/v1/clan/members', { search: a.search, limit: a.limit }),
  get_clan_summary: () => ponyoGet('/api/v1/clan/summary'),
  get_current_war: () => ponyoGet('/api/v1/war/current'),
  get_clan_activity: a => ponyoGet('/api/v1/clan/activity', { hours: a.hours }),
  get_capital_contribution: a => ponyoGet('/api/v1/clan/player-capital-contribution', { player: a.player }),
  get_capital_contribution_activity: () => ponyoGet('/api/v1/clan/capital-contribution-activity'),
  get_war_history: a => ponyoGet('/api/v1/war/history', { limit: a.limit }),
  get_cwl_history: () => ponyoGet('/api/v1/cwl/history'),
  get_capital_raid_history: () => ponyoGet('/api/v1/capital-raids/history'),
  get_latest_capital_raid: () => ponyoGet('/api/v1/capital-raids/latest'),
  get_sync_status: () => ponyoGet('/api/v1/sync/status')
};

function createMcpServer() {
  const server = new Server({ name: 'ponyo-clash-of-clans', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const handler = routeByTool[request.params.name];
    if (!handler) return { content: [{ type: 'text', text: 'Unknown tool.' }], isError: true };
    try {
      const result = await handler(request.params.arguments || {});
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: error?.message || 'Ponyo API request failed.' }], isError: true };
    }
  });
  return server;
}

app.post('/mcp', async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[mcp] request failed:', error?.message || 'unknown error');
    if (!res.headersSent) res.status(500).json({ error: 'MCP request failed.' });
  }
});
app.get('/mcp', (_req, res) => res.status(405).json({ error: 'Use this endpoint as MCP server URL; MCP requests use POST.' }));
app.delete('/mcp', (_req, res) => res.status(405).json({ error: 'Stateless MCP endpoint does not use sessions.' }));

app.listen(PORT, '0.0.0.0', () => console.log(`[ponyo-mcp] listening on port ${PORT}`));
