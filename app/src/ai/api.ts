// Talking to the cloud backend. Pure apart from the fetch and token it is given, so tests cover it.

export interface Balance {
  /** Unopened AI games. */
  aiGames: number;
  /** Questions left in the AI game already opened. */
  questionsLeft: number;
  questionsPerAiGame: number;
}

/** A failure the host can read as is. */
export class AiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Backend {
  baseUrl: string;
  /** The Clerk session token, or null when signed out. */
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

export async function call<T>(backend: Backend, path: string, body?: unknown): Promise<T> {
  const token = await backend.getToken();
  if (!token) throw new AiError(401, 'Please sign in to use AI questions.');
  let res: Response;
  try {
    res = await (backend.fetch ?? fetch)(`${backend.baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AiError(0, "Can't reach the AI service. Check that this phone is online, then try again.");
  }
  const data = await res.json().catch(() => null);
  // A reply without our JSON came from something in between (a gateway timing out, say): say which.
  if (!res.ok) throw new AiError(res.status, typeof data?.error === 'string' ? data.error : `Something went wrong (error ${res.status}). Please try again.`);
  return data as T;
}

export const getBalance = (backend: Backend) => call<Balance>(backend, '/v1/balance');

/** "3 AI games left", counting the one already opened as one more when it still has questions. */
export function describeBalance(b: Balance): string {
  const open = b.questionsLeft > 0 ? ` (plus ${b.questionsLeft} ${b.questionsLeft === 1 ? 'question' : 'questions'} left in the current one)` : '';
  return `${b.aiGames} AI ${b.aiGames === 1 ? 'game' : 'games'} left${open}`;
}
