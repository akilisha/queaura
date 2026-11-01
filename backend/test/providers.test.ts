import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { anthropicProvider, compatibleProvider, ProviderError } from '../src/generation/providers.ts';

// Each adapter is pointed at a local fake of its provider's API, to check the request we send
// and how we read the reply, without a key or network.

interface Seen {
  path: string;
  headers: IncomingMessage['headers'];
  body: any;
}
let server: Server | undefined;
afterEach(() => server?.close());

async function fake(reply: object): Promise<{ url: string; seen: Seen[] }> {
  const seen: Seen[] = [];
  server = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      seen.push({ path: req.url!, headers: req.headers, body: JSON.parse(data) });
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reply));
    });
  });
  await new Promise<void>((r) => server!.listen(0, r));
  return { url: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`, seen };
}

const anthropicReply = (patch: object = {}) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-5-5',
  content: [{ type: 'text', text: '{"declined":null,"questions":[]}' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 1200, output_tokens: 3400 },
  ...patch,
});

describe('Claude adapter', () => {
  it('asks for JSON in our schema, with the refusal fallback opted in, and reads tokens', async () => {
    const { url, seen } = await fake(anthropicReply());
    const result = await anthropicProvider('key', 'claude-sonnet-5-5', 'medium', url).complete('system', 'user');
    expect(result).toEqual({ text: '{"declined":null,"questions":[]}', inputTokens: 1200, outputTokens: 3400, model: 'claude-sonnet-5-5' });
    const [req] = seen;
    expect(req.path).toBe('/v1/messages');
    expect(req.headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
    expect(req.body).toMatchObject({ model: 'claude-sonnet-5-5', system: 'system', fallbacks: 'default', output_config: { effort: 'medium', format: { type: 'json_schema' } } });
  });
  it('leaves the fallback out for models without one', async () => {
    const { url, seen } = await fake(anthropicReply({ model: 'claude-haiku-5-5' }));
    await anthropicProvider('key', 'claude-haiku-5-5', 'low', url).complete('s', 'u');
    expect(seen[0].body.fallbacks).toBeUndefined();
    expect(seen[0].headers['anthropic-beta']).toBeUndefined();
  });
  it('reports a refusal and a cut-off reply', async () => {
    const refused = await fake(anthropicReply({ stop_reason: 'refusal', content: [], stop_details: { type: 'refusal', category: 'general_harms' } }));
    await expect(anthropicProvider('key', 'claude-sonnet-5-5', 'medium', refused.url).complete('s', 'u')).rejects.toMatchObject({ kind: 'refused' });
    server!.close();
    const cut = await fake(anthropicReply({ stop_reason: 'max_tokens' }));
    await expect(anthropicProvider('key', 'claude-sonnet-5-5', 'medium', cut.url).complete('s', 'u')).rejects.toBeInstanceOf(ProviderError);
  });
});

describe('OpenAI-compatible adapter', () => {
  const reply = (patch: object = {}) => ({
    id: 'c1',
    object: 'chat.completion',
    created: 0,
    model: 'deepseek-chat',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{"declined":null,"questions":[]}', refusal: null }, ...patch }],
    usage: { prompt_tokens: 900, completion_tokens: 2100, total_tokens: 3000 },
  });
  it('sends system and user messages in JSON mode, with the token limit each provider expects', async () => {
    const { url, seen } = await fake(reply());
    const result = await compatibleProvider('deepseek', 'key', 'deepseek-chat', url).complete('system', 'user');
    expect(result).toEqual({ text: '{"declined":null,"questions":[]}', inputTokens: 900, outputTokens: 2100, model: 'deepseek-chat' });
    expect(seen[0].path).toBe('/chat/completions');
    expect(seen[0].body).toMatchObject({ model: 'deepseek-chat', max_tokens: 16000, response_format: { type: 'json_object' }, messages: [{ role: 'system' }, { role: 'user' }] });
    server!.close();
    const openai = await fake(reply());
    await compatibleProvider('openai', 'key', 'gpt-x', openai.url).complete('s', 'u');
    expect(openai.seen[0].body.max_completion_tokens).toBe(16000);
    expect(openai.seen[0].body.max_tokens).toBeUndefined();
  });
  it('reports a content-filter stop as a refusal', async () => {
    const { url } = await fake(reply({ finish_reason: 'content_filter' }));
    await expect(compatibleProvider('moonshot', 'key', 'kimi', url).complete('s', 'u')).rejects.toMatchObject({ kind: 'refused' });
  });
});
