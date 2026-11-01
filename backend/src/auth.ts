import type { Request } from 'express';

/** Who is calling: the account id (the Clerk user id), or null if not signed in. */
export type Authenticator = (req: Request) => Promise<string | null>;

/** Until Clerk is connected (Phase 3, milestone 3) every signed-in route refuses. */
export const notConfigured: Authenticator = async () => null;
