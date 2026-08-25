import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { PALETTE } from "../theme/colors";
import PushButton from "./ui/PushButton";

type ExitConfirmModalProps = {
  visible: boolean;
  ger: number;
  onConfirm: () => void;
  onCancel: () => void;
};

// Тоглоомоос гарахын өмнөх баталгаажуулалт
export default function ExitConfirmModal({ visible, ger, onConfirm, onCancel }: ExitConfirmModalProps) {
  const { colors } = useTheme();

  // Хаалттай үед DOM-д үлдэхгүйн тулд бүрмөсөн салгана (RN Web)
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>Тоглоомоос гарах уу?</Text>
          <Text style={[styles.sub, { color: colors.subText }]}>
            Хураасан {ger} гэр тань хадгалагдахгүй.
          </Text>
          <PushButton
            label="Тийм, гарна"
            color={PALETTE.red}
            shadowColor={PALETTE.redDark}
            onPress={onConfirm}
          />
          <Pressable onPress={onCancel} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Үргэлжлүүлэх</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8,20,16,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },

  card: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 24,
    padding: 22,
    gap: 10,
  },

  title: {
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },

  sub: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 4,
  },

  cancelBtn: {
    paddingVertical: 13,
    alignItems: "center",
  },

  cancelText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
