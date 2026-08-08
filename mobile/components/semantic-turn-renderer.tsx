import { Pressable, StyleSheet, Text, View } from "react-native";

import { nativeTokens } from "../lib/native-tokens";
import { interactionForAction, type CovarifyTurn, type PresentationBlock, type SemanticAction } from "../lib/turn-contract";

type Props = {
  turn: CovarifyTurn;
  detailVisible: boolean;
  onToggleDetail: () => void;
  onAction: (action: SemanticAction) => void;
};

const detailTypes = new Set<PresentationBlock["type"]>(["assumption", "evidence", "calculation"]);

function SemanticBlock({ block }: { block: PresentationBlock }) {
  const warning = block.type === "warning";
  const confirmation = block.type === "answer" || block.type === "stopping_state";
  const value = block.type === "allocation" || block.type === "reconciliation";
  return (
    <View
      accessible
      accessibilityLabel={[block.title, block.body].filter(Boolean).join(". ").replaceAll("\n", ", ")}
      style={[styles.block, block.emphasis === "primary" && styles.primaryBlock, warning && styles.warningBlock, confirmation && styles.confirmationBlock]}
    >
      {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
      <Text style={[styles.blockBody, value && styles.financialValue]}>{block.body}</Text>
    </View>
  );
}

export function SemanticTurnRenderer({ turn, detailVisible, onToggleDetail, onAction }: Props) {
  const primaryBlocks = turn.response.blocks.filter((item) => !detailTypes.has(item.type));
  const detailBlocks = turn.response.blocks.filter((item) => detailTypes.has(item.type));
  return (
    <View accessibilityLabel={`Covarify response. ${turn.response.primaryMessage}`} style={styles.container}>
      {primaryBlocks.map((item) => <SemanticBlock key={item.id} block={item} />)}

      {turn.understanding.ambiguity ? (
        <View style={styles.ambiguity} accessibilityRole="summary">
          <Text style={styles.blockTitle}>{turn.understanding.ambiguity.message}</Text>
          {turn.understanding.ambiguity.candidates.map((candidate) => (
            <View key={candidate.entityId} style={styles.candidate}>
              <Text style={styles.blockBody}>{candidate.displayLabel}</Text>
              <Text style={styles.detailText}>{candidate.reason}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {detailBlocks.length ? (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: detailVisible }}
            onPress={onToggleDetail}
            style={({ pressed }) => [styles.detailToggle, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryActionText}>{detailVisible ? "Hide details" : "Review details"}</Text>
          </Pressable>
          {detailVisible ? detailBlocks.map((item) => <SemanticBlock key={item.id} block={item} />) : null}
        </View>
      ) : null}

      {turn.actions.length ? (
        <View accessibilityRole="toolbar" accessibilityLabel="Available actions" style={styles.actions}>
          {turn.actions.map((item) => {
            const unavailable = interactionForAction(item) === "unavailable";
            const primary = turn.next.actionId === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={unavailable ? "This consequential action is unavailable in the fixture foundation." : `Dispatches action ${item.id}.`}
                accessibilityState={{ disabled: unavailable }}
                disabled={unavailable}
                onPress={() => onAction(item)}
                style={({ pressed }) => [styles.action, primary && styles.primaryAction, unavailable && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.actionText, primary && styles.primaryActionText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text accessibilityLabel={`Next best step: ${turn.next.bestStep}`} style={styles.nextStep}>Next: {turn.next.bestStep}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: nativeTokens.space.md },
  block: { gap: nativeTokens.space.xs, paddingVertical: nativeTokens.space.sm },
  primaryBlock: { padding: nativeTokens.space.lg, borderRadius: nativeTokens.radius.surface, backgroundColor: nativeTokens.color.accentSoft },
  warningBlock: { padding: nativeTokens.space.lg, borderRadius: nativeTokens.radius.surface, backgroundColor: nativeTokens.color.warningSoft },
  confirmationBlock: { padding: nativeTokens.space.lg, borderRadius: nativeTokens.radius.surface, backgroundColor: nativeTokens.color.confirmationSoft },
  blockTitle: { ...nativeTokens.type.heading, color: nativeTokens.color.text },
  blockBody: { ...nativeTokens.type.body, color: nativeTokens.color.text },
  financialValue: { ...nativeTokens.type.value, color: nativeTokens.color.financialValue },
  detailText: { ...nativeTokens.type.detail, color: nativeTokens.color.secondaryText },
  ambiguity: { gap: nativeTokens.space.sm, padding: nativeTokens.space.lg, borderRadius: nativeTokens.radius.surface, backgroundColor: nativeTokens.color.warningSoft },
  candidate: { gap: nativeTokens.space.xxs, paddingTop: nativeTokens.space.sm },
  detailToggle: { minHeight: 48, alignItems: "flex-start", justifyContent: "center", borderRadius: nativeTokens.radius.control },
  actions: { gap: nativeTokens.space.sm, paddingTop: nativeTokens.space.xs },
  action: { minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: nativeTokens.space.md, borderWidth: 1, borderColor: nativeTokens.color.border, borderRadius: nativeTokens.radius.control, backgroundColor: nativeTokens.color.surface },
  primaryAction: { borderColor: nativeTokens.color.accent, backgroundColor: nativeTokens.color.accent },
  actionText: { ...nativeTokens.type.body, color: nativeTokens.color.text, fontWeight: "600" },
  primaryActionText: { color: nativeTokens.color.surface },
  secondaryActionText: { ...nativeTokens.type.body, color: nativeTokens.color.accent, fontWeight: "600" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  nextStep: { ...nativeTokens.type.detail, color: nativeTokens.color.secondaryText, paddingTop: nativeTokens.space.sm },
});
