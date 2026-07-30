import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";

import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

export default function AppLayout() {
  const { isLoading, session } = useAuth();

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
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="money" options={{ title: "Money" }} />
      <Tabs.Screen name="you" options={{ title: "You" }} />
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
});
