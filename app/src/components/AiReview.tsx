import { StyleSheet, Text, View } from 'react-native';
import type { GeneratedQuestion } from '../ai/write';
import { color, font, radius, space, text } from '../theme';
import { Chips } from './form';
import { Card, Muted } from './ui';

/** One AI question to check: the question, its right answer, its explanation, keep or leave out. */
export function ReviewItem({ question: q, kept, onToggle }: { question: GeneratedQuestion; kept: boolean; onToggle: () => void }) {
  return (
    <Card>
      <Text style={[styles.question, !kept && styles.dropped]}>{q.text}</Text>
      <Answer question={q} />
      {q.explanation ? <Muted>{q.explanation}</Muted> : null}
      <Chips
        options={[
          { value: 'keep', label: 'Keep' },
          { value: 'out', label: 'Leave out' },
        ]}
        value={kept ? 'keep' : 'out'}
        onChange={onToggle}
      />
    </Card>
  );
}

/** The right answer as the host checks it: the number, or the choices with the right one marked. */
function Answer({ question: q }: { question: GeneratedQuestion }) {
  if (q.answerType === 'numeric') return <Text style={styles.answer}>Answer: {q.correctNumber}</Text>;
  return (
    <View style={styles.choices}>
      {(q.choices ?? []).map((c) => (
        <Text key={c.id} style={c.id === q.correctChoiceId ? styles.right : styles.choice}>
          {c.id === q.correctChoiceId ? '✓ ' : '• '}
          {c.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  question: { fontSize: text.lg, fontFamily: font.bodySemi, color: color.text },
  dropped: { color: color.textMuted, textDecorationLine: 'line-through' },
  answer: { fontSize: text.md, fontFamily: font.bodyBold, color: color.success },
  choices: { gap: space[1], padding: space[3], borderRadius: radius.md, backgroundColor: color.surfaceRaised },
  choice: { fontSize: text.md, fontFamily: font.body, color: color.text },
  right: { fontSize: text.md, fontFamily: font.bodyBold, color: color.success },
});
