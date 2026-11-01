import type { Style } from '../../../protocol/src';

/** Plain-language names and instructions for each presentation style (spec §6.3). */
export const STYLE_INFO: Record<Style, { name: string; howTo: string }> = {
  closestWithoutGoingOver: {
    name: 'Closest without going over',
    howTo: 'Type a number. The closest guess that is not over the real answer wins.',
  },
  multipleChoice: {
    name: 'Multiple choice',
    howTo: 'Tap the right answer before the time runs out.',
  },
  fastestFinger: {
    name: 'Fastest finger',
    howTo: 'Tap the right answer first. The quicker you are, the more points.',
  },
};
