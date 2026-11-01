import { PermissionsAndroid, Platform } from 'react-native';
import GameServer, { type HotspotInfo } from '../../modules/game-server/src/GameServerModule';

/**
 * Creates this phone's own Wi-Fi network (spec §3.3). Android asks once for permission to use
 * nearby Wi-Fi (13+) or location (older). Rejects with a message the host can read.
 */
export async function createNetwork(): Promise<HotspotInfo> {
  if (Platform.OS === 'android') {
    const permission =
      Number(Platform.Version) >= 33
        ? PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES
        : PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const result = await PermissionsAndroid.request(permission);
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Queaura needs that permission to create a Wi-Fi network. You can allow it and try again.');
    }
  }
  return GameServer.startHotspot();
}

export function endNetwork(): void {
  GameServer.stopHotspot();
}

export function openWifiSettings(): void {
  GameServer.openWifiSettings();
}
