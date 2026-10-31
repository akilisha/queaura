// The seat token survives refreshes and reopened tabs (spec §3.5). Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.
const KEY = 'triviocity.token';

export function loadToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Without storage the player simply rejoins after a refresh.
  }
}
