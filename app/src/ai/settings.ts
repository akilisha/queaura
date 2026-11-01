// Where AI questions come from (spec §8). Both are build settings, read from app/.env.local
// (EXPO_PUBLIC_ variables are compiled into the app; neither is a secret). Without them the app
// works as before and the AI parts say they aren't set up in this build.

/** Clerk's publishable key: identifies our Clerk application, safe to ship. */
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

/** The cloud backend, e.g. https://api.queaura.app (no trailing slash). */
export const AI_BACKEND_URL = (process.env.EXPO_PUBLIC_AI_BACKEND_URL ?? '').replace(/\/+$/, '');

export const aiConfigured = CLERK_PUBLISHABLE_KEY !== '' && AI_BACKEND_URL !== '';
