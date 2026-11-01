import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Field } from '../../../components/form';
import { Button, Card, Muted, Screen } from '../../../components/ui';
import { useLibrary } from '../../../data/library';
import { STYLES } from '../../../game/copy';
import { candidates, withSlot } from '../../../game/format';
import { color, font, radius, size, space, text } from '../../../theme';
import { useWizard } from '../../../wizard/draft';

/** Picks a question for one slot. Only questions that fit the round's style are offered (spec §4). */
export default function PickQuestion() {
  const params = useLocalSearchParams<{ round: string; slot: string }>();
  const round = Number(params.round);
  const slot = Number(params.slot);
  const { draft, setDraft } = useWizard();
  const library = useLibrary();
  const [search, setSearch] = useState('');
  const style = draft.rounds[round].style;

  const offered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return candidates(draft, round, library.questions).filter((q) => !term || q.text.toLowerCase().includes(term));
  }, [draft, round, library, search]);

  const choose = (questionId: string) => {
    setDraft(withSlot(draft, round, slot, questionId));
    router.back();
  };

  // A closest-guess round can only take number questions, so the editor starts there.
  const writeNew = () => router.push(style === 'closestWithoutGoingOver' ? '/questions/new?type=numeric' : '/questions/new');

  return (
    <Screen>
      <Muted>
        Round {round + 1}, question {slot + 1} · {STYLES[style].name}
        {style === 'closestWithoutGoingOver' ? ': only questions with a number answer fit.' : ''}
      </Muted>
      <Button tone="secondary" label="Write a new question" onPress={writeNew} />
      <Card>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Find a question" />
      </Card>
      {offered.map((q) => (
        <Pressable key={q.id} accessibilityRole="button" onPress={() => choose(q.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <Text style={styles.text}>{q.text}</Text>
          {style === 'multipleChoice' && q.answerType === 'numeric' && (
            <Muted>Number answer: players get four choices made up around it.</Muted>
          )}
        </Pressable>
      ))}
      {offered.length === 0 && (
        <Muted>
          {search ? 'No questions match.' : 'Every question that fits is already in this game.'} Write a new one with the button above.
        </Muted>
      )}
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
  text: { fontSize: text.md, fontFamily: font.bodySemi, color: color.text },
});
