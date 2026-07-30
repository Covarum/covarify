import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { colors } from "../../lib/theme";

export default function MoneyScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>MONEY</Text>
        <Text style={styles.title}>Your money story, in one place.</Text>
        <Text style={styles.body}>More financial clarity is coming next.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  content: { padding: 24, paddingTop: 64 },
  eyebrow: {
    color: colors.purple,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.7,
  },
  title: { marginTop: 14, color: colors.plum, fontSize: 36, lineHeight: 42 },
  body: { marginTop: 16, color: colors.muted, fontSize: 16 },
});
