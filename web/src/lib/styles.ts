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
  questionnaire: {
    name: 'Questionnaire',
    howTo: 'Answer at your own pace. You can go back and change answers until the host ends it.',
  },
  fastestFinger: {
    name: 'Fastest finger',
    howTo: 'Tap the right answer first. The quicker you are, the more points.',
  },
};
