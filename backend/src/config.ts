import { z } from 'zod';

// Everything that changes per deployment comes from the environment, checked once at start.
// Prices and allowances are configuration, never an app update (spec §8).

/** PEM text entered on one line, with its line breaks written as \n, becomes PEM again. */
const pem = z.string().optional().transform((v) => v?.replace(/\\n/g, '\n'));

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url(),
  /** The database's certificate authority (PEM); set it for managed databases that require TLS. */
  DATABASE_CA_CERT: pem,
  /** AI games a new account starts with (spec §8: starting value 1 to 2). */
  FREE_AI_GAMES: z.coerce.number().int().min(0).default(2),
  /** Generated questions in one AI game, regenerations included (spec §8: starting value 50). */
  QUESTIONS_PER_AI_GAME: z.coerce.number().int().min(1).default(50),

  /** Which provider and model write questions (spec §8): configuration, never an app change. */
  AI_PROVIDER: z.enum(['anthropic', 'openai', 'deepseek', 'moonshot']).default('anthropic'),
  AI_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
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
  GENERATE_PER_MINUTE: z.coerce.number().int().min(1).default(6),
  GENERATE_PER_DAY: z.coerce.number().int().min(1).default(100),
  /** The active model's list prices in US dollars per million tokens, for the cost records. */
  AI_PRICE_INPUT: z.coerce.number().min(0).default(2),
  AI_PRICE_OUTPUT: z.coerce.number().min(0).default(10),
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
