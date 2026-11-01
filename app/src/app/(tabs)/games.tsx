import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useConfirm } from '../../components/ConfirmDialog';
import { Button, Card, Grid, Muted, Screen } from '../../components/ui';
import { games } from '../../data/db';
import { libraryChanged, useLibrary } from '../../data/library';
import type { GameFormat } from '../../data/types';
import { sizeOf } from '../../game/format';
import { problemOf } from '../../game/resolve';
import { color, font, opacity, space, text } from '../../theme';

/** Saved games. Unfinished ones are greyed out with the reason (spec §5.2). */
export default function Games() {
  const library = useLibrary();
  const [dialog, confirm] = useConfirm();

  const remove = (g: GameFormat) =>
    confirm({
      title: `Delete "${g.title}"?`,
      message: 'The game is deleted. Its questions stay in your question bank.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        games.remove(g.id);
        libraryChanged();
      },
    });

  return (
    <Screen>
      {dialog}
      <Button big label="Create a game" onPress={() => router.push('/games/new')} />
      <Grid>
        {library.games.map((g) => {
          const problem = problemOf(g, library.byId);
          return (
            <Card key={g.id}>
              <View style={problem ? styles.unfinished : undefined}>
                <Text style={styles.title}>{g.title}</Text>
                <Muted>{sizeOf(g)}</Muted>
              </View>
              <Text style={problem ? styles.problem : styles.ready}>{problem ? `Not ready: ${problem}` : 'Ready to play'}</Text>
              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button tone="secondary" label={problem ? 'Finish it' : 'Edit'} onPress={() => router.push(`/games/${g.id}`)} />
                </View>
                <View style={styles.action}>
                  <Button tone="secondary" label="Delete" onPress={() => remove(g)} />
                </View>
              </View>
            </Card>
          );
        })}
      </Grid>
      {library.games.length === 0 && <Muted>No games yet. Create one above.</Muted>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unfinished: { opacity: opacity.offline },
  title: { fontSize: text.lg, fontFamily: font.bodyBold, color: color.text },
  ready: { fontSize: text.sm, fontFamily: font.bodySemi, color: color.success },
  problem: { fontSize: text.sm, fontFamily: font.bodySemi, color: color.warning },
  actions: { flexDirection: 'row', gap: space[3] },
  action: { flex: 1 },
});
