import type { Config, ProviderName } from '../config.ts';
import { anthropicProvider, compatibleProvider, type Provider } from './providers.ts';

/** One provider in the chain, with its prices for the cost records. */
export interface Link {
  provider: Provider;
  price: { input: number; output: number };
}

/**
 * The providers to try, in order: the main one (AI_PROVIDER, AI_MODEL), then AI_FALLBACKS
 * (spec §8). Any without a key is left out and named in [skipped], so start-up can say so.
 * With fallbacks, providers don't retry on their own: the next provider is the retry.
 */
export function chainFrom(config: Config): { chain: Link[]; skipped: string[] } {
  const wanted = [
    { provider: config.AI_PROVIDER, model: config.AI_MODEL, input: config.AI_PRICE_INPUT, output: config.AI_PRICE_OUTPUT },
    ...config.AI_FALLBACKS,
  ];
  const retries = wanted.length > 1 ? 0 : 1;
  const chain: Link[] = [];
  const skipped: string[] = [];
  for (const w of wanted) {
    const provider = make(config, w.provider, w.model, retries);
    if (provider) chain.push({ provider, price: { input: w.input, output: w.output } });
    else skipped.push(`${w.provider}:${w.model}`);
  }
  return { chain, skipped };
}

function make(config: Config, name: ProviderName, model: string, retries: number): Provider | null {
  switch (name) {
    case 'anthropic':
      return config.ANTHROPIC_API_KEY ? anthropicProvider(config.ANTHROPIC_API_KEY, model, config.AI_EFFORT, undefined, retries) : null;
    case 'openai':
      return config.OPENAI_API_KEY ? compatibleProvider('openai', config.OPENAI_API_KEY, model, undefined, retries) : null;
    case 'deepseek':
      return config.DEEPSEEK_API_KEY ? compatibleProvider('deepseek', config.DEEPSEEK_API_KEY, model, undefined, retries) : null;
    case 'moonshot':
      return config.MOONSHOT_API_KEY ? compatibleProvider('moonshot', config.MOONSHOT_API_KEY, model, undefined, retries) : null;
  }
}

/** Cost in millionths of a dollar, from token counts and a provider's prices. */
export function costMicroUsd(price: Link['price'], inputTokens: number, outputTokens: number): number {
  return Math.round(inputTokens * price.input + outputTokens * price.output);
}
