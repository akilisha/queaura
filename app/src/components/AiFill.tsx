import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AiError, call, describeBalance } from '../ai/api';
import { useBackend, useBalance } from '../ai/useBalance';
import { answerTypeFor, avoidFor, MAX_PER_REQUEST, MAX_TOPIC, toBank, type Difficulty, type GenerateResponse, type GeneratedQuestion } from '../ai/write';
import { questions as questionStore } from '../data/db';
import { libraryChanged, useLibrary } from '../data/library';
import type { GameFormat } from '../data/types';
import { STYLES } from '../game/copy';
import { emptyIn, placeInRounds } from '../game/fill';
import { newQuestionId } from '../game/question';
import { color, font, text } from '../theme';
import { ReviewItem } from './AiReview';
import { DIFFICULTIES } from './AiWriter';
import { Chips, Field } from './form';
import { Body, Button, Card, ErrorText, Muted } from './ui';

interface RoundPlan {
  round: number;
  count: number;
}

interface RoundResult {
  round: number;
  topic: string;
  questions: GeneratedQuestion[];
  error?: string;
}

/**
 * Fills every empty slot in a game with AI questions in one go (spec §5.2, §5.3): one topic for
 * the whole game or one per round, each round written with answers that fit its style, then one
 * review of everything before it's saved.
 */
export function AiFill({ game, topic: suggested, onSaved }: { game: GameFormat; topic: string; onSaved: (game: GameFormat) => void }) {
  const { isSignedIn } = useAuth();
  const backend = useBackend();
  const library = useLibrary();
  const { balance } = useBalance();
  const plan: RoundPlan[] = game.rounds
    .map((_, round) => ({ round, count: Math.min(emptyIn(game, round, library.byId).length, MAX_PER_REQUEST) }))
    .filter((p) => p.count > 0);
  const [perRound, setPerRound] = useState(false);
  const [topic, setTopic] = useState(suggested);
  const [topics, setTopics] = useState<Record<number, string>>({});
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<RoundResult[] | null>(null);
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set());

  if (!isSignedIn) {
    return (
      <Card title="Sign in first">
        <Body>AI questions need you to sign in, so your AI games are kept track of.</Body>
        <Button big label="Sign in" onPress={() => router.push('/sign-in')} />
      </Card>
    );
  }
  if (plan.length === 0) return <Muted>Every slot is already filled.</Muted>;

  const total = plan.reduce((n, p) => n + p.count, 0);
  const topicOf = (round: number) => (perRound ? (topics[round] ?? '') : topic).trim();
  const ready = plan.every((p) => topicOf(p.round) !== '');

  // One round at a time, so each can avoid repeating the rounds before it on the same topic.
  const write = async () => {
    const done: RoundResult[] = [];
    const written: string[] = [];
    for (const [i, p] of plan.entries()) {
      setProgress(`Writing round ${p.round + 1} (${i + 1} of ${plan.length})…`);
      const t = topicOf(p.round);
      try {
        const response = await call<GenerateResponse>(backend, '/v1/generate', {
          topic: t,
          difficulty,
          answerType: answerTypeFor(game.rounds[p.round].style),
          count: p.count,
          avoid: [...avoidFor(library.questions, t), ...written].slice(-50),
        });
        written.push(...response.questions.map((q) => q.text));
        done.push({ round: p.round, topic: t, questions: response.questions });
      } catch (e) {
        done.push({ round: p.round, topic: t, questions: [], error: e instanceof AiError ? e.message : 'Something went wrong. Please try again.' });
        // No AI games left: the later rounds would fail the same way.
        if (e instanceof AiError && e.status === 402) break;
      }
    }
    setProgress(null);
    setLeftOut(new Set());
    setResults(done);
  };

  if (results) {
    const key = (r: number, i: number) => `${r}:${i}`;
    const keptCount = results.reduce((n, r) => n + r.questions.filter((_, i) => !leftOut.has(key(r.round, i))).length, 0);
    const toggle = (k: string) => {
      const next = new Set(leftOut);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      setLeftOut(next);
    };
    const save = () => {
      const keptByRound: Record<number, string[]> = {};
      for (const r of results) {
        const kept = toBank(
          r.questions.filter((_, i) => !leftOut.has(key(r.round, i))),
          newQuestionId,
        );
        for (const q of kept) questionStore.save(q);
        keptByRound[r.round] = kept.map((q) => q.id);
      }
      libraryChanged();
      onSaved(placeInRounds(game, library.byId, keptByRound));
    };
    return (
      <>
        <Card title="Check the questions">
          <Body>Keep the ones you like; any you leave out leave their slot empty. Questions you leave out still count toward your AI game.</Body>
        </Card>
        {results.map((r) => (
          <Card key={r.round} title={`Round ${r.round + 1} · ${STYLES[game.rounds[r.round].style].name} · ${r.topic}`}>
            {r.error && <ErrorText>{r.error}</ErrorText>}
            {r.error?.includes('no AI games left') && <Button label="Get more AI games" onPress={() => router.push('/get-ai-games')} />}
            {!r.error && r.questions.length < (plan.find((p) => p.round === r.round)?.count ?? 0) && (
              <Muted>Some questions didn't pass our checks and weren't counted; their slots stay empty.</Muted>
            )}
            {r.questions.map((q, i) => (
              <ReviewItem key={i} question={q} kept={!leftOut.has(key(r.round, i))} onToggle={() => toggle(key(r.round, i))} />
            ))}
          </Card>
        ))}
        <Button big label={`Put ${keptCount} ${keptCount === 1 ? 'question' : 'questions'} in the game`} disabled={keptCount === 0} onPress={save} />
        <Muted>They're also saved to your questions, so you keep them even if you don't save this game.</Muted>
        <Button tone="secondary" label="Start over" onPress={() => setResults(null)} />
      </>
    );
  }

  return (
    <Card title="Fill the game with AI">
      <Body>
        {total} empty {total === 1 ? 'slot' : 'slots'} in {plan.length} {plan.length === 1 ? 'round' : 'rounds'}. Each round gets questions that fit its style.
      </Body>
      {plan.length > 1 && (
        <Chips
          options={[
            { value: 'one', label: 'One topic' },
            { value: 'each', label: 'A topic for each round' },
          ]}
          value={perRound ? 'each' : 'one'}
          onChange={(v) => setPerRound(v === 'each')}
        />
      )}
      {perRound ? (
        plan.map((p) => (
          <Field
            key={p.round}
            label={`Round ${p.round + 1}: ${STYLES[game.rounds[p.round].style].name}, ${p.count} ${p.count === 1 ? 'question' : 'questions'}`}
            value={topics[p.round] ?? ''}
            onChangeText={(v) => setTopics({ ...topics, [p.round]: v })}
            placeholder="Topic"
            maxLength={MAX_TOPIC}
          />
        ))
      ) : (
        <Field label="Topic" value={topic} onChangeText={setTopic} placeholder="The solar system" maxLength={MAX_TOPIC} />
      )}
      <Text style={styles.label}>Difficulty</Text>
      <Chips options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
      <Muted>
        Uses {total} of your AI questions ({balance ? describeBalance(balance) : 'checking your AI games…'}). An AI game holds{' '}
        {balance?.questionsPerAiGame ?? 50}.
      </Muted>
      {progress && <Muted>{progress} About 10 seconds a round.</Muted>}
      <Button big label={progress ? 'Writing…' : 'Write questions'} disabled={progress !== null || !ready} onPress={write} />
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: text.md, fontFamily: font.bodySemi, color: color.text },
});
