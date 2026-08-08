import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { SemanticTurnRenderer } from "../../components/semantic-turn-renderer";
import { competingNeedsQuestion, correctionReview, createFixtureCovarifyClient, outOfScopeTurn, type FixtureScenario } from "../../fixtures/turn-fixtures";
import { createAuthenticatedCovarifyClient } from "../../lib/authenticated-covarify-client";
import { CovarifyTransportError, type CovarifyClient, type CovarifyTransportErrorCode } from "../../lib/covarify-client";
import { nativeTokens } from "../../lib/native-tokens";
import { interactionForAction, type CovarifyTurn, type SemanticAction, type TurnInput } from "../../lib/turn-contract";

const fixtureStart: Record<FixtureScenario, CovarifyTurn> = { competing_needs: competingNeedsQuestion, correction: correctionReview, out_of_scope: outOfScopeTurn };
const errorMessage: Record<CovarifyTransportErrorCode, string> = {
  OFFLINE: "Covarify can’t connect right now. Your message is still here.", TIMEOUT: "Covarify is taking longer than expected. You can try this read-only question again.", UNAUTHORIZED: "Your session ended. Sign in again to continue.", FORBIDDEN: "This connected development preview isn’t available for this account.", CONTRACT_MISMATCH: "This development build needs an update before it can show connected financial information.", INVALID_RESPONSE: "Covarify received a response it could not safely display.", SERVER_ERROR: "Covarify couldn’t complete this read-only request.", STALE_ACTION: "That action is no longer current. Ask the question again.", SESSION_EXPIRED: "This conversation expired. Start a new connected conversation.",
};

export default function AskCovarifyScreen() {
  const fixtureClient = useRef(createFixtureCovarifyClient()).current;
  const authenticatedClient = useRef(createAuthenticatedCovarifyClient());
  const [mode, setMode] = useState<"fixture" | "authenticated_development">("fixture");
  const client: CovarifyClient = mode === "fixture" ? fixtureClient : authenticatedClient.current;
  const scrollRef = useRef<ScrollView>(null);
  const resultRef = useRef<View>(null);
  const [turns, setTurns] = useState<CovarifyTurn[]>([competingNeedsQuestion]);
  const [submittedStatements, setSubmittedStatements] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [detailVisible, setDetailVisible] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voicePermission, setVoicePermission] = useState<"undetermined" | "fixture_allowed" | "denied">("undetermined");
  const [reviewedTranscript, setReviewedTranscript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [delayed, setDelayed] = useState(false);
  const [transportError, setTransportError] = useState<CovarifyTransportErrorCode | null>(null);
  const [retryInput, setRetryInput] = useState<TurnInput | null>(null);
  const current = turns.at(-1) || null;
  const priorConnectedResponses = mode === "authenticated_development" ? turns.length - (turns.length === submittedStatements.length ? 1 : 0) : 0;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  const send = async (input: TurnInput, appendStatement = false) => {
    if (loading) return;
    if (appendStatement && input.statement) setSubmittedStatements((items) => [...items, input.statement!]);
    setLoading(true); setDelayed(false); setTransportError(null); setRetryInput(input);
    const waiting = setTimeout(() => setDelayed(true), 1200);
    try {
      const next = await client.sendTurn(input);
      setTurns((existing) => [...existing, next]); setDetailVisible(false); setRetryInput(null);
      requestAnimationFrame(() => { scrollRef.current?.scrollToEnd({ animated: !reduceMotion }); const node = findNodeHandle(resultRef.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); });
    } catch (error) {
      const code = error instanceof CovarifyTransportError ? error.code : "SERVER_ERROR"; setTransportError(code);
      if (input.statement) setDraft(input.statement);
    } finally { clearTimeout(waiting); setLoading(false); setDelayed(false); }
  };

  const dispatchAction = (action: SemanticAction) => {
    if (interactionForAction(action) === "unavailable") return;
    void send({ modality: "guided_action", action: { id: action.id, payload: action.payload } });
  };

  const chooseScenario = (scenario: FixtureScenario) => {
    fixtureClient.setScenario(scenario);
    setTurns([fixtureStart[scenario]]);
    setDetailVisible(false);
  };

  const chooseMode = (nextMode: "fixture" | "authenticated_development") => {
    if (nextMode === mode) return;
    if (nextMode === "authenticated_development") authenticatedClient.current = createAuthenticatedCovarifyClient();
    setMode(nextMode); setTurns(nextMode === "fixture" ? [competingNeedsQuestion] : []); setSubmittedStatements([]); setTransportError(null); setRetryInput(null); setDraft(""); setDetailVisible(false);
  };

  const submitTyped = () => {
    const statement = draft.trim();
    if (!statement) return;
    setDraft("");
    void send({ modality: "text", statement }, true);
  };

  const useMockTranscript = () => {
    setVoicePermission("fixture_allowed");
    setReviewedTranscript("That amount is actually $400.");
    setVoiceOpen(false);
  };

  const sendReviewedTranscript = () => {
    if (!reviewedTranscript) return;
    fixtureClient.setScenario("correction");
    setReviewedTranscript(null);
    void send({ modality: "reviewed_voice", statement: reviewedTranscript }, true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safeArea}>
        <ScrollView
          ref={scrollRef}
          contentOffset={{ x: 0, y: scrollPosition }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => setScrollPosition(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={80}
        >
          <View accessibilityRole="header" style={styles.header}>
            <Text style={mode === "fixture" ? styles.fixtureBadge : styles.connectedBadge}>{mode === "fixture" ? "FIXTURE MODE · NO REAL FINANCIAL DATA" : "CONNECTED DEVELOPMENT · READ ONLY"}</Text>
            <Text style={styles.title}>Ask Covarify</Text>
            <Text style={styles.subtitle}>Clear financial guidance, rendered from the shared Turn Contract.</Text>
          </View>

          {mode === "fixture" ? <View accessibilityRole="toolbar" accessibilityLabel="Development data mode" style={styles.scenarios}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === "fixture" }} onPress={() => chooseMode("fixture")} style={styles.scenarioButton}><Text style={styles.scenarioText}>Use fixtures</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: false }} onPress={() => chooseMode("authenticated_development")} style={styles.scenarioButton}><Text style={styles.scenarioText}>Use connected development</Text></Pressable>
          </View> : <Pressable accessibilityRole="button" onPress={() => chooseMode("fixture")} style={styles.endConnected}><Text style={styles.secondaryText}>End connected session</Text></Pressable>}

          {mode === "fixture" ? <View accessibilityRole="toolbar" accessibilityLabel="Fixture examples" style={styles.scenarios}>
            <Pressable accessibilityRole="button" onPress={() => chooseScenario("competing_needs")} style={styles.scenarioButton}><Text style={styles.scenarioText}>Competing needs</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => chooseScenario("correction")} style={styles.scenarioButton}><Text style={styles.scenarioText}>Correct an amount</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => chooseScenario("out_of_scope")} style={styles.scenarioButton}><Text style={styles.scenarioText}>Scope check</Text></Pressable>
          </View> : null}

          {submittedStatements.map((statement, index) => <View key={`${index}:${statement}`} style={styles.exchange}><View accessibilityLabel={`You said: ${statement}`} style={styles.userTurn}><Text style={styles.userTurnLabel}>You</Text><Text style={styles.body}>{statement}</Text></View>{index < priorConnectedResponses ? <View accessibilityLabel={`Covarify said: ${turns[index].response.primaryMessage}`} style={styles.priorResponse}><Text style={styles.covarifyLabel}>Covarify</Text><Text style={styles.body}>{turns[index].response.primaryMessage}</Text></View> : null}</View>)}

          {turns.length > 1 ? (
            <View accessibilityLabel="Earlier turns in this fixture session" style={styles.history}>
              <Text style={styles.sectionTitle}>Earlier in this conversation</Text>
              {turns.slice(0, -1).map((turn) => (
                <Text key={turn.identity.turnId} style={styles.historyTurn}>{turn.response.primaryMessage}</Text>
              ))}
            </View>
          ) : null}

          {current && (mode === "fixture" || turns.length === submittedStatements.length) ? <View ref={resultRef} accessible accessibilityLiveRegion="polite"><SemanticTurnRenderer turn={current} detailVisible={detailVisible} onToggleDetail={() => setDetailVisible((value) => !value)} onAction={dispatchAction} /></View> : mode === "authenticated_development" && !submittedStatements.length ? <Text style={styles.subtitle}>Ask a read-only question about your connected transaction history.</Text> : null}

          {loading ? <View accessibilityLiveRegion="polite" style={styles.waiting}><Text style={styles.body}>{delayed ? "Still checking your authorized financial picture…" : "Checking your authorized financial picture…"}</Text><Text style={styles.detail}>Nothing is being changed.</Text></View> : null}
          {transportError ? <View accessibilityLiveRegion="assertive" style={styles.errorState}><Text style={styles.blockingError}>{errorMessage[transportError]}</Text>{retryInput && ["OFFLINE", "TIMEOUT", "SERVER_ERROR"].includes(transportError) ? <Pressable accessibilityRole="button" onPress={() => void send(retryInput, false)} style={styles.smallSecondary}><Text style={styles.secondaryText}>Retry read-only question</Text></Pressable> : null}</View> : null}

          {reviewedTranscript ? (
            <View accessibilityLiveRegion="polite" style={styles.transcriptReview}>
              <Text style={styles.sectionTitle}>Review voice transcript</Text>
              <Text style={styles.body}>{reviewedTranscript}</Text>
              <Text style={styles.detail}>Fixture transcript only. Review it before sending.</Text>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" onPress={sendReviewedTranscript} style={styles.smallPrimary}><Text style={styles.primaryText}>Send transcript</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => { setDraft(reviewedTranscript); setReviewedTranscript(null); }} style={styles.smallSecondary}><Text style={styles.secondaryText}>Edit</Text></Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.composer}>
            <Text style={styles.sectionTitle}>Ask or change something</Text>
            <TextInput
              accessibilityLabel="Message Covarify"
              multiline
              onChangeText={setDraft}
              placeholder="Type a financial question"
              placeholderTextColor={nativeTokens.color.secondaryText}
              style={styles.input}
              value={draft}
            />
            <View style={styles.row}>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading }} disabled={loading} onPress={submitTyped} style={styles.smallPrimary}><Text style={styles.primaryText}>Send</Text></Pressable>
              {mode === "fixture" ? <Pressable accessibilityRole="button" accessibilityLabel="Use voice fixture" onPress={() => setVoiceOpen(true)} style={styles.smallSecondary}><Text style={styles.secondaryText}>Microphone</Text></Pressable> : null}
            </View>
            {voicePermission === "denied" ? <Text accessibilityLiveRegion="polite" style={styles.detail}>Microphone access was declined. Typing remains fully available.</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal accessibilityViewIsModal animationType={reduceMotion ? "none" : "slide"} onRequestClose={() => setVoiceOpen(false)} presentationStyle="pageSheet" visible={voiceOpen}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalContent}>
            <Text accessibilityRole="header" style={styles.title}>Voice input</Text>
            <Text style={styles.body}>Covarify would request microphone permission only after this tap. This foundation uses a mock transcript and does not record or transmit audio.</Text>
            <Pressable accessibilityRole="button" onPress={useMockTranscript} style={styles.modalPrimary}><Text style={styles.primaryText}>Allow fixture transcript</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setVoicePermission("denied"); setVoiceOpen(false); }} style={styles.modalSecondary}><Text style={styles.secondaryText}>Not now — use typing</Text></Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: nativeTokens.color.canvas },
  content: { gap: nativeTokens.space.lg, padding: nativeTokens.space.lg, paddingBottom: 120 },
  header: { gap: nativeTokens.space.xs, paddingTop: nativeTokens.space.sm },
  fixtureBadge: { ...nativeTokens.type.detail, color: nativeTokens.color.warning, fontWeight: "700", letterSpacing: 0.4 },
  connectedBadge: { ...nativeTokens.type.detail, color: nativeTokens.color.confirmation, fontWeight: "700", letterSpacing: 0.4 },
  title: { ...nativeTokens.type.title, color: nativeTokens.color.text },
  subtitle: { ...nativeTokens.type.body, color: nativeTokens.color.secondaryText },
  scenarios: { flexDirection: "row", flexWrap: "wrap", gap: nativeTokens.space.xs },
  scenarioButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: nativeTokens.space.sm, borderWidth: 1, borderColor: nativeTokens.color.border, borderRadius: nativeTokens.radius.control, backgroundColor: nativeTokens.color.surface },
  scenarioText: { ...nativeTokens.type.detail, color: nativeTokens.color.text, fontWeight: "600" },
  endConnected: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center" },
  history: { gap: nativeTokens.space.sm, paddingBottom: nativeTokens.space.sm, borderBottomWidth: 1, borderColor: nativeTokens.color.border },
  historyTurn: { ...nativeTokens.type.detail, color: nativeTokens.color.secondaryText },
  exchange: { gap: nativeTokens.space.md },
  userTurn: { alignSelf: "flex-end", maxWidth: "88%", gap: nativeTokens.space.xxs, padding: nativeTokens.space.md, borderRadius: nativeTokens.radius.surface, backgroundColor: nativeTokens.color.accentSoft },
  userTurnLabel: { ...nativeTokens.type.detail, color: nativeTokens.color.accent, fontWeight: "700" },
  priorResponse: { gap: nativeTokens.space.xxs, paddingVertical: nativeTokens.space.sm },
  covarifyLabel: { ...nativeTokens.type.detail, color: nativeTokens.color.confirmation, fontWeight: "700" },
  waiting: { gap: nativeTokens.space.xs, paddingVertical: nativeTokens.space.md },
  errorState: { alignItems: "flex-start", gap: nativeTokens.space.md, padding: nativeTokens.space.lg, borderRadius: nativeTokens.radius.surface, backgroundColor: nativeTokens.color.warningSoft },
  blockingError: { ...nativeTokens.type.body, color: nativeTokens.color.warning, fontWeight: "600" },
  transcriptReview: { gap: nativeTokens.space.sm, padding: nativeTokens.space.lg, borderRadius: nativeTokens.radius.surface, backgroundColor: nativeTokens.color.warningSoft },
  composer: { gap: nativeTokens.space.sm, paddingTop: nativeTokens.space.lg, borderTopWidth: 1, borderColor: nativeTokens.color.border },
  sectionTitle: { ...nativeTokens.type.heading, color: nativeTokens.color.text },
  body: { ...nativeTokens.type.body, color: nativeTokens.color.text },
  detail: { ...nativeTokens.type.detail, color: nativeTokens.color.secondaryText },
  input: { minHeight: 88, padding: nativeTokens.space.md, borderWidth: 1, borderColor: nativeTokens.color.border, borderRadius: nativeTokens.radius.control, backgroundColor: nativeTokens.color.surface, color: nativeTokens.color.text, fontSize: 17, lineHeight: 24, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: nativeTokens.space.sm },
  smallPrimary: { minHeight: 48, minWidth: 112, alignItems: "center", justifyContent: "center", paddingHorizontal: nativeTokens.space.md, borderRadius: nativeTokens.radius.control, backgroundColor: nativeTokens.color.accent },
  smallSecondary: { minHeight: 48, minWidth: 112, alignItems: "center", justifyContent: "center", paddingHorizontal: nativeTokens.space.md, borderWidth: 1, borderColor: nativeTokens.color.border, borderRadius: nativeTokens.radius.control, backgroundColor: nativeTokens.color.surface },
  primaryText: { ...nativeTokens.type.body, color: nativeTokens.color.surface, fontWeight: "700" },
  secondaryText: { ...nativeTokens.type.body, color: nativeTokens.color.accent, fontWeight: "600" },
  modalSafe: { flex: 1, backgroundColor: nativeTokens.color.canvas },
  modalContent: { flex: 1, justifyContent: "flex-end", gap: nativeTokens.space.lg, padding: nativeTokens.space.lg, paddingBottom: nativeTokens.space.xxl },
  modalPrimary: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: nativeTokens.radius.control, backgroundColor: nativeTokens.color.accent },
  modalSecondary: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: nativeTokens.radius.control, borderWidth: 1, borderColor: nativeTokens.color.border, backgroundColor: nativeTokens.color.surface },
});
