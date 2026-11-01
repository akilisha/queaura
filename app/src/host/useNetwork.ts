import { useEffect, useState } from 'react';
import type { HotspotInfo, LanAddress } from '../../modules/game-server/src/GameServerModule';
import { serverStatus } from './server';

const POLL_MS = 2000;

/** The phone's networks, re-read every 2 s so the lobby follows Wi-Fi and hotspot changes. */
export function useNetwork(running: boolean): { addresses: LanAddress[]; hotspot: HotspotInfo | null } {
  const [network, setNetwork] = useState<{ addresses: LanAddress[]; hotspot: HotspotInfo | null }>({ addresses: [], hotspot: null });
  useEffect(() => {
    if (!running) return;
    const read = () => {
      const status = serverStatus();
      setNetwork((prev) =>
        JSON.stringify(prev) === JSON.stringify({ addresses: status.addresses, hotspot: status.hotspot })
          ? prev
          : { addresses: status.addresses, hotspot: status.hotspot },
      );
    };
    read();
    const timer = setInterval(read, POLL_MS);
    return () => clearInterval(timer);
  }, [running]);
  return network;
}
