import { NativeModule, requireNativeModule } from 'expo';

export interface LanAddress {
  name: string;
  ip: string;
  kind: 'wifi' | 'hotspot' | 'other';
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
}

declare class GameServerModule extends NativeModule<{}> {
  start(): void;
  stop(): void;
  getStatus(): ServerStatus;
}

export default requireNativeModule<GameServerModule>('GameServer');
