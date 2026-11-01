import { z } from 'zod';

// Everything that changes per deployment comes from the environment, checked once at start.
// Prices and allowances are configuration, never an app update (spec §8).

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url(),
  /** AI games a new account starts with (spec §8: starting value 1 to 2). */
  FREE_AI_GAMES: z.coerce.number().int().min(0).default(2),
  /** Generated questions in one AI game, regenerations included (spec §8: starting value 50). */
  QUESTIONS_PER_AI_GAME: z.coerce.number().int().min(1).default(50),
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
