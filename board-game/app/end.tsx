import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Confetti from "../components/Confetti";
import FeltBackdrop from "../components/FeltBackdrop";
import Avatar from "../components/ui/Avatar";
import PushButton from "../components/ui/PushButton";
import { useAppState } from "../context/AppStateContext";
import { useTheme } from "../context/ThemeContext";
import { AVATAR_COLORS, MONO, PALETTE } from "../theme/colors";

type Row = {
  place: string;
  name: string;
  detail: string;
  score: string;
  seat: number;
};

// Тоглоомоос дүн ирээгүй үед дизайны жишээ дүн харагдана
const DEMO_ROWS: Row[] = [
  { place: "1", name: "Хандцоож", detail: "10 цай · 3 гэр", score: "10", seat: 1 },
  { place: "2", name: "Тэмүүлэн", detail: "6 цай · 1 авлага", score: "7", seat: 0 },
  { place: "3", name: "Шижир", detail: "4 цай · 2 гэр", score: "4", seat: 2 },
  { place: "4", name: "Энхлэн", detail: "2 цай", score: "2", seat: 3 },
  { place: "5", name: "Уламбаяр", detail: "0 цай · 2 өглөг", score: "−2", seat: 4 },
];

export default function EndScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { playerName } = useAppState();
  const params = useLocalSearchParams();

  // Тоглох дэлгэцээс дүн дамжуулсан бол түүнийг, үгүй бол жишээг харуулна
  let rows: Row[] = DEMO_ROWS;
  if (typeof params.scores === "string") {
    try {
      const parsed = JSON.parse(params.scores);
      if (Array.isArray(parsed) && parsed.length) rows = parsed;
    } catch {
      rows = DEMO_ROWS;
    }
  }

  const winner = rows[0];
  const winnerLabel = typeof params.winner === "string" ? params.winner : winner.name;
  const summary =
    typeof params.summary === "string" ? params.summary : `${winner.score} цай хурааж дуусгав`;

  return (
    <View style={[styles.container, { backgroundColor: colors.feltTop }]}>
      <FeltBackdrop />
      <Confetti />

      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>ТОГЛООМ ДУУСЛАА</Text>
        <Text style={styles.bannerName}>{winnerLabel} яллаа</Text>
        <Text style={styles.bannerSub}>{summary}</Text>
      </View>

      <View style={[styles.table, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {rows.map((p, i) => {
            const isMe = p.name === playerName;
            return (
              <View
                key={`${p.name}_${i}`}
                style={[
                  styles.row,
                  i === 0 && styles.winnerRow,
                  i !== 0 && isMe && { backgroundColor: colors.sunken },
                ]}
              >
                <Text style={[styles.place, { color: colors.muted }]}>{p.place}</Text>
                <Avatar
                  label={(p.name.trim()[0] ?? "?").toUpperCase()}
                  color={AVATAR_COLORS[p.seat % 5]}
                  size={38}
                  radius={12}
                  fontSize={14}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[styles.rowName, { color: i === 0 ? "#2B2D31" : colors.text }]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  <Text style={[styles.rowDetail, { color: i === 0 ? PALETTE.gold : colors.muted }]}>
                    {p.detail}
                  </Text>
                </View>
                <Text style={[styles.rowScore, { color: i === 0 ? PALETTE.gold : colors.text }]}>
                  {p.score}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.actions}>
        <PushButton
          label="Дахин тоглох"
          color={colors.accent}
          shadowColor={colors.accentDark}
          onPress={() => router.replace("/playScreen")}
          textStyle={{ fontSize: 17 }}
          faceStyle={{ paddingVertical: 17 }}
        />
        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => [styles.menuBtn, pressed && { transform: [{ translateY: 2 }] }]}
        >
          <Text style={styles.menuText}>Үндсэн цэс</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 34,
    gap: 14,
  },

  banner: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: PALETTE.goldSoft,
  },

  bannerLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: PALETTE.gold,
  },

  bannerName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2B2D31",
    marginTop: 4,
    textAlign: "center",
  },

  bannerSub: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.gold,
    marginTop: 2,
  },

  table: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 2,
    padding: 8,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
  },

  winnerRow: { backgroundColor: PALETTE.goldSoft },

  place: { width: 26, fontSize: 15, fontFamily: MONO, textAlign: "center" },
  rowName: { fontSize: 15, fontWeight: "800" },
  rowDetail: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  rowScore: { fontSize: 20, fontFamily: MONO },

  actions: { gap: 10 },

  menuBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
  },

  menuText: { fontSize: 16, fontWeight: "800", color: "rgba(255,255,255,0.85)" },
});
