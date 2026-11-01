import type { Config } from '../config.ts';
import { anthropicProvider, compatibleProvider, type Provider } from './providers.ts';

/** The configured provider, or null if its key is missing (generation then says it is unavailable). */
export function providerFrom(config: Config): Provider | null {
  switch (config.AI_PROVIDER) {
    case 'anthropic':
      return config.ANTHROPIC_API_KEY ? anthropicProvider(config.ANTHROPIC_API_KEY, config.AI_MODEL, config.AI_EFFORT) : null;
    case 'openai':
      return config.OPENAI_API_KEY ? compatibleProvider('openai', config.OPENAI_API_KEY, config.AI_MODEL) : null;
    case 'deepseek':
      return config.DEEPSEEK_API_KEY ? compatibleProvider('deepseek', config.DEEPSEEK_API_KEY, config.AI_MODEL) : null;
    case 'moonshot':
      return config.MOONSHOT_API_KEY ? compatibleProvider('moonshot', config.MOONSHOT_API_KEY, config.AI_MODEL) : null;
  }
}

/** Cost in millionths of a dollar, from token counts and the configured prices. */
export function costMicroUsd(config: Config, inputTokens: number, outputTokens: number): number {
  return Math.round(inputTokens * config.AI_PRICE_INPUT + outputTokens * config.AI_PRICE_OUTPUT);
}
