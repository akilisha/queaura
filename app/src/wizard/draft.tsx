import { createContext, useContext, useState, type ReactNode } from 'react';
import { games } from '../data/db';
import { libraryChanged } from '../data/library';
import type { GameFormat } from '../data/types';

// The game being created or edited, shared by every step of the wizard. Steps read it and
// replace it with the rules in game/format.ts; nothing is stored until the host saves.

interface Wizard {
  draft: GameFormat;
  setDraft: (next: GameFormat) => void;
  isNew: boolean;
  /** Changed since it was opened (asks before discarding). */
  dirty: boolean;
  /** Saved and on the way out of the wizard. */
  closing: boolean;
  saveAndClose: () => void;
}

const Context = createContext<Wizard | null>(null);

export function WizardProvider({ initial, isNew, children }: { initial: GameFormat; isNew: boolean; children: ReactNode }) {
  const [draft, setDraftState] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [closing, setClosing] = useState(false);
  const value: Wizard = {
    draft,
    isNew,
    dirty,
    closing,
    setDraft: (next) => {
      setDraftState(next);
      setDirty(true);
    },
    saveAndClose: () => {
      games.save({ ...draft, title: draft.title.trim() });
      libraryChanged();
      setDirty(false);
      setClosing(true);
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWizard(): Wizard {
  const wizard = useContext(Context);
  if (!wizard) throw new Error('useWizard outside the game wizard');
  return wizard;
}
