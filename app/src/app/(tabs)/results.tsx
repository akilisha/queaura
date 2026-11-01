import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { PendingResults } from '../../components/PendingResults';
import { Muted, Screen } from '../../components/ui';
import { results } from '../../data/db';
import { plural } from '../../game/copy';
import { summary, useResultsVersion } from '../../results/store';
import { color, font, radius, size, space, text } from '../../theme';

/** Saved questionnaire answers on this phone (spec §6.4), newest first. */
export default function Results() {
  const version = useResultsVersion();
  const saved = useMemo(() => results.all(), [version]);
  return (
    <Screen>
      <PendingResults />
      {saved.length === 0 && (
        <Muted>No saved results yet. Play a questionnaire, then save its answers when you end it, and they appear here.</Muted>
      )}
      {saved.length > 0 && <Muted>{plural(saved.length, 'questionnaire')} saved on this phone.</Muted>}
      {saved.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          onPress={() => router.push(`/results/${r.id}`)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.title}>{r.title}</Text>
          <Muted>{new Date(r.startedAt).toLocaleString()}</Muted>
          <Text style={styles.summary}>{summary(r)}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: size.borderWidth,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[1],
  },
  pressed: { borderColor: color.primary, backgroundColor: color.surfaceRaised },
  title: { fontSize: text.lg, fontFamily: font.bodyBold, color: color.text },
  summary: { fontSize: text.md, fontFamily: font.body, color: color.text },
});
