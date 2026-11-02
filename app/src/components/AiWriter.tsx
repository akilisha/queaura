import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AiError, call, describeBalance } from '../ai/api';
import { useBackend } from '../ai/useBalance';
import { avoidFor, MAX_PER_REQUEST, MAX_TOPIC, toBank, type AnswerChoice, type Difficulty, type GenerateRequest, type GenerateResponse, type GeneratedQuestion } from '../ai/write';
import { useLibrary } from '../data/library';
import type { BankQuestion } from '../data/types';
import { newQuestionId } from '../game/question';
import { color, font, radius, space, text } from '../theme';
import { Chips, Field } from './form';
import { Body, Button, Card, ErrorText, Muted } from './ui';
import { Stepper } from './wizard';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'mixed', label: 'A mix' },
];
const ANSWER_TYPES: { value: AnswerChoice; label: string }[] = [
  { value: 'multipleChoice', label: 'Multiple choice' },
  { value: 'numeric', label: 'Number' },
  { value: 'mixed', label: 'A mix' },
];

/**
 * Asks AI for questions, then lets the host keep or leave out each one before anything is saved
 * (spec §5.3, §8). Used on its own (into the bank) and by the wizard (to fill a round's slots),
 * which fixes how many and which answer type fits.
 */
export function AiWriter({
  count: fixedCount,
  answerType: fixedType,
  topic: initialTopic = '',
  saveLabel = (n) => `Save ${n} ${n === 1 ? 'question' : 'questions'}`,
  saveNote,
  onSaved,
}: {
  count?: number;
  answerType?: AnswerChoice;
  topic?: string;
  saveLabel?: (n: number) => string;
  /** A line under the save button saying where the questions go. */
  saveNote?: string;
  onSaved: (saved: BankQuestion[]) => void;
}) {
  const { isSignedIn } = useAuth();
  const backend = useBackend();
  const library = useLibrary();
  const [topic, setTopic] = useState(initialTopic);
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [answerType, setAnswerType] = useState<AnswerChoice>(fixedType ?? 'multipleChoice');
  const [count, setCount] = useState(Math.min(fixedCount ?? 10, MAX_PER_REQUEST));
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [leftOut, setLeftOut] = useState<Set<number>>(new Set());

  if (!isSignedIn) {
    return (
      <Card title="Sign in first">
        <Body>AI questions need you to sign in, so your AI games are kept track of.</Body>
        <Button big label="Sign in" onPress={() => router.push('/sign-in')} />
      </Card>
    );
  }

  const write = async () => {
    setWriting(true);
    setError(null);
    const request: GenerateRequest = { topic: topic.trim(), difficulty, answerType, count, avoid: avoidFor(library.questions, topic) };
    try {
      const response = await call<GenerateResponse>(backend, '/v1/generate', request);
      setResult(response);
      setLeftOut(new Set());
    } catch (e) {
      setError(e instanceof AiError ? e.message : `Something went wrong in the app (${e instanceof Error ? e.message : String(e)}). Please try again.`);
    } finally {
      setWriting(false);
    }
  };

  if (result) {
    const kept = result.questions.filter((_, i) => !leftOut.has(i));
    const toggle = (i: number) => {
      const next = new Set(leftOut);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      setLeftOut(next);
    };
    return (
      <>
        <Card title="Check the questions">
          <Body>
            {result.questions.length < count
              ? `The AI wrote ${result.questions.length} of the ${count} asked for; the rest didn't pass our checks and weren't counted.`
              : `Here are ${count} questions on "${topic.trim()}".`}{' '}
            Keep the ones you like. Questions you leave out still count toward your AI game.
          </Body>
          <Muted>{describeBalance({ ...result.balance, questionsPerAiGame: 0 })}</Muted>
        </Card>
        {result.questions.map((q, i) => (
          <Card key={i}>
            <Text style={[styles.question, leftOut.has(i) && styles.dropped]}>{q.text}</Text>
            <Answer question={q} />
            {q.explanation ? <Muted>{q.explanation}</Muted> : null}
            <Chips
              options={[
                { value: 'keep', label: 'Keep' },
                { value: 'out', label: 'Leave out' },
              ]}
              value={leftOut.has(i) ? 'out' : 'keep'}
              onChange={() => toggle(i)}
            />
          </Card>
        ))}
        <Button big label={saveLabel(kept.length)} disabled={kept.length === 0} onPress={() => onSaved(toBank(kept, newQuestionId))} />
        {saveNote && <Muted>{saveNote}</Muted>}
        <Button tone="secondary" label="Start over" onPress={() => setResult(null)} />
      </>
    );
  }

  return (
    <Card title="Write questions with AI">
      <Field label="Topic" value={topic} onChangeText={setTopic} placeholder="The solar system" maxLength={MAX_TOPIC} autoFocus={!initialTopic} />
      <Text style={styles.label}>Difficulty</Text>
      <Chips options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
      {fixedType ? (
        <Muted>{fixedType === 'numeric' ? 'Number answers, to fit this round.' : fixedType === 'multipleChoice' ? 'Multiple choice, to fit this round.' : ''}</Muted>
      ) : (
        <>
          <Text style={styles.label}>Answers</Text>
          <Chips options={ANSWER_TYPES} value={answerType} onChange={setAnswerType} />
        </>
      )}
      {fixedCount === undefined ? (
        <Stepper label="Questions" value={count} min={1} max={MAX_PER_REQUEST} onChange={setCount} />
      ) : (
        <Muted>
          {count} {count === 1 ? 'question' : 'questions'}, one for each empty slot.
        </Muted>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <Button big label={writing ? 'Writing… (up to a minute)' : 'Write questions'} disabled={writing || !topic.trim()} onPress={write} />
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
  label: { fontSize: text.md, fontFamily: font.bodySemi, color: color.text },
  question: { fontSize: text.lg, fontFamily: font.bodySemi, color: color.text },
  dropped: { color: color.textMuted, textDecorationLine: 'line-through' },
  answer: { fontSize: text.md, fontFamily: font.bodyBold, color: color.success },
  choices: { gap: space[1], padding: space[3], borderRadius: radius.md, backgroundColor: color.surfaceRaised },
  choice: { fontSize: text.md, fontFamily: font.body, color: color.text },
  right: { fontSize: text.md, fontFamily: font.bodyBold, color: color.success },
});
