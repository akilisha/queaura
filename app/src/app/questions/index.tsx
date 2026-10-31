import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips, Field } from '../../components/form';
import { Button, Card, Muted, Screen } from '../../components/ui';
import { useLibrary } from '../../data/library';
import type { BankQuestion } from '../../data/types';
import { gamesUsing } from '../../data/usage';
import { color, radius, size, space, text, weight } from '../../theme';

type Filter = 'all' | 'numeric' | 'multipleChoice';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'numeric', label: 'Number' },
  { value: 'multipleChoice', label: 'Multiple choice' },
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
      <Card>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Find a question" />
        <Chips options={FILTERS} value={filter} onChange={setFilter} />
      </Card>
      <Muted>
        {shown.length} {shown.length === 1 ? 'question' : 'questions'}
      </Muted>
      {shown.map((q) => (
        <QuestionRow key={q.id} question={q} usedIn={gamesUsing(q.id, library.games).length} />
      ))}
      {shown.length === 0 && <Muted>No questions match. Try another search, or write a new one.</Muted>}
    </Screen>
  );
}

function QuestionRow({ question: q, usedIn }: { question: BankQuestion; usedIn: number }) {
  const answer =
    q.answerType === 'numeric' ? String(q.correctNumber) : (q.choices?.find((c) => c.id === q.correctChoiceId)?.text ?? '');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/questions/${q.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.text}>{q.text}</Text>
      <View style={styles.meta}>
        <Text style={styles.badge}>{q.answerType === 'numeric' ? 'Number' : 'Multiple choice'}</Text>
        <Text style={styles.answer} numberOfLines={1}>Answer: {answer}</Text>
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
  text: { fontSize: text.md, fontWeight: weight.semibold, color: color.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  badge: {
    fontSize: text.xs,
    fontWeight: weight.semibold,
    color: color.primary,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.pill,
    borderWidth: size.borderWidth,
    borderColor: color.primary,
  },
  answer: { flex: 1, fontSize: text.sm, color: color.success, fontWeight: weight.semibold },
});
