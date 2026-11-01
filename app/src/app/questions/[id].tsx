import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useConfirm } from '../../components/ConfirmDialog';
import { Chips, Field, OptionCard } from '../../components/form';
import { Button, Card, ErrorText, Muted, Screen } from '../../components/ui';
import { questions } from '../../data/db';
import { libraryChanged, useLibrary } from '../../data/library';
import { gamesUsing } from '../../data/usage';
import { blockedMessage } from '../../game/copy';
import GameServer from '../../../modules/game-server/src/GameServerModule';
import {
  MAX_CHOICE,
  MAX_CHOICES,
  MAX_EXPLANATION,
  MAX_TEXT,
  MIN_CHOICES,
  draftOf,
  emptyDraft,
  newQuestionId,
  problemsOf,
  toQuestion,
  type QuestionDraft,
} from '../../game/question';
import { color, font, radius, size, space, text } from '../../theme';

/** The first word the on-device list refuses (spec §9), in the parts of the draft that are kept. */
function blockedWord(d: QuestionDraft): string | null {
  const parts = [d.text];
  if (d.answerType === 'multipleChoice') parts.push(...d.choices);
  if (d.answerType !== 'freeText' && d.graded) parts.push(d.explanation);
  for (const part of parts) {
    const word = part.trim() ? GameServer.findBlocked(part) : null;
    if (word) return word;
  }
  return null;
}

/** Write or edit one question by hand (spec §5.3). `/questions/new` starts a blank one. */
export default function EditQuestion() {
  // `type` starts a new question on an answer type (the game wizard asks for numbers in closest-guess rounds).
  // `survey` starts it without a right answer (written from a questionnaire's slot).
  const { id, type, survey } = useLocalSearchParams<{ id: string; type?: string; survey?: string }>();
  const library = useLibrary();
  const existing = id === 'new' ? undefined : library.byId.get(id);
  const [draft, setDraft] = useState<QuestionDraft>(() => (existing ? draftOf(existing) : { ...emptyDraft(), answerType: type === 'multipleChoice' || type === 'freeText' ? type : 'numeric', graded: survey !== '1' }));
  const [triedSave, setTriedSave] = useState(false);
  const [dialog, confirm] = useConfirm();
  const blocked = blockedWord(draft);
  const problems = [...problemsOf(draft), ...(blocked ? [blockedMessage(blocked, 'questions')] : [])];
  const usedIn = existing ? gamesUsing(existing.id, library.games) : [];

  const set = (patch: Partial<QuestionDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    setTriedSave(true);
    if (problems.length > 0) return;
    questions.save(toQuestion(draft, existing?.id ?? newQuestionId(), existing));
    libraryChanged();
    router.back();
  };

  const remove = () =>
    confirm({
      title: 'Delete this question?',
      message:
        usedIn.length === 0
          ? 'It is not in any game.'
          : `It is in ${usedIn.map((g) => `"${g.title}"`).join(', ')}. ${usedIn.length === 1 ? 'That game' : 'Those games'} will have an empty slot to fill before ${usedIn.length === 1 ? 'it' : 'they'} can be played.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        questions.remove(existing!.id);
        libraryChanged();
        router.back();
      },
    });

  const setChoice = (i: number, value: string) => set({ choices: draft.choices.map((c, j) => (j === i ? value : c)) });
  const removeChoice = (i: number) =>
    set({
      choices: draft.choices.filter((_, j) => j !== i),
      correctIndex: draft.correctIndex === i ? null : draft.correctIndex !== null && draft.correctIndex > i ? draft.correctIndex - 1 : draft.correctIndex,
    });

  if (id !== 'new' && !existing) {
    return (
      <Screen form>
        <Muted>This question no longer exists.</Muted>
      </Screen>
    );
  }

  return (
    <Screen form>
      <Stack.Screen options={{ title: existing ? 'EDIT QUESTION' : 'NEW QUESTION' }} />
      {dialog}
      <Card>
        <Field
          label="Question"
          value={draft.text}
          onChangeText={(t) => set({ text: t })}
          placeholder="How many keys are on a standard piano?"
          maxLength={MAX_TEXT}
          multiline
          autoFocus={!existing}
        />
      </Card>
      <Card title="How do players answer?">
        <OptionCard
          title="With a number"
          description="Players type a number. Works in closest-without-going-over rounds, and in multiple-choice rounds with made-up wrong answers."
          selected={draft.answerType === 'numeric'}
          onPress={() => set({ answerType: 'numeric' })}
        />
        <OptionCard
          title="By picking an answer"
          description={`Players tap one of ${MIN_CHOICES} to ${MAX_CHOICES} answers you write. Works in multiple-choice rounds.`}
          selected={draft.answerType === 'multipleChoice'}
          onPress={() => set({ answerType: 'multipleChoice' })}
        />
        <OptionCard
          title="In their own words"
          description="Players type a short answer. For questionnaires only: nothing is marked right or wrong."
          selected={draft.answerType === 'freeText'}
          onPress={() => set({ answerType: 'freeText' })}
        />
      </Card>
      {draft.answerType !== 'freeText' && (
        <Card title="The answer">
          <Text style={styles.label}>Is there a right answer?</Text>
          <Chips
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No, it asks for an opinion' },
            ]}
            value={draft.graded ? 'yes' : 'no'}
            onChange={(v) => set({ graded: v === 'yes' })}
          />
          {!draft.graded && <Muted>For questionnaires only: nothing is marked right or wrong.</Muted>}
          {draft.answerType === 'numeric' && draft.graded && (
            <Field
              label="Correct number"
              value={draft.number}
              onChangeText={(n) => set({ number: n })}
              placeholder="88"
              keyboardType="numeric"
              hint="Decimals and negative numbers are fine."
            />
          )}
          {draft.answerType === 'numeric' && !draft.graded && <Muted>Players type any number.</Muted>}
          {draft.answerType === 'multipleChoice' && (
            <>
              <Muted>
                {draft.graded ? 'Write the answers players choose from, and tap the circle next to the right one.' : 'Write the answers players choose from.'}
              </Muted>
              {draft.choices.map((choice, i) => (
                <View key={i} style={styles.choice}>
                  {draft.graded && (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={`Answer ${i + 1} is right`}
                      accessibilityState={{ checked: draft.correctIndex === i }}
                      onPress={() => set({ correctIndex: i })}
                      style={[styles.mark, draft.correctIndex === i && styles.markChosen]}
                    >
                      {draft.correctIndex === i && <Text style={styles.check}>✓</Text>}
                    </Pressable>
                  )}
                  <TextInput
                    style={styles.choiceInput}
                    value={choice}
                    onChangeText={(t) => setChoice(i, t)}
                    placeholder={`Answer ${i + 1}`}
                    placeholderTextColor={color.textMuted}
                    maxLength={MAX_CHOICE}
                    accessibilityLabel={`Answer ${i + 1}`}
                  />
                  {draft.choices.length > MIN_CHOICES && (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove answer ${i + 1}`} onPress={() => removeChoice(i)} style={styles.remove}>
                      <Text style={styles.removeLabel}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              {draft.choices.length < MAX_CHOICES && (
                <Button tone="secondary" label="Add another answer" onPress={() => set({ choices: [...draft.choices, ''] })} />
              )}
            </>
          )}
        </Card>
      )}
      {draft.answerType !== 'freeText' && draft.graded && (
        <Card>
          <Field
            label="Explanation (optional)"
            value={draft.explanation}
            onChangeText={(e) => set({ explanation: e })}
            placeholder="52 white keys and 36 black keys."
            hint="Shown with the answer, on the TV and players' phones."
            maxLength={MAX_EXPLANATION}
            multiline
          />
        </Card>
      )}
      {triedSave && problems.map((p) => <ErrorText key={p}>{p}</ErrorText>)}
      <Button big label="Save question" onPress={save} />
      {existing && <Button tone="secondary" label="Delete question" onPress={remove} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: text.md, fontFamily: font.bodySemi, color: color.text },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  mark: {
    width: size.tapMin,
    height: size.tapMin,
    borderRadius: radius.pill,
    borderWidth: size.radioBorder,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markChosen: { backgroundColor: color.success, borderColor: color.success },
  check: { color: color.onPrimary, fontSize: text.lg, fontFamily: font.bodyBold },
  choiceInput: {
    flex: 1,
    minHeight: size.tapMin,
    paddingHorizontal: space[3],
    borderWidth: size.borderWidth,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
    fontFamily: font.body, fontSize: text.md,
    color: color.text,
  },
  remove: { width: size.tapMin, height: size.tapMin, alignItems: 'center', justifyContent: 'center' },
  removeLabel: { fontFamily: font.body, fontSize: text.lg, color: color.textMuted },
});
