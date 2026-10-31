import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Durations, Style } from '../../../../../protocol/src';
import { Chips, OptionCard } from '../../../components/form';
import { Button, Card, Muted, Screen } from '../../../components/ui';
import { NextButton, StepFooter, StepHeader, Stepper } from '../../../components/wizard';
import { useLibrary } from '../../../data/library';
import type { RoundFormat } from '../../../data/types';
import { plural, STYLES } from '../../../game/copy';
import { ANSWER_SECONDS, DEFAULT_SECONDS, MAX_QUESTIONS, READING_SECONDS, withDurations, withQuestionCount, withStyle } from '../../../game/format';
import { color, text, weight } from '../../../theme';
import { useWizard } from '../../../wizard/draft';

const STYLE_ORDER: Style[] = ['closestWithoutGoingOver', 'multipleChoice'];

/** Step 2: each round's style, number of questions and (optionally) timing. */
export default function RoundsStep() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft } = useWizard();
  const library = useLibrary();
  // Per round: how many filled slots a style change emptied, so the host is told.
  const [cleared, setCleared] = useState<Record<number, number>>({});

  const chooseStyle = (round: number, style: Style) => {
    const result = withStyle(draft, round, style, library.byId);
    setDraft(result.game);
    setCleared({ ...cleared, [round]: result.cleared });
  };

  return (
    <Screen>
      <StepHeader step={2} title="Set up the rounds" intro="Choose how players answer in each round, and how many questions it has." />
      {draft.rounds.map((round, i) => (
        <Card key={i} title={`Round ${i + 1}`}>
          {STYLE_ORDER.map((style) => (
            <OptionCard
              key={style}
              title={STYLES[style].name}
              description={STYLES[style].description}
              selected={round.style === style}
              onPress={() => chooseStyle(i, style)}
            />
          ))}
          {cleared[i] > 0 && (
            <Muted>
              {plural(cleared[i], 'question')} with picked answers {cleared[i] === 1 ? 'was' : 'were'} taken out: {cleared[i] === 1 ? 'it needs' : 'they need'} a number answer in this style.
            </Muted>
          )}
          <Stepper
            label="Questions"
            value={round.slots.length}
            min={1}
            max={MAX_QUESTIONS}
            onChange={(n) => setDraft(withQuestionCount(draft, i, n))}
          />
          <Timing round={round} onChange={(patch) => setDraft(withDurations(draft, i, patch))} />
        </Card>
      ))}
      <StepFooter>
        <NextButton onPress={() => router.push(`/games/${id}/scoring`)} />
      </StepFooter>
    </Screen>
  );
}

/** Collapsed by default: the defaults suit most games (spec §6.3). */
function Timing({ round, onChange }: { round: RoundFormat; onChange: (patch: Durations) => void }) {
  const [open, setOpen] = useState(round.durations !== undefined);
  const d = round.durations ?? {};
  if (!open) {
    const answer = (d.answerMs ?? DEFAULT_SECONDS.answer * 1000) / 1000;
    return (
      <>
        <Muted>{answer} seconds to answer each question.</Muted>
        <Button tone="secondary" label="Adjust timing" onPress={() => setOpen(true)} />
      </>
    );
  }
  const seconds = (ms: number | undefined) => (ms === undefined ? 'default' : String(ms / 1000));
  const toMs = (v: string) => (v === 'default' ? undefined : Number(v) * 1000);
  return (
    <>
      <Text style={styles.label}>Time to answer</Text>
      <Chips
        options={[{ value: 'default', label: `${DEFAULT_SECONDS.answer} s (usual)` }, ...ANSWER_SECONDS.filter((s) => s !== DEFAULT_SECONDS.answer).map((s) => ({ value: String(s), label: `${s} s` }))]}
        value={seconds(d.answerMs)}
        onChange={(v) => onChange({ answerMs: toMs(v) })}
      />
      <Text style={styles.label}>Reading time before the clock starts</Text>
      <Muted>Players can already answer while reading. Automatic gives longer questions more time.</Muted>
      <Chips
        options={[{ value: 'default', label: 'Automatic' }, ...READING_SECONDS.map((s) => ({ value: String(s), label: `${s} s` }))]}
        value={seconds(d.readingMs)}
        onChange={(v) => onChange({ readingMs: toMs(v) })}
      />
      <Text style={styles.label}>Showing the answer</Text>
      <Chips
        options={[{ value: 'default', label: `${DEFAULT_SECONDS.reveal} s (usual)` }, { value: '5', label: '5 s' }, { value: '12', label: '12 s' }]}
        value={seconds(d.revealMs)}
        onChange={(v) => onChange({ revealMs: toMs(v) })}
      />
      <Text style={styles.label}>Break after this round</Text>
      <Chips
        options={[{ value: 'default', label: `${DEFAULT_SECONDS.break} s (usual)` }, { value: '10', label: '10 s' }, { value: '30', label: '30 s' }]}
        value={seconds(d.breakMs)}
        onChange={(v) => onChange({ breakMs: toMs(v) })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: text.md, fontWeight: weight.semibold, color: color.text },
});
