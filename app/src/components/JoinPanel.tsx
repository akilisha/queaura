import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { LanAddress } from '../../modules/game-server/src/GameServerModule';
import { gameUrl, wifiQr, type JoinPath } from '../host/network';
import { color, font, glow, radius, size, space, text, tracking } from '../theme';
import { Button, Card, Muted } from './ui';

interface Props {
  path: JoinPath;
  port: number;
  addresses: LanAddress[];
  onChooseAddress: (ip: string) => void;
  onHelp: () => void;
  onEndNetwork: () => void;
  /** Nobody has joined for a while: make the help link prominent. */
  nobodyYet: boolean;
}

/** How players get in (spec §3.1–3.3): one scan on shared Wi-Fi, two on the phone's own network. */
export function JoinPanel({ path, port, addresses, onChooseAddress, onHelp, onEndNetwork, nobodyYet }: Props) {
  if (path.kind === 'offline') {
    return (
      <Card title="Players join here" style={styles.card}>
        <Text style={styles.lead}>This phone isn't on Wi-Fi</Text>
        <Muted>Players join on the same Wi-Fi as this phone. Connect it to Wi-Fi, or let it make its own network.</Muted>
        <Button label="Get players connected" onPress={onHelp} />
      </Card>
    );
  }

  const url = gameUrl(path.address, port);
  const help = (
    <Pressable accessibilityRole="link" onPress={onHelp} style={styles.help}>
      <Text style={[styles.helpLabel, nobodyYet && styles.helpUrgent]}>
        {nobodyYet ? "Nobody's joined yet. Players can't get in?" : "Players can't join?"}
      </Text>
    </Pressable>
  );

  if (path.kind === 'hotspot') {
    return (
      <Card title="Players join here" style={styles.card}>
        <Text style={styles.step}>1 · Join this phone's Wi-Fi</Text>
        <Qr value={wifiQr(path.hotspot)} />
        <Text style={styles.detail}>{path.hotspot.ssid}</Text>
        {path.hotspot.passphrase && <Text style={styles.detail}>Password: {path.hotspot.passphrase}</Text>}
        <Text style={styles.step}>2 · Then scan to join the game</Text>
        <Qr value={url} />
        <Text style={styles.detail}>{url}</Text>
        <Muted>Players are off the internet while on this network; the game doesn't need it. A TV can join by entering the name and password in its Wi-Fi settings.</Muted>
        <Button tone="secondary" label="Back to normal Wi-Fi" onPress={onEndNetwork} />
        {help}
      </Card>
    );
  }

  return (
    <Card title="Players join here" style={styles.card}>
      <Qr value={url} />
      <Text style={styles.lead}>Scan to join</Text>
      <Text style={styles.detail}>{url}</Text>
      <Muted>On a TV, open this in the browser to show the game to the room:</Muted>
      <Text style={styles.detail}>{`${url}?mode=tv`}</Text>
      {addresses.length > 1 && (
        <View style={styles.networks}>
          <Muted>This phone is on more than one network. Players must be on the same one:</Muted>
          {addresses.map((a) => (
            <Button
              key={a.ip}
              tone={a.ip === path.address.ip ? 'primary' : 'secondary'}
              label={`${a.kind === 'hotspot' ? 'Hotspot' : a.kind === 'wifi' ? 'Wi-Fi' : a.name} · ${a.ip}`}
              onPress={() => onChooseAddress(a.ip)}
            />
          ))}
        </View>
      )}
      {help}
    </Card>
  );
}

function Qr({ value }: { value: string }) {
  return (
    <View style={styles.qr}>
      <QRCode value={value} size={size.qr} color={color.qrDark} backgroundColor={color.qrLight} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: color.violet, borderWidth: size.borderStrong, ...glow.violet },
  qr: { alignItems: 'center', padding: space[3], backgroundColor: color.qrLight, borderRadius: radius.md },
  lead: { fontFamily: font.display, fontSize: text.xl, color: color.gold, textAlign: 'center', textTransform: 'uppercase', letterSpacing: tracking.caps, ...glow.softGoldText },
  step: { fontFamily: font.display, fontSize: text.lg, color: color.gold, textTransform: 'uppercase', letterSpacing: tracking.caps },
  detail: { fontFamily: font.bodyBold, fontSize: text.lg, color: color.text, textAlign: 'center' },
  networks: { gap: space[2] },
  help: { alignSelf: 'center', paddingVertical: space[2], paddingHorizontal: space[3] },
  helpLabel: { fontFamily: font.bodySemi, fontSize: text.md, color: color.violetLight, textDecorationLine: 'underline' },
  helpUrgent: { fontFamily: font.bodyBold, color: color.gold },
});
