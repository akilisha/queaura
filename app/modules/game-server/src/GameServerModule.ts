import { NativeModule, requireNativeModule } from 'expo';

export interface LanAddress {
  name: string;
  ip: string;
  kind: 'wifi' | 'hotspot' | 'other';
}

/** The phone's own Wi-Fi network (LocalOnlyHotspot), while it is up. */
export interface HotspotInfo {
  ssid: string;
  passphrase: string | null;
  security: 'WPA' | 'SAE' | 'nopass';
}

export interface ServerStatus {
  running: boolean;
  httpPort: number;
  wsPort: number;
  /** Proves the host app to the server; null until running. */
  hostKey: string | null;
  /** Hotspot first, then Wi-Fi. */
  addresses: LanAddress[];
  error: string | null;
  hotspot: HotspotInfo | null;
}

declare class GameServerModule extends NativeModule<{}> {
  start(): void;
  stop(): void;
  getStatus(): ServerStatus;
  /** Rejects with a plain-language message the host can read. */
  startHotspot(): Promise<HotspotInfo>;
  stopHotspot(): void;
  /** True when Android may pause the app in the background. */
  isBatteryRestricted(): boolean;
  openAppSettings(): void;
  openWifiSettings(): void;
}

export default requireNativeModule<GameServerModule>('GameServer');
