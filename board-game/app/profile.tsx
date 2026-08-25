import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Avatar from "../components/ui/Avatar";
import { useAppState, type HistoryEntry } from "../context/AppStateContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { MONO, PALETTE } from "../theme/colors";

const MODE_LABEL = { random: "Санамсаргүй", friends: "Найзуудтай" } as const;

/** "Өнөөдөр", "Өчигдөр", "3 хоног" */
const whenText = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Өнөөдөр";
  if (days === 1) return "Өчигдөр";
  return `${days} хоног`;
};

const historyDetail = (h: HistoryEntry) =>
  [`${h.player_count} тоглогч`, h.room_name ?? (h.mode === "random" ? "онлайн" : null)]
    .filter(Boolean)
    .join(" · ");

export default function Profile() {
  const router = useRouter();
  const { colors, theme, toggleTheme } = useTheme();
  const { user, stats, signOut, updateName, refresh } = useAuth();
  const { playerName, playerId, coins, history, refreshHistory } = useAppState();

  const [draft, setDraft] = useState(playerName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const saved = draft.trim() === playerName;

  useEffect(() => {
    setDraft(playerName);
  }, [playerName]);

  // Дэлгэц нээгдэхэд зоос, статистик, түүхийг шинэчилнэ
  useEffect(() => {
    refresh();
    refreshHistory();
  }, []);

  const nameInitial = (playerName.trim()[0] ?? "Т").toUpperCase();

  const save = async () => {
    setSaving(true);
    setError("");
    const err = await updateName(draft);
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressedDown,
          ]}
        >
          <Text style={[styles.backText, { color: colors.text }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Профайл</Text>
        <Pressable
          onPress={toggleTheme}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressedDown,
          ]}
        >
          <Text style={styles.themeIcon}>{theme === "dark" ? "🌙" : "☀️"}</Text>
        </Pressable>
      </View>

      {/* IDENTITY */}
      <View style={[styles.identityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Avatar label={nameInitial} color={colors.accent} size={56} radius={18} fontSize={22} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.identityName, { color: colors.text }]} numberOfLines={1}>
            {playerName}
          </Text>
          <Text style={[styles.identityId, { color: colors.muted }]}>ID · {playerId}</Text>
          <Text style={[styles.identityAccount, { color: colors.muted }]} numberOfLines={1}>
            {user?.email ?? ""}
          </Text>
        </View>
      </View>

      {/* NAME EDIT */}
      <View>
        <Text style={[styles.label, { color: colors.muted }]}>ТОГЛОГЧИЙН НЭР</Text>
        <View style={styles.nameRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            editable={!saving}
            style={[
              styles.nameInput,
              {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: saved ? colors.border : colors.accent,
              },
            ]}
            placeholder="Нэрээ оруулна уу"
            placeholderTextColor={colors.muted}
          />
          <Pressable
            onPress={save}
            disabled={saved || saving}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: saved ? colors.sunken : colors.accent },
              pressed && !saved && styles.pressedDown,
            ]}
          >
            <Text style={[styles.saveText, { color: saved ? colors.subText : "#fff" }]}>
              {saving ? "…" : saved ? "Хадгалсан" : "Хадгалах"}
            </Text>
          </Pressable>
        </View>
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {/* COINS */}
      <View>
        <Text style={[styles.label, { color: colors.muted }]}>ЗООС</Text>
        <View style={[styles.coinsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View>
            <Text style={styles.coinsValue}>🪙 {coins}</Text>
            <Text style={[styles.coinsHint, { color: colors.muted }]}>1 өрөө = 50 зоос</Text>
          </View>
          <Pressable
            onPress={() => router.push("/coins")}
            style={({ pressed }) => [styles.topupBtn, pressed && styles.pressedDown]}
          >
            <Text style={styles.topupText}>Цэнэглэх</Text>
          </Pressable>
        </View>
      </View>

      {/* STATS */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats?.wins ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>ХОЖИЛ</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats?.plays ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>ТОГЛОЛТ</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: PALETTE.gold }]}>{stats?.win_rate ?? 0}%</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>ХУВЬ</Text>
        </View>
      </View>

      {/* HISTORY */}
      <View>
        <Text style={[styles.label, { color: colors.muted }]}>ТОГЛОСОН ТҮҮХ</Text>

        {history.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.sunken }]}>
            <Text style={[styles.emptyText, { color: colors.subText }]}>
              Онлайн тоглолт хараахан хийгээгүй байна. Боттой тоглолт түүхэнд бүртгэгддэггүй.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {history.map((h) => {
              const won = h.place === 1;
              return (
                <View
                  key={h.match_id}
                  style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.historyBadge,
                      { backgroundColor: won ? PALETTE.goldSoft : colors.sunken },
                    ]}
                  >
                    <Text style={[styles.historyBadgeText, { color: won ? PALETTE.gold : colors.subText }]}>
                      {won ? "🏆" : String(h.place)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.historyMode, { color: colors.text }]}>
                      {MODE_LABEL[h.mode] ?? h.mode}
                    </Text>
                    <Text style={[styles.historyDetail, { color: colors.muted }]} numberOfLines={1}>
                      {historyDetail(h)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.historyScore, { color: won ? PALETTE.gold : colors.text }]}>
                      {won ? "1-р байр" : `${h.tsai} цай`}
                    </Text>
                    <Text style={[styles.historyWhen, { color: colors.muted }]}>
                      {whenText(h.ended_at)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ГАРАХ */}
      <Pressable
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
        style={({ pressed }) => [
          styles.signOutBtn,
          { borderColor: colors.border },
          pressed && styles.pressedDown,
        ]}
      >
        <Text style={styles.signOutText}>Бүртгэлээс гарах</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 44,
    gap: 14,
  },

  pressedDown: { transform: [{ translateY: 2 }] },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  backText: { fontSize: 18, fontWeight: "800", marginTop: -2 },
  themeIcon: { fontSize: 15 },
  title: { flex: 1, fontSize: 19, fontWeight: "800" },

  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
  },

  identityName: { fontSize: 18, fontWeight: "800" },
  identityId: { fontSize: 12, fontFamily: MONO, marginTop: 3 },
  identityAccount: { fontSize: 11, fontWeight: "600", marginTop: 2 },

  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.9, marginBottom: 8 },

  nameRow: { flexDirection: "row", gap: 8 },

  nameInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    fontSize: 16,
    fontWeight: "700",
  },

  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: "center",
  },

  saveText: { fontSize: 13, fontWeight: "800" },

  errorBox: {
    marginTop: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: PALETTE.redSoft,
  },

  errorText: { fontSize: 11, fontWeight: "700", color: PALETTE.redText },

  coinsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
  },

  coinsValue: { fontSize: 30, fontFamily: MONO, color: PALETTE.gold },
  coinsHint: { fontSize: 11, fontWeight: "600", marginTop: 4 },

  topupBtn: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: PALETTE.orange,
  },

  topupText: { fontSize: 13, fontWeight: "800", color: "#fff" },

  statsRow: { flexDirection: "row", gap: 8 },

  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
  },

  statValue: { fontSize: 22, fontFamily: MONO },
  statLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginTop: 2 },

  emptyBox: { padding: 14, borderRadius: 16 },
  emptyText: { fontSize: 12, fontWeight: "600", lineHeight: 19 },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
  },

  historyBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  historyBadgeText: { fontSize: 13, fontWeight: "800" },
  historyMode: { fontSize: 14, fontWeight: "800" },
  historyDetail: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  historyScore: { fontSize: 13, fontWeight: "800" },
  historyWhen: { fontSize: 10, fontWeight: "600", marginTop: 1 },

  signOutBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    marginTop: 4,
  },

  signOutText: { fontSize: 14, fontWeight: "800", color: PALETTE.red },
});
