import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

export default function TodayScreen() {
  const { session } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.wordmark}>COVARIFY</Text>
        <Text style={styles.eyebrow}>FINANCIAL CLARITY</Text>
        <Text style={styles.title}>Understand what matters.</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PROJECT POCKET</Text>
          <Text style={styles.cardTitle}>
            Your Money Picture will appear here.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.lavenderBackground },
  content: { flex: 1, padding: 24, paddingTop: 48 },
  wordmark: {
    color: colors.plum,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 2.4,
  },
  eyebrow: {
    marginTop: 42,
    color: colors.purple,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.7,
  },
  title: {
    maxWidth: 330,
    marginTop: 12,
    color: colors.plum,
    fontSize: 40,
    lineHeight: 44,
  },
  email: { marginTop: 16, color: colors.muted, fontSize: 14 },
  card: {
    marginTop: 40,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.white,
  },
  cardLabel: {
    color: colors.purple,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  cardTitle: {
    marginTop: 20,
    color: colors.plum,
    fontSize: 26,
    lineHeight: 34,
  },
});
