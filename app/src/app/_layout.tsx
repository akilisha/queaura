import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../data/db';
import { color, text, weight } from '../theme';

initDatabase();

export default function Layout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.bg },
          headerTitleStyle: { fontSize: text.lg, fontWeight: weight.bold, color: color.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: color.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Triviocity' }} />
        <Stack.Screen name="lobby" options={{ title: 'Lobby' }} />
        <Stack.Screen name="game" options={{ title: 'Hosting', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="questions/index" options={{ title: 'Your questions' }} />
        <Stack.Screen name="questions/[id]" options={{ title: 'Question' }} />
        <Stack.Screen name="games/index" options={{ title: 'Your games' }} />
        {/* The wizard has its own stack and headers. */}
        <Stack.Screen name="games/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
