import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Muted, Screen } from '../../../components/ui';
import { NextButton, StepFooter, StepHeader } from '../../../components/wizard';
import { useLibrary } from '../../../data/library';
import { plural, STYLES } from '../../../game/copy';
import { emptySlots, withSlot } from '../../../game/format';
import { color, radius, size, space, text, weight } from '../../../theme';
import { useWizard } from '../../../wizard/draft';

/** Step 4: plug questions from the bank into each round's slots. Empty slots are allowed. */
export default function SlotsStep() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft } = useWizard();
  const library = useLibrary();
  const empty = emptySlots(draft, library.byId);
  return (
    <Screen>
      <StepHeader
        step={4}
        title="Choose the questions"
        intro="Tap a slot to pick a question. You can leave slots empty and fill them later; the game just can't be played until they're full."
      />
      {draft.rounds.map((round, r) => (
        <Card key={r} title={`Round ${r + 1} · ${STYLES[round.style].name}`}>
          {round.slots.map((qid, s) => {
            const q = qid ? library.byId.get(qid) : undefined;
            return (
              <View key={s} style={styles.slot}>
                <Text style={styles.number}>{s + 1}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={q ? `Change question ${s + 1}: ${q.text}` : `Choose question ${s + 1}`}
                  onPress={() => router.push(`/games/${id}/pick?round=${r}&slot=${s}`)}
                  style={({ pressed }) => [styles.pick, !q && styles.empty, pressed && styles.pressed]}
                >
                  <Text style={q ? styles.question : styles.placeholder} numberOfLines={2}>
                    {q ? q.text : '+ Choose a question'}
                  </Text>
                </Pressable>
                {q && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Empty slot ${s + 1}`}
                    onPress={() => setDraft(withSlot(draft, r, s, null))}
                    style={styles.clear}
                  >
                    <Text style={styles.clearLabel}>✕</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>
      ))}
      <StepFooter>
        <Muted>{empty === 0 ? 'Every slot is filled.' : `${plural(empty, 'slot')} still empty.`}</Muted>
        <NextButton label="Review" onPress={() => router.push(`/games/${id}/summary`)} />
      </StepFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  slot: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  number: { minWidth: size.markColumn, fontSize: text.sm, fontWeight: weight.bold, color: color.textMuted },
  pick: {
    flex: 1,
    minHeight: size.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderWidth: size.borderWidth,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  empty: { borderStyle: 'dashed', backgroundColor: color.surface },
  pressed: { borderColor: color.primary },
  question: { fontSize: text.md, color: color.text },
  placeholder: { fontSize: text.md, color: color.primary, fontWeight: weight.semibold },
  clear: { width: size.tapMin, height: size.tapMin, alignItems: 'center', justifyContent: 'center' },
  clearLabel: { fontSize: text.lg, color: color.textMuted },
});
