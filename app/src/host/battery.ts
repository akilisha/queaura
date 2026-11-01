import GameServer from '../../modules/game-server/src/GameServerModule';
import { meta } from '../data/db';

// Spec §3.1: on first host, if Android may pause the app, walk the host through allowing it, once.

const ASKED = 'batteryWalkthroughShown';

export function batteryRestricted(): boolean {
  return GameServer.isBatteryRestricted();
}

/** Show the walkthrough before this host's first game: only if needed, and only once. */
export function shouldWalkThroughBattery(): boolean {
  return meta.get(ASKED) === null && batteryRestricted();
}

export function markBatteryWalkthroughShown(): void {
  meta.set(ASKED, '1');
}

export function openAppSettings(): void {
  GameServer.openAppSettings();
}
