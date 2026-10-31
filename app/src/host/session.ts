import { router } from 'expo-router';
import { disconnectHost } from './connection';
import { stopServer } from './server';

/** Lights out: back to the home screen, then stop the server once players have heard "ended". */
export function closeSession(): void {
  router.replace('/');
  // Give the players' pages a moment to receive the final state before the server goes away.
  setTimeout(() => {
    disconnectHost();
    stopServer();
  }, 1500);
}
