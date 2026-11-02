import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { aiConfigured } from '../../../ai/settings';
import { Field } from '../../../components/form';
import { Button, Card, Muted, Screen } from '../../../components/ui';
import { NextButton, StepFooter, StepHeader } from '../../../components/wizard';
import { useLibrary } from '../../../data/library';
import { plural, STYLES } from '../../../game/copy';
import { randomFill } from '../../../game/fill';
import { emptySlots, withSlot } from '../../../game/format';
import { color, font, radius, size, space, text } from '../../../theme';
import { useWizard } from '../../../wizard/draft';

/** Step 4: plug questions from the bank into each round's slots. Empty slots are allowed. */
export default function SlotsStep() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft } = useWizard();
  const library = useLibrary();
  const empty = emptySlots(draft, library.byId);
  // The slots the last random pick filled, so "Shuffle again" re-picks only those.
  const [picked, setPicked] = useState<number[][] | null>(null);
  const [pickNote, setPickNote] = useState<string | null>(null);
  const [randomOpen, setRandomOpen] = useState(false);
  const [topic, setTopic] = useState('');

  const pick = (slots?: number[][]) => {
    const result = randomFill(draft, library.questions, library.games, { topic, slots });
    setDraft(result.game);
    setPicked(result.picked);
    const filled = result.picked.reduce((n, r) => n + r.length, 0);
    setPickNote(
      filled === 0
        ? `None of your questions${topic.trim() ? ` about "${topic.trim()}"` : ''} fit the empty slots. Write some, or try another topic.`
        : `Filled ${filled} ${filled === 1 ? 'slot' : 'slots'}.${result.unfilled > 0 ? ` ${result.unfilled} stayed empty: not enough unused questions fit.` : ''} Tap any question to swap it.`,
    );
  };
  return (
    <Screen form>
      <StepHeader
        name="Questions"
        title="Choose the questions"
        intro="Tap a slot to pick a question. You can leave slots empty and fill them later; the game just can't be played until they're full."
      />
      {(empty > 0 || picked) && (
        <Card title="Fill the empty slots">
          <Muted>Let the app choose, then swap any question you don't like.</Muted>
          {aiConfigured && empty > 0 && <Button label="With AI" onPress={() => router.push(`/games/${id}/fill-ai`)} />}
          {!randomOpen ? (
            empty > 0 && <Button tone={aiConfigured ? 'secondary' : 'primary'} label="From my questions" onPress={() => setRandomOpen(true)} />
          ) : (
            <>
              <Field label="Only questions about (optional)" value={topic} onChangeText={setTopic} placeholder="Any topic" />
              {empty > 0 && <Button label="Pick at random" onPress={() => pick()} />}
              {picked && picked.some((r) => r.length > 0) && <Button tone="secondary" label="Shuffle again" onPress={() => pick(picked)} />}
              {pickNote && <Muted>{pickNote}</Muted>}
            </>
          )}
        </Card>
      )}
      {draft.rounds.map((round, r) => (
        <Card key={r} title={round.style === 'questionnaire' ? 'Questions' : `Round ${r + 1} · ${STYLES[round.style].name}`}>
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
  number: { minWidth: size.markColumn, fontSize: text.sm, fontFamily: font.bodyBold, color: color.textMuted },
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
  question: { fontFamily: font.body, fontSize: text.md, color: color.text },
  placeholder: { fontSize: text.md, color: color.primary, fontFamily: font.bodySemi },
  clear: { width: size.tapMin, height: size.tapMin, alignItems: 'center', justifyContent: 'center' },
  clearLabel: { fontFamily: font.body, fontSize: text.lg, color: color.textMuted },
});
