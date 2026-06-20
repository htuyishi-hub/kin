import { Feather } from "@expo/vector-icons";
import { useGetPrompts, useSetMyPrompts } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface SelectedPrompt {
  promptKey: string;
  promptText: string;
  promptRw: string;
  answer: string;
}

export default function PromptsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { data: prompts = [] } = useGetPrompts();
  const [selected, setSelected] = useState<SelectedPrompt[]>([]);
  const [error, setError] = useState("");

  const { mutate: setMyPrompts, isPending } = useSetMyPrompts({
    mutation: {
      onSuccess: () => {
        router.push("/(onboarding)/waiting");
      },
      onError: (err: any) => {
        setError(err?.data?.message ?? "Failed to save. Please try again.");
      },
    },
  });

  function togglePrompt(prompt: typeof prompts[number]) {
    const exists = selected.find((s) => s.promptKey === prompt.key);
    if (exists) {
      setSelected(selected.filter((s) => s.promptKey !== prompt.key));
    } else if (selected.length < 3) {
      setSelected([...selected, { promptKey: prompt.key, promptText: prompt.promptText, promptRw: prompt.promptRw, answer: "" }]);
    }
  }

  function updateAnswer(promptKey: string, answer: string) {
    setSelected(selected.map((s) => s.promptKey === promptKey ? { ...s, answer } : s));
  }

  function handleSave() {
    if (selected.length < 3) { setError("Select 3 prompts to answer"); return; }
    if (selected.some((s) => !s.answer.trim())) { setError("Answer all 3 prompts"); return; }
    setError("");
    setMyPrompts({ data: { answers: selected.map((s) => ({ promptKey: s.promptKey, answer: s.answer.trim() })) } });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: isWeb ? 67 : insets.top + 24,
          paddingBottom: isWeb ? 34 : insets.bottom + 24,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.step, { color: colors.mutedForeground }]}>Step 4 of 4</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Your voice</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Choose 3 prompts and answer them. This is what people will see first.
      </Text>

      <View style={styles.selected}>
        {selected.map((s) => (
          <View key={s.promptKey} style={[styles.selectedPrompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.promptHeader}>
              <Text style={[styles.promptQ, { color: colors.primary }]}>{s.promptText}</Text>
              <TouchableOpacity onPress={() => togglePrompt({ key: s.promptKey, promptText: s.promptText, promptRw: s.promptRw } as any)}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.answerInput, { color: colors.foreground, borderColor: colors.muted }]}
              placeholder="Your answer (up to 160 chars)"
              placeholderTextColor={colors.mutedForeground}
              value={s.answer}
              onChangeText={(t) => updateAnswer(s.promptKey, t)}
              maxLength={160}
              multiline
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{s.answer.length}/160</Text>
          </View>
        ))}
      </View>

      {selected.length < 3 && (
        <View style={styles.promptList}>
          <Text style={[styles.listLabel, { color: colors.mutedForeground }]}>
            SELECT {3 - selected.length} MORE
          </Text>
          {prompts
            .filter((p) => !selected.find((s) => s.promptKey === p.key))
            .map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.promptOption, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => togglePrompt(p)}
                activeOpacity={0.8}
              >
                <Text style={[styles.promptOptionText, { color: colors.foreground }]}>{p.promptText}</Text>
                <Text style={[styles.promptRw, { color: colors.mutedForeground }]}>{p.promptRw}</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary, opacity: isPending ? 0.7 : 1 }]}
        onPress={handleSave}
        disabled={isPending}
        activeOpacity={0.85}
      >
        {isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Emeza</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24 },
  step: { fontFamily: "Inter_500Medium", fontSize: 13 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  selected: { gap: 12 },
  selectedPrompt: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  promptHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  promptQ: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 20, marginRight: 8 },
  answerInput: {
    borderTopWidth: 1,
    paddingTop: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    minHeight: 60,
  },
  charCount: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" },
  promptList: { gap: 8 },
  listLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1 },
  promptOption: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  promptOptionText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  promptRw: { fontFamily: "Inter_400Regular", fontSize: 13 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13 },
  button: { paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 17 },
});
