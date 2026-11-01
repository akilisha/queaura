import { describe, expect, it } from 'vitest';
import type { LanAddress } from '../../modules/game-server/src/GameServerModule';
import { gameUrl, joinPath, wifiQr } from './network';

const wifi: LanAddress = { name: 'wlan0', ip: '192.168.1.112', kind: 'wifi' };
const ap: LanAddress = { name: 'swlan0', ip: '192.168.43.1', kind: 'hotspot' };
const hotspot = { ssid: 'AndroidShare_1234', passphrase: 'abc12345', security: 'WPA' as const };

describe('joinPath', () => {
  it('uses Wi-Fi when the phone is on Wi-Fi', () => {
    expect(joinPath([wifi], null)).toEqual({ kind: 'wifi', address: wifi });
  });
  it('uses the own network and its address while the hotspot is up', () => {
    expect(joinPath([ap, wifi], hotspot)).toEqual({ kind: 'hotspot', hotspot, address: ap });
  });
  it("ignores a hotspot interface that isn't ours (the phone's regular hotspot is not this flow)", () => {
    expect(joinPath([ap, wifi], null)).toEqual({ kind: 'wifi', address: wifi });
  });
  it('is offline with no shared network', () => {
    expect(joinPath([], null)).toEqual({ kind: 'offline' });
  });
  it('keeps the host’s chosen address when there are several', () => {
    const other: LanAddress = { name: 'eth0', ip: '10.0.0.5', kind: 'other' };
    expect(joinPath([wifi, other], null, '10.0.0.5')).toEqual({ kind: 'wifi', address: other });
  });
});

describe('wifiQr', () => {
  it('builds the camera-readable payload', () => {
    expect(wifiQr(hotspot)).toBe('WIFI:T:WPA;S:AndroidShare_1234;P:abc12345;;');
  });
  it('escapes special characters', () => {
    expect(wifiQr({ ssid: 'Bar;Quiz', passphrase: 'a:b"c\\d', security: 'SAE' })).toBe('WIFI:T:SAE;S:Bar\\;Quiz;P:a\\:b\\"c\\\\d;;');
  });
  it('omits the password on an open network', () => {
    expect(wifiQr({ ssid: 'Open', passphrase: null, security: 'nopass' })).toBe('WIFI:T:nopass;S:Open;;');
  });
});

it('builds the game address', () => expect(gameUrl(wifi, 8080)).toBe('http://192.168.1.112:8080/'));
