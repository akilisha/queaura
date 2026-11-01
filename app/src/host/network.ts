import type { HotspotInfo, LanAddress } from '../../modules/game-server/src/GameServerModule';

// How players reach this phone (spec §3.1–3.3). Pure, so the lobby and tests share it.

export type JoinPath =
  /** Players join this phone's Wi-Fi network first, then the game: two scans. */
  | { kind: 'hotspot'; hotspot: HotspotInfo; address: LanAddress }
  /** Everyone on the same Wi-Fi: one scan. */
  | { kind: 'wifi'; address: LanAddress }
  /** The phone is on no network players could share (mobile data only, or Wi-Fi off). */
  | { kind: 'offline' };

export function joinPath(addresses: LanAddress[], hotspot: HotspotInfo | null, chosenIp?: string | null): JoinPath {
  if (hotspot) {
    const own = addresses.find((a) => a.kind === 'hotspot') ?? addresses[0];
    if (own) return { kind: 'hotspot', hotspot, address: own };
  }
  const usable = addresses.filter((a) => a.kind !== 'hotspot' || hotspot);
  const address = usable.find((a) => a.ip === chosenIp) ?? usable.find((a) => a.kind === 'wifi') ?? usable[0];
  return address ? { kind: 'wifi', address } : { kind: 'offline' };
}

/**
 * The Wi-Fi QR format phone cameras understand: WIFI:T:<type>;S:<ssid>;P:<password>;;
 * Backslash, semicolon, comma, colon and double quote must be escaped.
 */
export function wifiQr(info: HotspotInfo): string {
  const escape = (value: string) => value.replace(/([\\;,:"])/g, '\\$1');
  const password = info.passphrase ? `P:${escape(info.passphrase)};` : '';
  return `WIFI:T:${info.security};S:${escape(info.ssid)};${password};`;
}

export function gameUrl(address: LanAddress, port: number): string {
  return `http://${address.ip}:${port}/`;
}
