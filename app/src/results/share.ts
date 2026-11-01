import * as Sharing from 'expo-sharing';
import GameServer from '../../modules/game-server/src/GameServerModule';
import { csvName, toCsv, type QuestionnaireResult } from './results';

/**
 * Builds the CSV and opens Android's share sheet (spec §6.4): email, Drive, messaging and so on,
 * through the host's own accounts. The file is written to the app's cache; nothing goes through
 * any server of ours.
 */
export async function shareCsv(r: QuestionnaireResult): Promise<void> {
  const uri = GameServer.writeShareFile(csvName(r), toCsv(r));
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: `Share "${r.title}"` });
}
