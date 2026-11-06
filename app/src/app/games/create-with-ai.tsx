import { router } from 'expo-router';
import { useState } from 'react';
import type { Style } from '../../../../protocol/src';
import { AiFill } from '../../components/AiFill';
import { Field, OptionCard } from '../../components/form';
import { Button, Card, Muted, Screen } from '../../components/ui';
import { Stepper } from '../../components/wizard';
import { games } from '../../data/db';
import { libraryChanged } from '../../data/library';
import type { GameFormat } from '../../data/types';
import { plural, SCORINGS, STYLES } from '../../game/copy';
import { MAX_TITLE, newGameId, newRound } from '../../game/format';

const STYLE_ORDER: Style[] = ['multipleChoice', 'closestWithoutGoingOver', 'fastestFinger'];
const MAX_AI_ROUNDS = 6;

/**
 * The short way to a new game (spec §5.2): a name, the size and the style, then AI writes every
 * question and the host checks them. Everything can still be changed later in the wizard.
 */
export default function CreateWithAi() {
  const [title, setTitle] = useState('');
  const [rounds, setRounds] = useState(3);
  const [perRound, setPerRound] = useState(5);
  const [style, setStyle] = useState<Style>('multipleChoice');
  const [game, setGame] = useState<GameFormat | null>(null);


  if (game) {
    return (
      <Screen form>
        <AiFill
          game={game}
          topic={game.title}
          onSaved={(filled) => {
            games.save(filled);
            libraryChanged();
            router.replace('/games');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen form>
      <Card title="A new game, written by AI">
        <Field label="Game name" value={title} onChangeText={setTitle} placeholder="Friday pub quiz" maxLength={MAX_TITLE} autoFocus />
        <Stepper label="Rounds" value={rounds} min={1} max={MAX_AI_ROUNDS} onChange={setRounds} unit={(n) => plural(n, 'round')} />
        <Stepper label="Questions per round" value={perRound} min={1} max={20} onChange={setPerRound} />
      </Card>
      <Card title="How players answer">
        {STYLE_ORDER.map((s) => (
          <OptionCard key={s} title={STYLES[s].name} description={STYLES[s].description} selected={style === s} onPress={() => setStyle(s)} />
        ))}
      </Card>
      <Muted>
        Scoring: {SCORINGS.allOrNothing.name.toLowerCase()}. You can change anything later in Games → Edit, including each round's style and timing.
      </Muted>
      <Button
        big
        label="Next: topics"
        disabled={!title.trim()}
        onPress={() =>
          setGame({
            id: newGameId(),
            title: title.trim(),
            scoring: 'allOrNothing',
            closeEarly: false,
            rounds: Array.from({ length: rounds }, () => newRound(style, perRound)),
          })
        }
      />
    </Screen>
  );
}
