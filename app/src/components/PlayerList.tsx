import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScoreEntry } from '../../../protocol/src';
import { color, opacity, radius, size, space, text, weight } from '../theme';

interface Props {
  players: ScoreEntry[];
  /** Columns of numbers to show; the lobby shows none. */
  columns?: ('total' | 'roundPoints' | 'lastPoints')[];
  /** Long-press to remove a player (spec §5.5). */
  onKick?: (player: ScoreEntry) => void;
  answeredIds?: number[];
}

const HEADERS = { total: 'Total', roundPoints: 'Round', lastPoints: 'Last' } as const;

export function PlayerList({ players, columns = [], onKick, answeredIds }: Props) {
  if (players.length === 0) return <Text style={styles.empty}>No players yet. They join by scanning the code.</Text>;
  const confirmKick = (p: ScoreEntry) =>
    Alert.alert(`Remove ${p.name}?`, 'They will not be able to rejoin this session.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onKick?.(p) },
    ]);
  return (
    <View style={styles.list}>
      {columns.length > 0 && (
        <View style={styles.row}>
          <Text style={[styles.name, styles.header]}>Player</Text>
          {columns.map((c) => (
            <Text key={c} style={[styles.number, styles.header]}>{HEADERS[c]}</Text>
          ))}
        </View>
      )}
      {players.map((p) => (
        <Pressable key={p.id} onLongPress={onKick ? () => confirmKick(p) : undefined} delayLongPress={500}>
          <View style={[styles.row, styles.item, !p.online && styles.offline]}>
            <Text style={styles.emoji}>{p.emoji}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {p.name}
              {!p.online ? '  (away)' : !p.awake ? '  (screen off)' : ''}
            </Text>
            {answeredIds && <Text style={styles.answered}>{answeredIds.includes(p.id) ? '✓' : ''}</Text>}
            {columns.map((c) => (
              <Text key={c} style={styles.number}>{p[c] ?? '–'}</Text>
            ))}
          </View>
        </Pressable>
      ))}
      {onKick && <Text style={styles.hint}>Press and hold a player to remove them.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[3] },
  item: { paddingVertical: space[2], borderRadius: radius.md, backgroundColor: color.surfaceRaised },
  offline: { opacity: opacity.offline },
  emoji: { fontSize: text.lg },
  name: { flex: 1, fontSize: text.md, color: color.text },
  header: { fontSize: text.xs, color: color.textMuted, fontWeight: weight.semibold },
  number: { minWidth: size.numberColumn, textAlign: 'right', fontSize: text.md, fontWeight: weight.bold, color: color.text, fontVariant: ['tabular-nums'] },
  answered: { minWidth: size.markColumn, color: color.success, fontWeight: weight.bold },
  empty: { fontSize: text.md, color: color.textMuted },
  hint: { fontSize: text.xs, color: color.textMuted },
});
