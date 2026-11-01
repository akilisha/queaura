import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AiAccount } from '../../components/AiAccount';
import { Chips, Field } from '../../components/form';
import { Button, Card, Grid, Muted, Screen } from '../../components/ui';
import { useLibrary } from '../../data/library';
import type { BankQuestion } from '../../data/types';
import { gamesUsing } from '../../data/usage';
import { ANSWER_TYPES } from '../../game/copy';
import { isGraded } from '../../game/resolve';
import { color, font, radius, size, space, text } from '../../theme';

type Filter = 'all' | keyof typeof ANSWER_TYPES;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(ANSWER_TYPES) as (keyof typeof ANSWER_TYPES)[]).map((value) => ({ value, label: ANSWER_TYPES[value] })),
];

/** The question bank on this device (spec §5.3). */
export default function Questions() {
  const library = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return library.questions.filter(
      (q) => (filter === 'all' || q.answerType === filter) && (!term || q.text.toLowerCase().includes(term)),
    );
  }, [library, filter, search]);

  return (
    <Screen>
      <Button big label="New question" onPress={() => router.push('/questions/new')} />
      <AiAccount />
      <Card>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Find a question" />
        <Chips options={FILTERS} value={filter} onChange={setFilter} />
      </Card>
      <Muted>
        {shown.length} {shown.length === 1 ? 'question' : 'questions'}
      </Muted>
      <Grid>
        {shown.map((q) => (
          <QuestionRow key={q.id} question={q} usedIn={gamesUsing(q.id, library.games).length} />
        ))}
      </Grid>
      {shown.length === 0 && <Muted>No questions match. Try another search, or write a new one.</Muted>}
    </Screen>
  );
}

function QuestionRow({ question: q, usedIn }: { question: BankQuestion; usedIn: number }) {
  const answer =
    q.answerType === 'freeText'
      ? 'Players write their own (questionnaires only)'
      : !isGraded(q)
        ? 'No right answer (questionnaires only)'
      : `Answer: ${q.answerType === 'numeric' ? String(q.correctNumber) : (q.choices?.find((c) => c.id === q.correctChoiceId)?.text ?? '')}`;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/questions/${q.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.text}>{q.text}</Text>
      <View style={styles.meta}>
        <Text style={styles.badge}>{ANSWER_TYPES[q.answerType]}</Text>
        <Text style={styles.answer} numberOfLines={1}>{answer}</Text>
      </View>
      <Muted>{usedIn === 0 ? 'Not in any game yet' : `In ${usedIn} ${usedIn === 1 ? 'game' : 'games'}`}</Muted>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: size.borderWidth,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[2],
  },
  pressed: { backgroundColor: color.surfaceRaised },
  text: { fontSize: text.md, fontFamily: font.bodySemi, color: color.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  badge: {
    fontSize: text.xs,
    fontFamily: font.bodySemi,
    color: color.violet,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.pill,
    borderWidth: size.borderWidth,
    borderColor: color.violet,
  },
  answer: { flex: 1, fontSize: text.sm, color: color.success, fontFamily: font.bodySemi },
});
