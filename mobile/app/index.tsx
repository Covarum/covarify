import { Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "../lib/theme";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";

const INVALID_CREDENTIALS = "The email or password is incorrect.";
const NETWORK_ERROR =
  "We could not reach Covarify. Check your connection and try again.";

export default function SignInScreen() {
  const { isLoading: isSessionLoading, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isSessionLoading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.purple} />
      </SafeAreaView>
    );
  }

  if (session) return <Redirect href="/(app)" />;

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        const invalid =
          signInError.status === 400 ||
          /invalid login credentials/i.test(signInError.message);
        setError(invalid ? INVALID_CREDENTIALS : "Sign-in could not be completed.");
      }
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <View style={styles.content}>
          <Text style={styles.wordmark}>COVARIFY</Text>
          <Text style={styles.eyebrow}>PROJECT POCKET</Text>
          <Text style={styles.title}>Financial Clarity</Text>
          <Text style={styles.subtitle}>Understand what matters.</Text>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Sign in</Text>
            <Text style={styles.formDescription}>
              Access is limited to approved Covarify beta participants.
            </Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSubmitting}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor="#91899A"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              editable={!isSubmitting}
              onChangeText={setPassword}
              onSubmitEditing={() => void signIn()}
              placeholder="Password"
              placeholderTextColor="#91899A"
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
            />
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void signIn()}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isSubmitting && styles.buttonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Sign in securely</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.lavenderBackground },
  keyboard: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderBackground,
  },
  content: { flex: 1, justifyContent: "center", padding: 24 },
  wordmark: {
    color: colors.plum,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2.5,
  },
  eyebrow: {
    marginTop: 28,
    color: colors.purple,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: { marginTop: 10, color: colors.plum, fontSize: 42, fontWeight: "400" },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 18 },
  form: {
    marginTop: 36,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.white,
  },
  formTitle: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  formDescription: {
    marginTop: 8,
    marginBottom: 20,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    minHeight: 54,
    marginTop: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    color: colors.ink,
    fontSize: 16,
    backgroundColor: colors.white,
  },
  error: { marginTop: 14, color: colors.danger, fontSize: 13, lineHeight: 18 },
  button: {
    minHeight: 54,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: colors.plum,
  },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
});
