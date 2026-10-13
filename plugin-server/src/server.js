import express from 'express';
import { randomUUID } from 'node:crypto';
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
  {
    name: 'get_clan_members',
    description: 'Fetch the latest live roster of members in the configured Ponyo clan. Supports optional name search and result limit.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional substring of player name to search for.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum number of members to return. Defaults to 100.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'get_clan_summary',
    description: 'Get the current configured clan overview and summary metrics from Ponyo.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_current_war',
    description: 'Get the latest current clan war status from the live Clash of Clans API via Ponyo.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_clan_activity',
    description: 'Get observed member activity changes within the requested number of hours. Data is limited by stored snapshot coverage.',
    inputSchema: {
      type: 'object',
      properties: { hours: { type: 'integer', minimum: 1, maximum: 168, description: 'Lookback window in hours; defaults to 24.' } },
      additionalProperties: false
    }
  },
  {
    name: 'get_capital_contribution',
    description: 'Get a player’s lifetime Clan Capital contribution total. This is not raid-weekend loot. Provide a player name or player tag.',
    inputSchema: {
      type: 'object',
      properties: { player: { type: 'string', minLength: 1, maxLength: 80, description: 'Player name or tag, such as #ABC123.' } },
      required: ['player'],
      additionalProperties: false
    }
  },
  {
    name: 'get_capital_contribution_activity',
    description: 'Compare stored lifetime Clan Capital contribution snapshots around the latest stored raid end. Coverage may be incomplete; increases are not raid-weekend loot.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_war_history',
    description: 'Get stored clan war history from Ponyo.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum history records; defaults to 10.' } },
      additionalProperties: false
    }
  },
  {
    name: 'get_cwl_status',
    description: 'Get current or most recent Clan War League season status from Ponyo.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_capital_raid_status',
    description: 'Get the latest Clan Capital raid status or stored raid summary from Ponyo.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  }
];

const routeByTool = {
  get_clan_members: args => ponyoGet('/api/v1/clan/members', { search: args.search, limit: args.limit }),
  get_clan_summary: () => ponyoGet('/api/v1/clan/summary'),
  get_current_war: () => ponyoGet('/api/v1/war/current'),
  get_clan_activity: args => ponyoGet('/api/v1/clan/activity', { hours: args.hours }),
  get_capital_contribution: args => ponyoGet('/api/v1/clan/player-capital-contribution', { player: args.player }),
  get_capital_contribution_activity: () => ponyoGet('/api/v1/clan/capital-contribution-activity'),
  get_war_history: args => ponyoGet('/api/v1/war/history', { limit: args.limit }),
  get_cwl_status: () => ponyoGet('/api/v1/cwl/current'),
  get_capital_raid_status: () => ponyoGet('/api/v1/capital/current')
};

function createMcpServer() {
  const server = new Server(
    { name: 'ponyo-clash-of-clans', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const name = request.params.name;
    const handler = routeByTool[name];
    if (!handler) return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    try {
      const result = await handler(request.params.arguments || {});
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: error?.message || 'Ponyo API request failed.' }], isError: true };
    }
  });
  return server;
}

// Stateless Streamable HTTP MCP: each POST is an independent request.
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

app.get('/mcp', (_req, res) => res.status(405).json({ error: 'MCP requires POST; use this URL as the server endpoint in ChatGPT.' }));
app.delete('/mcp', (_req, res) => res.status(405).json({ error: 'This stateless MCP endpoint does not use sessions.' }));

app.listen(PORT, '0.0.0.0', () => console.log(`[ponyo-mcp] listening on port ${PORT}`));
