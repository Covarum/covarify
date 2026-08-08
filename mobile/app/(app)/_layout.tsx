import { Redirect, Tabs, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text } from "react-native";

import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

export default function AppLayout() {
  const { isLoading, session } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.purple} />
      </SafeAreaView>
    );
  }

  if (!session) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.white },
        headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile and settings" hitSlop={8} onPress={() => router.push("/(app)/you")} style={styles.profileButton}>
            <Text style={styles.profileText}>Profile</Text>
          </Pressable>
        ),
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="ask" options={{ title: "Ask Covarify" }} />
      <Tabs.Screen name="money" options={{ title: "Money" }} />
      <Tabs.Screen name="decisions" options={{ title: "Decisions" }} />
      <Tabs.Screen name="you" options={{ href: null, title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderBackground,
  },
  profileButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  profileText: { color: colors.purple, fontSize: 16, fontWeight: "600" },
});
