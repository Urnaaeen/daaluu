import { Image as ExpoImage } from "expo-image";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TileInstance } from "../app/types";
import { useTheme } from "../context/ThemeContext";
import { PALETTE } from "../theme/colors";

export type HistoryRound = {
  winner: number;
  plays: (TileInstance[] | null)[];
};

type HistoryDrawerProps = {
  visible: boolean;
  onClose: () => void;
  rounds: HistoryRound[];
  names: string[];
};

// Баруун талаас гарах "Гарын түүх" самбар
export default function HistoryDrawer({ visible, onClose, rounds, names }: HistoryDrawerProps) {
  const { colors } = useTheme();
  const reversed = [...rounds].reverse();

  // Хаалттай үед DOM-д үлдэхгүйн тулд бүрмөсөн салгана (RN Web)
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.scrim} onPress={onClose} />

        <View style={[styles.panel, { backgroundColor: colors.background }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.text }]}>Гарын түүх</Text>
            <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.sunken }]}>
              <Text style={[styles.closeText, { color: colors.subText }]}>✕</Text>
            </Pressable>
          </View>

          {rounds.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              Одоогоор гар тоглогдоогүй байна. Мод гаргамагц энд түүх нь харагдана.
            </Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
              {reversed.map((round, idx) => {
                const roundNo = rounds.length - idx;
                return (
                  <View
                    key={roundNo}
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.cardHead}>
                      <Text style={[styles.roundLabel, { color: colors.text }]}>{roundNo}-р гар</Text>
                      <View style={styles.winnerPill}>
                        <Text style={styles.winnerPillText}>
                          {names[round.winner] ?? "?"} идсэн
                        </Text>
                      </View>
                    </View>

                    <View style={styles.entries}>
                      {round.plays.map((tiles, seat) => (
                        <View
                          key={seat}
                          style={[styles.entry, { opacity: seat === round.winner ? 1 : 0.55 }]}
                        >
                          {tiles && tiles.length > 0 ? (
                            <ExpoImage
                              source={tiles[0].image}
                              style={[
                                styles.entryTile,
                                seat === round.winner && styles.entryTileWin,
                              ]}
                              contentFit="contain"
                              cachePolicy="memory-disk"
                            />
                          ) : (
                            <View style={[styles.entryTile, { borderWidth: 1, borderColor: colors.border }]} />
                          )}
                          <Text style={[styles.entryOwner, { color: colors.muted }]} numberOfLines={1}>
                            {names[seat] ?? ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: "row" },
  scrim: { flex: 1, backgroundColor: "rgba(8,20,16,0.4)" },

  panel: {
    width: 280,
    height: "100%",
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 34,
    gap: 10,
  },

  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 17, fontWeight: "800" },

  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: { fontSize: 14, fontWeight: "800" },

  empty: { fontSize: 12, fontWeight: "600", lineHeight: 19 },

  card: { borderRadius: 16, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 10 },

  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roundLabel: { fontSize: 12, fontWeight: "800" },

  winnerPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: PALETTE.goldSoft,
  },

  winnerPillText: { fontSize: 10, fontWeight: "800", color: PALETTE.gold },

  entries: { flexDirection: "row", gap: 6, marginTop: 8 },
  entry: { flex: 1, alignItems: "center", gap: 3 },

  entryTile: { width: 30, height: 46, borderRadius: 4 },
  entryTileWin: { borderWidth: 2, borderColor: PALETTE.yellow },

  entryOwner: { fontSize: 8, fontWeight: "700", maxWidth: 44 },
});
