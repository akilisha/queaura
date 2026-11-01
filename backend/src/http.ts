import type { ErrorRequestHandler } from 'express';

/** An error the host may see as is: a status and a plain-language message. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Known errors keep their message; anything unexpected is logged and shown as a plain 500. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Errors from express.json(): malformed or oversized bodies.
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(JSON.stringify({ level: 'error', message: String(err?.stack ?? err) }));
  res.status(status).json({ error: status === 413 ? 'That request is too large.' : status === 500 ? 'Something went wrong. Please try again.' : 'That request could not be read.' });
};
