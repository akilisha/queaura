import { useState } from 'preact/hooks';
import type { AnswerValue, QuestionnaireQuestion } from '../../../protocol/src';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ChoiceGrid } from '../components/ChoiceGrid';
import { Keypad } from '../components/Keypad';
import { QRCode } from '../components/QRCode';
import { ScoreList } from '../components/ScoreList';
import { TextArea } from '../components/TextArea';
import { questionnaireAnswer, questionnaireGo } from '../state/actions';
import * as store from '../state/store';
import { GameScreen } from './GameScreen';
import styles from './views.module.css';

/** Free-text limit, matching the server (Engine.MAX_TEXT). */
const MAX_TEXT = 500;

/** Questionnaire (spec §6.4): no timers; players go at their own pace; the TV shows progress. */
export function QuestionnaireView() {
  const g = store.game.value!;
  const total = g.questionnaire!.count;
  if (store.mode.value === 'tv') {
    const url = `http://${location.host}/`;
    return (
      <GameScreen>
        <div class={styles.board}>
          <Card fill>
            <div class={`${styles.join} ${styles.joinPanel}`}>
              <p class={styles.lead}>{g.title}</p>
              <p class={styles.tally}>
                {g.questionnaire!.finished} of {g.scores.length} finished
              </p>
              <QRCode text={url} label={`Join at ${url}`} scale="small" />
              <p class={styles.muted}>Join any time at {location.host}</p>
            </div>
          </Card>
          <Card title="Players" fill>
            <ScoreList players={g.scores} metric="none" />
          </Card>
        </div>
      </GameScreen>
    );
  }

  const mine = g.you?.questionnaire;
  if (!mine) return null;
  return (
    <GameScreen>
      {mine.question ? (
        <Step key={mine.question.index} question={mine.question} saved={mine.answer} total={total} />
      ) : (
        <Card>
          <div class={styles.centered}>
            <p class={styles.headline}>All done!</p>
            <p class={styles.muted}>Your answers are in. You can still change them until the host ends the questionnaire.</p>
          </div>
          <Button variant="secondary" onClick={() => questionnaireGo(0)}>
            Review my answers
          </Button>
        </Card>
      )}
    </GameScreen>
  );
}

function Step({ question: q, saved, total }: { question: QuestionnaireQuestion; saved?: AnswerValue; total: number }) {
  const [text, setText] = useState(saved && 'text' in saved ? saved.text : '');
  const [entry, setEntry] = useState(saved && 'number' in saved ? String(saved.number) : '');
  const last = q.index === total - 1;
  const next = last ? 'Finish' : 'Next';
  return (
    <Card>
      <p class={styles.progress}>
        Question {q.index + 1} of {total}
      </p>
      <p class={styles.question}>{q.text}</p>
      {q.answerType === 'freeText' && (
        <>
          <TextArea label="Your answer" value={text} onInput={setText} maxLength={MAX_TEXT} />
          <Button onClick={() => questionnaireAnswer(q.index, { text })} disabled={!text.trim()}>
            {next}
          </Button>
        </>
      )}
      {q.answerType === 'numeric' && (
        <Keypad value={entry} onChange={setEntry} onSubmit={(n) => questionnaireAnswer(q.index, { number: n })} submitLabel={next} />
      )}
      {q.answerType === 'multipleChoice' && (
        <ChoiceGrid
          choices={q.choices}
          picked={saved && 'choice' in saved ? saved.choice : null}
          onPick={(choice) => questionnaireAnswer(q.index, { choice })}
        />
      )}
      {q.index > 0 && (
        <Button variant="secondary" onClick={() => questionnaireGo(q.index - 1)}>
          Back
        </Button>
      )}
    </Card>
  );
}
