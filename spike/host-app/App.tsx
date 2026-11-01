import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import SpikeServer, { type HotspotInfo, type ServerStatus } from './modules/spike-server/src/SpikeServerModule';

// Phase 0 spike host screen (throwaway): start the server, show the join QR code, watch the numbers.

const theme = {
  bg: '#f6f4ef',
  surface: '#ffffff',
  text: '#1b1a22',
  muted: '#5d5a6b',
  border: '#e2dfd6',
  primary: '#3a2fd1',
  onPrimary: '#ffffff',
  danger: '#b3261e',
  success: '#1c7c4a',
  space: 16,
  radius: 16,
  qr: 220,
};

async function request(permission: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]) {
  if (Platform.OS !== 'android') return true;
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

/** Wi-Fi QR payload (the format Android and iOS cameras understand). */
function wifiQr(info: HotspotInfo): string {
  const escape = (value: string) => value.replace(/([\\;,:"])/g, '\\$1');
  const password = info.passphrase ? `P:${escape(info.passphrase)};` : '';
  return `WIFI:T:${info.security};S:${escape(info.ssid)};${password};`;
}

export default function App() {
  const [status, setStatus] = useState<ServerStatus>(() => SpikeServer.getStatus());
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [hotspot, setHotspot] = useState<HotspotInfo | null>(null);
  const [hotspotError, setHotspotError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setStatus(SpikeServer.getStatus()), 1000);
    return () => clearInterval(timer);
  }, []);

  const start = async () => {
    if (Number(Platform.Version) >= 33) await request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    SpikeServer.start();
  };

  const startHotspot = async () => {
    setHotspotError(null);
    const granted =
      Number(Platform.Version) >= 33
        ? await request(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES)
        : await request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (!granted) {
      setHotspotError('Permission denied');
      return;
    }
    try {
      setHotspot(await SpikeServer.startHotspot());
    } catch (e) {
      setHotspotError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopHotspot = () => {
    SpikeServer.stopHotspot();
    setHotspot(null);
  };

  const address = status.addresses.find((a) => a.ip === selectedIp) ?? status.addresses[0];
  const base = address ? `http://${address.ip}:${status.httpPort}` : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Queaura spike</Text>

      <View style={styles.card}>
        <Button
          label={status.running ? 'Stop server' : 'Start server'}
          onPress={status.running ? () => SpikeServer.stop() : start}
          tone={status.running ? 'danger' : 'primary'}
        />
        {status.error && <Text style={styles.error}>{status.error}</Text>}
        {status.running && (
          <View style={styles.grid}>
            <Metric label="Players online" value={`${status.playersOnline} / ${status.players}`} />
            <Metric label="TV / diag viewers" value={String(status.viewers)} />
            <Metric label="Network drops" value={String(status.unexpectedCloses)} alert={status.unexpectedCloses > 0} />
            <Metric label="Screen-sleep drops" value={String(status.sleepCloses)} alert={status.sleepCloses > 0} />
            <Metric label="Uptime" value={`${Math.floor(status.ticks / 60)}m ${status.ticks % 60}s`} />
            <Metric label="Worst tick lateness" value={`${Math.round(status.maxTickLateMs)} ms`} alert={status.maxTickLateMs > 250} />
          </View>
        )}
      </View>

      {status.running && hotspot && (
        <View style={styles.card}>
          <Text style={styles.step}>Step 1: join this Wi-Fi</Text>
          <View style={styles.qr}>
            <QRCode value={wifiQr(hotspot)} size={theme.qr} />
          </View>
          <Text style={styles.mono}>{hotspot.ssid}</Text>
          {hotspot.passphrase && <Text style={styles.mono}>{hotspot.passphrase}</Text>}
        </View>
      )}

      {status.running && base && (
        <View style={styles.card}>
          <Text style={styles.step}>{hotspot ? 'Step 2: join the game' : 'Scan to join'}</Text>
          <View style={styles.qr}>
            <QRCode value={`${base}/`} size={theme.qr} />
          </View>
          <Text style={styles.url}>{base}</Text>
          <Text style={styles.muted}>TV: {base}/?mode=tv</Text>
          <Text style={styles.muted}>Diagnostics: {base}/?mode=diag</Text>
          <Text style={styles.muted}>Live stats: {base}/stats.json</Text>
          <Text style={styles.muted}>Raw log: {base}/log.jsonl</Text>
        </View>
      )}

      {status.running && status.addresses.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.step}>Network</Text>
          {status.addresses.map((a) => (
            <Button
              key={a.ip}
              label={`${a.kind} · ${a.name} · ${a.ip}`}
              tone={a.ip === address?.ip ? 'primary' : 'plain'}
              onPress={() => setSelectedIp(a.ip)}
            />
          ))}
        </View>
      )}

      {status.running && (
        <View style={styles.card}>
          <Button
            label={hotspot ? 'Stop LocalOnlyHotspot' : 'Start LocalOnlyHotspot'}
            onPress={hotspot ? stopHotspot : startHotspot}
            tone="plain"
          />
          {hotspotError && <Text style={styles.error}>{hotspotError}</Text>}
          {status.logFile && <Text style={styles.muted}>Log on device: {status.logFile}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

function Button({ label, onPress, tone }: { label: string; onPress: () => void; tone: 'primary' | 'danger' | 'plain' }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[tone], pressed && styles.pressed]}
    >
      <Text style={[styles.buttonLabel, tone === 'plain' && styles.plainLabel]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, alert && styles.alert]}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.space, paddingTop: theme.space * 3, gap: theme.space },
  title: { fontSize: 24, fontWeight: '800', color: theme.text },
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.space,
    gap: theme.space / 2,
  },
  button: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.space },
  primary: { backgroundColor: theme.primary },
  danger: { backgroundColor: theme.danger },
  plain: { backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1 },
  pressed: { opacity: 0.8 },
  buttonLabel: { color: theme.onPrimary, fontSize: 16, fontWeight: '600' },
  plainLabel: { color: theme.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space },
  metric: { minWidth: 140 },
  metricValue: { fontSize: 22, fontWeight: '800', color: theme.success },
  alert: { color: theme.danger },
  step: { fontSize: 16, fontWeight: '700', color: theme.text },
  qr: { alignItems: 'center', padding: theme.space, backgroundColor: '#ffffff' },
  url: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center' },
  mono: { fontSize: 16, fontFamily: 'monospace', color: theme.text, textAlign: 'center' },
  muted: { fontSize: 13, color: theme.muted },
  error: { color: theme.danger },
});
