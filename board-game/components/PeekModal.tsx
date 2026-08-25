import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { MONO, PALETTE } from "../theme/colors";
import Avatar from "./ui/Avatar";

type PeekModalProps = {
  visible: boolean;
  onClose: () => void;
  name: string;
  color: string;
  stats: { tsai: number; ger: number; avlaga: number; uglug: number };
};

// Тоглогч дээр удаан дарахад гарах цай · авлага · өглөгийн харагдац
export default function PeekModal({ visible, onClose, name, color, stats }: PeekModalProps) {
  const { colors } = useTheme();

  // Хаалттай үед DOM-д үлдэхгүйн тулд бүрмөсөн салгана (RN Web)
  if (!visible) return null;

  const rows = [
    { label: "Цай", value: stats.tsai, color: PALETTE.gold },
    { label: "Гэр", value: stats.ger, color: colors.text },
    { label: "Авлага", value: stats.avlaga, color: PALETTE.greenText },
    { label: "Өглөг", value: stats.uglug, color: "#C25A00" },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Avatar label={(name.trim()[0] ?? "?").toUpperCase()} color={color} size={38} radius={12} fontSize={14} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.sub, { color: colors.muted }]}>Одоогийн байдал</Text>
            </View>
          </View>

          <View style={styles.rows}>
            {rows.map((r) => (
              <View key={r.label} style={[styles.row, { backgroundColor: colors.sunken }]}>
                <Text style={[styles.rowLabel, { color: colors.subText }]}>{r.label}</Text>
                <Text style={[styles.rowValue, { color: r.color }]}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8,20,16,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  card: {
    width: 216,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  name: {
    fontSize: 15,
    fontWeight: "800",
  },

  sub: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },

  rows: {
    gap: 7,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
  },

  rowLabel: {
    fontSize: 12,
    fontWeight: "700",
  },

  rowValue: {
    fontSize: 15,
    fontFamily: MONO,
  },
});
