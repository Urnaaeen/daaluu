import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { PALETTE } from "../theme/colors";
import PushButton from "./ui/PushButton";

export const TIMER_OPTIONS = [
  { value: 15, label: "15 сек" },
  { value: 20, label: "20 сек" },
  { value: 40, label: "40 сек" },
  { value: 0, label: "Хязгааргүй" },
];

type PauseModalProps = {
  visible: boolean;
  turnLimit: number;
  /** "10 хуваалт" мэтийн товч нэр — тоглоом ямар дүрмээр дуусахыг сануулна */
  endRuleShort?: string;
  /** Онлайн тоглолтод хугацаа бүгдэд нийтлэг тул өөрчлүүлэхгүй */
  allowTimerChange?: boolean;
  onPickLimit: (value: number) => void;
  onResume: () => void;
  onExit: () => void;
};

// Түр зогсоох цонх — ээлжийн хугацааг тохируулна
export default function PauseModal({
  visible,
  turnLimit,
  endRuleShort,
  allowTimerChange = true,
  onPickLimit,
  onResume,
  onExit,
}: PauseModalProps) {
  const { colors } = useTheme();

  // Хаалттай үед DOM-д үлдэхгүйн тулд бүрмөсөн салгана (RN Web)
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onResume}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>Түр зогсов</Text>

          {!!endRuleShort && (
            <Text style={[styles.endRule, { color: colors.muted }]}>
              ТӨГСГӨЛ · {endRuleShort}
            </Text>
          )}

          {allowTimerChange ? (
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: colors.muted }]}>ЭЭЛЖИЙН ХУГАЦАА</Text>
            <View style={styles.optionsRow}>
              {TIMER_OPTIONS.map(opt => {
                const active = turnLimit === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => onPickLimit(opt.value)}
                    style={[
                      styles.option,
                      {
                        borderColor: active ? colors.accent : colors.border,
                        backgroundColor: active ? colors.sunken : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[styles.optionText, { color: active ? colors.text : colors.muted }]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Хугацаа дуусахад хамгийн жижиг мод автоматаар гарна.
            </Text>
          </View>
          ) : (
            <Text style={[styles.hint, { color: colors.muted, textAlign: "center" }]}>
              Ээлжийн хугацаа {turnLimit > 0 ? `${turnLimit} сек` : "хязгааргүй"} · бүх тоглогчид нийтлэг
            </Text>
          )}

          <PushButton
            label="Үргэлжлүүлэх"
            color={PALETTE.green}
            shadowColor={PALETTE.greenDark}
            onPress={onResume}
            style={{ width: "100%" }}
            textStyle={{ fontSize: 15 }}
          />

          <Pressable onPress={onExit} style={[styles.exitBtn, { backgroundColor: colors.sunken }]}>
            <Text style={[styles.exitText, { color: colors.subText }]}>Тоглоомоос гарах</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8,20,16,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },

  card: {
    width: "100%",
    maxWidth: 300,
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },

  title: { fontSize: 20, fontWeight: "900", textAlign: "center" },
  endRule: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
    textAlign: "center",
    marginTop: -6,
  },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.7 },

  optionsRow: { flexDirection: "row", gap: 6 },

  option: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
  },

  optionText: { fontSize: 11, fontWeight: "800" },
  hint: { fontSize: 11, fontWeight: "600", lineHeight: 17 },

  exitBtn: { paddingVertical: 13, borderRadius: 16, alignItems: "center" },
  exitText: { fontSize: 14, fontWeight: "800" },
});
