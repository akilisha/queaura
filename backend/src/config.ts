import { z } from 'zod';

// Everything that changes per deployment comes from the environment, checked once at start.
// Prices and allowances are configuration, never an app update (spec §8).

/** PEM text entered on one line, with its line breaks written as \n, becomes PEM again. */
const pem = z.string().optional().transform((v) => v?.replace(/\\n/g, '\n'));

const PROVIDERS = ['anthropic', 'openai', 'deepseek', 'moonshot'] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export interface Fallback {
  provider: ProviderName;
  model: string;
  /** List prices in US dollars per million tokens, for the cost records. */
  input: number;
  output: number;
}

/**
 * "openai:gpt-6.1-sol:2:10,deepseek:deepseek-flash:0.3:1.2": providers to try in order when the
 * main one fails (spec §8), each as provider:model:input price:output price.
 */
const fallbacks = z
  .string()
  .optional()
  .transform((value, ctx): Fallback[] => {
    const entries = (value ?? '').split(',').map((e) => e.trim()).filter(Boolean);
    const parsed: Fallback[] = [];
    for (const entry of entries) {
      const [provider, model, input, output, ...rest] = entry.split(':');
      const ok = PROVIDERS.includes(provider as ProviderName) && model && rest.length === 0 && Number.isFinite(Number(input)) && Number.isFinite(Number(output)) && input !== '' && output !== '';
      if (!ok) {
        ctx.addIssue({ code: 'custom', message: `"${entry}" should be provider:model:input price:output price, with provider one of ${PROVIDERS.join(', ')}` });
        return z.NEVER;
      }
      parsed.push({ provider: provider as ProviderName, model, input: Number(input), output: Number(output) });
    }
    return parsed;
  });

/**
 * "ai_games_1:1,ai_games_5:5,ai_games_10:10": each Google Play product id and the AI games it
 * gives (spec §8). Prices live in the Play Console.
 */
const packs = z
  .string()
  .default('ai_games_1:1,ai_games_5:5,ai_games_10:10')
  .transform((value, ctx): Map<string, number> => {
    const map = new Map<string, number>();
    for (const entry of value.split(',').map((e) => e.trim()).filter(Boolean)) {
      const [product, games, ...rest] = entry.split(':');
      const n = Number(games);
      if (!product || rest.length || !Number.isInteger(n) || n < 1) {
        ctx.addIssue({ code: 'custom', message: `"${entry}" should be product id:AI games` });
        return z.NEVER;
      }
      map.set(product, n);
    }
    return map;
  });

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url(),
  /** The database's certificate authority (PEM); set it for managed databases that require TLS. */
  DATABASE_CA_CERT: pem,
  /** This environment's schema (dev and prod share one database), e.g. queaura_dev. */
  DATABASE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/, 'lowercase letters, digits and underscores').default('public'),
  /** AI games a new account starts with (spec §8: starting value 1 to 2). */
  FREE_AI_GAMES: z.coerce.number().int().min(0).default(2),
  /** Generated questions in one AI game, regenerations included (spec §8: starting value 50). */
  QUESTIONS_PER_AI_GAME: z.coerce.number().int().min(1).default(50),

  /** Which provider and model write questions (spec §8): configuration, never an app change. */
  AI_PROVIDER: z.enum(PROVIDERS).default('anthropic'),
  AI_MODEL: z.string().min(1).default('claude-haiku-5-5'),
  /** Claude only: how hard the model thinks. Higher is slower and costs more. */
  AI_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  MOONSHOT_API_KEY: z.string().optional(),
  /** Sign-in (Clerk): the JWT public key (PEM, checks without a network call) and/or the secret key. */
  CLERK_JWT_KEY: pem,
  CLERK_SECRET_KEY: z.string().optional(),
  /** Generation requests one host may make, as a guard against runaway use; failures count too. */
  /** Filling a whole game makes one request per round (up to 10), close together. */
  GENERATE_PER_MINUTE: z.coerce.number().int().min(1).default(12),
  GENERATE_PER_DAY: z.coerce.number().int().min(1).default(100),
  /** Google Play (spec §8): the app's package, its packs, and a service account to confirm purchases. */
  GOOGLE_PLAY_PACKAGE: z.string().default('com.queaura.host'),
  PACKS: packs,
  /** The service account's JSON key; without it purchases can't be confirmed (and are refused). */
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  /** Purchase notifications (Pub/Sub push): our endpoint's URL as the token audience, and the pushing service account. */
  RTDN_AUDIENCE: z.string().optional(),
  RTDN_SERVICE_ACCOUNT: z.string().optional(),
  /** The website, where the venue form sends people back to. */
  SITE_URL: z.string().url().default('https://queaura.com'),
  /** Protects /admin routes (granting AI games); long and random. Without it they don't exist. */
  ADMIN_TOKEN: z.string().min(32, 'at least 32 characters').optional(),
  /** The active model's list prices in US dollars per million tokens, for the cost records. */
  AI_PRICE_INPUT: z.coerce.number().min(0).default(0.1),
  AI_PRICE_OUTPUT: z.coerce.number().min(0).default(0.5),
  AI_FALLBACKS: fallbacks,
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuration is incomplete: ${problems}`);
  }
  return result.data;
}
