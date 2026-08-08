import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { nativeTokens } from "../../lib/native-tokens";

export default function DecisionsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>Decisions</Text>
        <Text style={styles.body}>Confirmed decisions will have a calm home here in a future milestone.</Text>
        <Text style={styles.boundary}>No plans or financial actions are active.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: nativeTokens.color.canvas },
  content: { gap: nativeTokens.space.md, padding: nativeTokens.space.lg, paddingTop: nativeTokens.space.xxl },
  title: { ...nativeTokens.type.title, color: nativeTokens.color.text },
  body: { ...nativeTokens.type.body, color: nativeTokens.color.secondaryText },
  boundary: { ...nativeTokens.type.detail, color: nativeTokens.color.confirmation },
});
