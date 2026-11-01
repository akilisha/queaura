import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { modelOutputSchema } from './contract.ts';

// The provider abstraction (spec §8): two adapters cover the starting set. Claude speaks
// Anthropic's Messages API; ChatGPT, DeepSeek and Kimi speak the OpenAI-compatible format,
// configured by base URL, model and key. Switching provider or model is configuration only.

export interface Completion {
  /** The model's JSON reply, not yet trusted. */
  text: string;
  inputTokens: number;
  /** Includes any reasoning tokens; they are billed as output. */
  outputTokens: number;
  /** The model that actually answered (a fallback may differ from the one asked for). */
  model: string;
}

export interface Provider {
  name: string;
  model: string;
  complete(system: string, user: string): Promise<Completion>;
}

/** Why a provider call produced nothing usable; the host sees a plain message, never these details. */
export class ProviderError extends Error {
  readonly kind: 'refused' | 'unavailable' | 'truncated';
  constructor(kind: ProviderError['kind'], message: string) {
    super(message);
    this.kind = kind;
  }
}

const MAX_TOKENS = 16000;
const TIMEOUT_MS = 90_000;

/** Models that accept the server-side refusal fallback (Claude API, `fallbacks: "default"`). */
const FALLBACK_MODELS = /^claude-(fable-5|opus-5|sonnet-5-5)/;

/** [baseURL] is for tests, which point the adapter at a local fake. */
export function anthropicProvider(apiKey: string, model: string, effort: 'low' | 'medium' | 'high', baseURL?: string): Provider {
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1, ...(baseURL ? { baseURL } : {}) });
  return {
    name: 'anthropic',
    model,
    async complete(system, user) {
      let response;
      try {
        const fallback = FALLBACK_MODELS.test(model);
        response = await client.beta.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: user }],
          output_config: { effort, format: { type: 'json_schema', schema: modelOutputSchema as unknown as Record<string, unknown> } },
          ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        });
      } catch (e) {
        throw new ProviderError('unavailable', e instanceof Anthropic.APIError ? `Anthropic ${e.status}: ${e.message}` : String(e));
      }
      if (response.stop_reason === 'refusal') throw new ProviderError('refused', `refusal: ${response.stop_details?.category ?? 'unknown'}`);
      if (response.stop_reason === 'max_tokens') throw new ProviderError('truncated', 'reply cut off at max_tokens');
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: response.model };
    },
  };
}

/** Where each OpenAI-compatible provider lives. Adding one that speaks this format is a new line here. */
export const COMPATIBLE = {
  openai: { baseURL: 'https://api.openai.com/v1', tokenParam: 'max_completion_tokens' },
  deepseek: { baseURL: 'https://api.deepseek.com', tokenParam: 'max_tokens' },
  moonshot: { baseURL: 'https://api.moonshot.ai/v1', tokenParam: 'max_tokens' },
} as const;

export function compatibleProvider(name: keyof typeof COMPATIBLE, apiKey: string, model: string, baseURLOverride?: string): Provider {
  const { baseURL, tokenParam } = COMPATIBLE[name];
  const client = new OpenAI({ apiKey, baseURL: baseURLOverride ?? baseURL, timeout: TIMEOUT_MS, maxRetries: 1 });
  return {
    name,
    model,
    async complete(system, user) {
      let response;
      try {
        response = await client.chat.completions.create({
          model,
          [tokenParam]: MAX_TOKENS,
          // JSON mode is the format all three support; the shape is in the instructions and checked afterwards.
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        });
      } catch (e) {
        throw new ProviderError('unavailable', e instanceof OpenAI.APIError ? `${name} ${e.status}: ${e.message}` : String(e));
      }
      const choice = response.choices[0];
      if (!choice) throw new ProviderError('unavailable', `${name}: no reply`);
      if (choice.finish_reason === 'length') throw new ProviderError('truncated', 'reply cut off at the token limit');
      if (choice.finish_reason === 'content_filter' || choice.message.refusal) throw new ProviderError('refused', `${name}: refused`);
      return {
        text: choice.message.content ?? '',
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: response.model,
      };
    },
  };
}
