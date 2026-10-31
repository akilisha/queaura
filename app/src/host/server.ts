import { PermissionsAndroid, Platform } from 'react-native';
import GameServer, { type ServerStatus } from '../../modules/game-server/src/GameServerModule';

const START_TIMEOUT_MS = 8000;

/** Starts the game server (a foreground service) if needed and waits until it is listening. */
export async function ensureServer(): Promise<ServerStatus> {
  let status = GameServer.getStatus();
  if (status.running) return status;
  // The service's notification needs this on Android 13+; the server runs either way.
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  GameServer.start();
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
    status = GameServer.getStatus();
    if (status.running) return status;
    if (status.error) throw new Error(status.error);
  }
  throw new Error('The game server did not start in time. Try again.');
}

export function stopServer(): void {
  GameServer.stop();
}

export function serverStatus(): ServerStatus {
  return GameServer.getStatus();
}
