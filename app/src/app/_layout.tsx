import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useFonts } from 'expo-font';
import type { ReactNode } from 'react';
import { aiConfigured, CLERK_PUBLISHABLE_KEY } from '../ai/settings';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { initDatabase } from '../data/db';
import { color, font, text, tracking } from '../theme';

initDatabase();

/** Fonts ship inside the app (spec §2.3); screens wait for them so nothing flashes in a system font. */
const FONTS = {
  [font.sign]: require('../../assets/fonts/TiltNeon-Regular.ttf'),
  [font.display]: require('../../assets/fonts/BigShouldersDisplay-Black.ttf'),
  [font.displayBold]: require('../../assets/fonts/BigShouldersDisplay-ExtraBold.ttf'),
  [font.body]: require('../../assets/fonts/Manrope-Regular.ttf'),
  [font.bodySemi]: require('../../assets/fonts/Manrope-SemiBold.ttf'),
  [font.bodyBold]: require('../../assets/fonts/Manrope-ExtraBold.ttf'),
};

export default function Layout() {
  const [loaded] = useFonts(FONTS);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  return (
    <Accounts>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.violetLight,
          headerTitleStyle: { fontFamily: font.display, fontSize: text.xl, color: color.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: color.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="battery" options={{ title: 'BEFORE YOU HOST' }} />
        <Stack.Screen name="lobby" options={{ title: 'LOBBY' }} />
        <Stack.Screen name="join-help" options={{ title: 'GET PLAYERS IN', presentation: 'modal' }} />
        <Stack.Screen name="game" options={{ title: 'HOSTING', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="questions/[id]" options={{ title: 'QUESTION' }} />
        <Stack.Screen name="ai-write" options={{ title: 'WRITE WITH AI' }} />
        <Stack.Screen name="games/create-with-ai" options={{ title: 'GAME WITH AI' }} />
        <Stack.Screen name="sign-in" options={{ title: 'SIGN IN', presentation: 'modal' }} />
        <Stack.Screen name="results/[id]" options={{ title: 'RESULTS' }} />
        {/* The wizard has its own stack and headers. */}
        <Stack.Screen name="games/[id]" options={{ headerShown: false }} />
      </Stack>
    </Accounts>
  );
}

/** Sign-in exists only for AI questions (spec §8); a build without its settings skips it entirely. */
function Accounts({ children }: { children: ReactNode }) {
  if (!aiConfigured) return <>{children}</>;
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      {children}
    </ClerkProvider>
  );
}
