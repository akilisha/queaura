import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useConfirm } from '../../components/ConfirmDialog';
import { Chips } from '../../components/form';
import { Button, Card, ErrorText, Grid, Muted, Screen } from '../../components/ui';
import { results } from '../../data/db';
import { answerText } from '../../results/results';
import { shareCsv } from '../../results/share';
import { deleteResult, summary, useResultsVersion } from '../../results/store';
import { color, font, radius, space, text } from '../../theme';

type Grouping = 'player' | 'question';

/** One saved questionnaire: answers by player or by question, export and delete (spec §6.4). */
export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const version = useResultsVersion();
  const r = useMemo(() => results.all().find((x) => x.id === id), [id, version]);
  const [by, setBy] = useState<Grouping>('player');
  const [shareError, setShareError] = useState<string | null>(null);
  const [dialog, confirm] = useConfirm();

  if (!r) {
    return (
      <Screen>
        <Muted>These results are no longer on this phone.</Muted>
      </Screen>
    );
  }

  const share = () => {
    setShareError(null);
    shareCsv(r).catch((e: unknown) => setShareError(`Could not open sharing: ${e instanceof Error ? e.message : String(e)}`));
  };

  const remove = () =>
    confirm({
      title: 'Delete these results?',
      message: 'They will be removed from this phone. Copies you already shared are not affected. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        deleteResult(r.id);
        router.back();
      },
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'RESULTS' }} />
      {dialog}
      <Card>
        <Text style={styles.title}>{r.title}</Text>
        <Muted>
          {new Date(r.startedAt).toLocaleString()}
          {r.endedAt === null ? ' · recovered after the app stopped' : ''}
        </Muted>
        <Text style={styles.body}>{summary(r)}</Text>
        <Button big label="Export CSV" onPress={share} />
        <Muted>Opens the share sheet: send it by email, save it to Drive, and so on. One row per person, one column per question.</Muted>
        {shareError && <ErrorText>{shareError}</ErrorText>}
      </Card>
      {r.players.length > 0 && (
        <Chips
          options={[
            { value: 'player', label: 'By person' },
            { value: 'question', label: 'By question' },
          ]}
          value={by}
          onChange={setBy}
        />
      )}
      <Grid>
        {by === 'player'
          ? r.players.map((p) => (
              <Card key={p.id} title={`${p.emoji} ${p.name}`}>
                {r.questions.map((q) => (
                  <Answer key={q.id} label={q.text} value={answerText(q, r.responses[p.id]?.[q.id])} />
                ))}
              </Card>
            ))
          : r.questions.map((q, i) => (
              <Card key={q.id} title={`Question ${i + 1}`}>
                <Text style={styles.question}>{q.text}</Text>
                {r.players.map((p) => (
                  <Answer key={p.id} label={`${p.emoji} ${p.name}`} value={answerText(q, r.responses[p.id]?.[q.id])} />
                ))}
              </Card>
            ))}
      </Grid>
      <Button tone="secondary" label="Delete these results" onPress={remove} />
    </Screen>
  );
}

function Answer({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.answer}>
      <Text style={styles.label}>{label}</Text>
      <Text style={value ? styles.value : styles.none}>{value || 'No answer'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: text.lg, fontFamily: font.bodyBold, color: color.text },
  body: { fontSize: text.md, fontFamily: font.body, color: color.text },
  question: { fontSize: text.md, fontFamily: font.bodySemi, color: color.text },
  answer: { padding: space[3], borderRadius: radius.md, backgroundColor: color.surfaceRaised, gap: space[1] },
  label: { fontSize: text.sm, fontFamily: font.bodySemi, color: color.textMuted },
  value: { fontSize: text.md, fontFamily: font.body, color: color.text },
  none: { fontSize: text.md, fontFamily: font.body, color: color.textMuted },
});
