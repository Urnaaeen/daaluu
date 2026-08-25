import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import FeltBackdrop from "../components/FeltBackdrop";
import PushButton from "../components/ui/PushButton";
import { useTheme } from "../context/ThemeContext";
import { api, ApiError } from "../lib/api";
import { PALETTE } from "../theme/colors";

type EndRule = {
  id: string;
  num: number;
  title: string;
  body: string;
  short: string;
};

type Gamer = { unlocked: boolean; wins: number; required: number };

/**
 * Тоглоом эхлэхийн өмнөх "Хэзээ дуусахыг сонго" дэлгэц.
 * Тоглолт үүсгэгч (өрөөний эзэн / санамсаргүйн эхний хүн) л сонгоно.
 */
export default function Setup() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams();

  const roomId = typeof params.roomId === "string" ? params.roomId : null;
  const mode = typeof params.mode === "string" ? params.mode : roomId ? "friends" : "random";

  const [rules, setRules] = useState<EndRule[]>([]);
  const [gamer, setGamer] = useState<Gamer | null>(null);
  const [picked, setPicked] = useState("single");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ rules: EndRule[]; gamer: Gamer }>("/matches/end-rules")
      .then((res) => {
        setRules(res.rules);
        setGamer(res.gamer);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Дүрмүүд ачаалж чадсангүй."));
  }, []);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ matchId: string }>("/matches", {
        method: "POST",
        body: { mode, roomId, turnSeconds: 20, endRule: picked },
      });
      router.replace({ pathname: "/multiplayer", params: { matchId: res.matchId, mode } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Тоглолт үүсгэж чадсангүй.");
      setBusy(false);
    }
  };

  const shortOf = rules.find((r) => r.id === picked)?.short ?? "";

  return (
    <View style={[styles.container, { backgroundColor: colors.feltTop }]}>
      <FeltBackdrop />

      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressedDown]}
        >
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>ТОГЛООМЫН ТӨГСГӨЛ</Text>
          <Text style={styles.title}>Хэзээ дуусахыг сонго</Text>
        </View>
      </View>

      <Text style={styles.lead}>Тоглоом эхлэхээс өмнө бүх тоглогч ижил нөхцөл дээр тохирно.</Text>

      {rules.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={PALETTE.yellow} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {rules.map((r) => {
            const active = picked === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => {
                  setPicked(r.id);
                  setNote("");
                }}
                style={({ pressed }) => [
                  styles.ruleCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: active ? colors.accent : colors.border,
                  },
                  pressed && styles.pressedDown,
                ]}
              >
                <View
                  style={[
                    styles.numBox,
                    { backgroundColor: active ? PALETTE.accentSoft : colors.sunken },
                  ]}
                >
                  <Text
                    style={[styles.numText, { color: active ? PALETTE.accentText : colors.subText }]}
                  >
                    {r.num}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.ruleTitle, { color: colors.text }]}>{r.title}</Text>
                  <Text style={[styles.ruleBody, { color: colors.subText }]}>{r.body}</Text>
                </View>

                {active && (
                  <View style={[styles.tick, { backgroundColor: colors.accent }]}>
                    <Text style={styles.tickText}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}

          {/* Gamer хувилбар — ялалтаар нээгдэнэ */}
          {gamer && !gamer.unlocked && (
            <Pressable
              onPress={() =>
                setNote(
                  `Gamer хувилбар ${gamer.required} ялалтаас нээгдэнэ. Одоо ${gamer.wins} ялалт байна.`
                )
              }
              style={[
                styles.ruleCard,
                styles.ruleCardLocked,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.numBox, { backgroundColor: colors.sunken }]}>
                <Text style={[styles.numText, { color: colors.subText }]}>5</Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.lockedTitleRow}>
                  <Text style={[styles.ruleTitle, { color: colors.text }]}>Gamer хувилбар</Text>
                  <View style={[styles.lockBadge, { backgroundColor: colors.sunken }]}>
                    <Text style={[styles.lockBadgeText, { color: colors.muted }]}>
                      🔒 {gamer.required} ялалт
                    </Text>
                  </View>
                </View>
                <Text style={[styles.ruleBody, { color: colors.subText }]}>
                  Төгсгөлийн нөхцөлөө өөрөө тохируулна — гарын тоо, цайны хязгаар, өглөгийн дүнг
                  чөлөөтэй сонгоно.
                </Text>

                <View style={styles.progressRow}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.sunken }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, (gamer.wins / gamer.required) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, { color: colors.muted }]}>
                    {gamer.wins} / {gamer.required}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}

          {!!note && (
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>{note}</Text>
            </View>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <PushButton
          label={busy ? "Эхлүүлж байна…" : `Тоглоом эхлэх · ${shortOf}`}
          color={busy ? "rgba(255,255,255,0.12)" : colors.accent}
          shadowColor={busy ? "transparent" : colors.accentDark}
          textColor={busy ? "rgba(255,255,255,0.5)" : "#fff"}
          disabled={busy || rules.length === 0}
          onPress={start}
          textStyle={{ fontSize: 16 }}
          faceStyle={{ paddingVertical: 16 }}
        />
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressedDown]}
        >
          <Text style={styles.cancelText}>Болих</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34, gap: 12 },

  pressedDown: { transform: [{ translateY: 2 }] },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  backBtnText: { fontSize: 16, fontWeight: "800", color: "#fff", marginTop: -2 },

  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, color: PALETTE.yellow },
  title: { fontSize: 21, fontWeight: "900", color: "#fff", marginTop: 2 },

  lead: { fontSize: 12, fontWeight: "600", lineHeight: 18, color: "rgba(255,255,255,0.75)" },

  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },

  list: { gap: 9, paddingBottom: 8 },

  ruleCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
  },

  ruleCardLocked: { opacity: 0.72 },

  numBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  numText: { fontSize: 14, fontWeight: "800" },

  ruleTitle: { fontSize: 15, fontWeight: "800" },
  ruleBody: { fontSize: 11, fontWeight: "600", lineHeight: 17, marginTop: 3 },

  lockedTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },

  lockBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  lockBadgeText: { fontSize: 9, fontWeight: "800" },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 7 },
  progressTrack: { flex: 1, height: 5, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: PALETTE.orange },
  progressLabel: { fontSize: 10, fontWeight: "600" },

  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  tickText: { fontSize: 12, fontWeight: "800", color: "#fff" },

  noteBox: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "rgba(255,150,0,0.18)",
  },

  noteText: { fontSize: 11, fontWeight: "700", lineHeight: 17, color: "#FFD79A" },

  errorBox: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: PALETTE.redSoft,
  },

  errorText: { fontSize: 12, fontWeight: "700", color: PALETTE.redText },

  actions: { gap: 9, paddingTop: 8 },

  cancelBtn: {
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
  },

  cancelText: { fontSize: 14, fontWeight: "800", color: "rgba(255,255,255,0.8)" },
});
