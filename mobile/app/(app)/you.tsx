import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { colors } from "../../lib/theme";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/auth-provider";

export default function YouScreen() {
  const { session } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>YOU</Text>
        <Text style={styles.title}>Your Covarify account.</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void supabase.auth.signOut()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
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
  email: { marginTop: 18, color: colors.muted, fontSize: 15 },
  button: {
    minHeight: 52,
    marginTop: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.plum,
    borderRadius: 26,
  },
  pressed: { backgroundColor: colors.lavenderBackground },
  buttonText: { color: colors.plum, fontSize: 15, fontWeight: "700" },
});
