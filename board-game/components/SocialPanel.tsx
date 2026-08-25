import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export const EMOJIS = ["😀", "😂", "😎", "😮", "😢", "😡", "👍", "👏", "🔥", "🤝"];
export const QUICK_PHRASES = [
  "Сайн уу!",
  "Хурдлаарай",
  "Сайн тоглолт",
  "Хөөх!",
  "Уучлаарай",
  "Ялалт минийх",
];

type SocialPanelProps = {
  mode: "emoji" | "quick" | null;
  onClose: () => void;
  onSend: (text: string) => void;
};

// Ширээн дээрх emoji / шуурхай хэллэгийн самбар
export default function SocialPanel({ mode, onClose, onSend }: SocialPanelProps) {
  const { colors } = useTheme();
  const [message, setMessage] = useState("");

  // Хаалттай үед DOM-д үлдэхгүйн тулд бүрмөсөн салгана (RN Web)
  if (!mode) return null;

  const send = (text: string) => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setMessage("");
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View style={[styles.panel, { backgroundColor: colors.card }]}>
          {mode === "emoji" ? (
            <View style={styles.emojiGrid}>
              {EMOJIS.map(e => (
                <Pressable
                  key={e}
                  onPress={() => send(e)}
                  style={({ pressed }) => [
                    styles.emojiBtn,
                    { backgroundColor: colors.sunken },
                    pressed && { transform: [{ scale: 0.92 }] },
                  ]}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={styles.phraseGrid}>
                {QUICK_PHRASES.map(p => (
                  <Pressable
                    key={p}
                    onPress={() => send(p)}
                    style={({ pressed }) => [
                      styles.phraseBtn,
                      { borderColor: colors.border },
                      pressed && { transform: [{ translateY: 2 }] },
                    ]}
                  >
                    <Text style={[styles.phraseText, { color: colors.text }]}>{p}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Мессеж бичнэ үү…"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.sunken,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
                <Pressable
                  onPress={() => send(message)}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    { backgroundColor: colors.accent },
                    pressed && { transform: [{ translateY: 2 }] },
                  ]}
                >
                  <Text style={styles.sendText}>Илгээх</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 14, paddingBottom: 118 },

  panel: { borderRadius: 20, padding: 12 },

  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  emojiBtn: {
    width: "18%",
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  emojiText: { fontSize: 22 },

  phraseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  phraseBtn: {
    width: "48%",
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
  },

  phraseText: { fontSize: 12, fontWeight: "800" },

  inputRow: { flexDirection: "row", gap: 8 },

  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 13,
    fontWeight: "700",
  },

  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: "center",
  },

  sendText: { fontSize: 12, fontWeight: "800", color: "#fff" },
});
