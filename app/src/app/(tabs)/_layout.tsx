import { Tabs } from 'expo-router';
import { TabIcon } from '../../components/TabIcon';
import { color, font, size, text, tracking } from '../../theme';

/** Four jobs, one tap apart: play tonight, your games, your questions, questionnaire results. Hidden while hosting. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.bg },
        headerTitleStyle: { fontFamily: font.display, fontSize: text.xl, color: color.text, letterSpacing: tracking.caps },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border, borderTopWidth: size.borderWidth },
        tabBarActiveTintColor: color.gold,
        tabBarInactiveTintColor: color.textMuted,
        tabBarLabelStyle: { fontFamily: font.bodySemi, fontSize: text.xs },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Play', headerShown: false, tabBarIcon: ({ color: c }) => <TabIcon name="play" color={c} /> }}
      />
      <Tabs.Screen
        name="games"
        options={{ title: 'Games', headerTitle: 'YOUR GAMES', tabBarIcon: ({ color: c }) => <TabIcon name="games" color={c} /> }}
      />
      <Tabs.Screen
        name="questions"
        options={{ title: 'Questions', headerTitle: 'YOUR QUESTIONS', tabBarIcon: ({ color: c }) => <TabIcon name="questions" color={c} /> }}
      />
      <Tabs.Screen
        name="results"
        options={{ title: 'Results', headerTitle: 'QUESTIONNAIRE RESULTS', tabBarIcon: ({ color: c }) => <TabIcon name="results" color={c} /> }}
      />
    </Tabs>
  );
}
