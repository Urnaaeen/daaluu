import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Avatar from "../components/ui/Avatar";
import PushButton from "../components/ui/PushButton";
import { useTheme } from "../context/ThemeContext";
import { api, ApiError } from "../lib/api";
import { subscribeToMatch, type MatchState } from "../lib/socket";
import { AVATAR_COLORS, MONO, PALETTE } from "../theme/colors";

export default function Lobby() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams();

  const roomId = typeof params.roomId === "string" ? params.roomId : null;
  const mode = typeof params.mode === "string" ? params.mode : roomId ? "friends" : "random";

  const [matchId, setMatchId] = useState<string | null>(
    typeof params.matchId === "string" ? params.matchId : null
  );
  const [state, setState] = useState<MatchState | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const created = useRef(false);

  // Тоглолт үүсгэх (эсвэл өгөгдсөнд нэгдэх)
  useEffect(() => {
    if (created.current) return;
    created.current = true;

    (async () => {
      try {
        if (matchId) {
          await api(`/matches/${matchId}/join`, { method: "POST" });
          return;
        }
        const res = await api<{ matchId: string }>("/matches", {
          method: "POST",
          body: { mode, roomId, turnSeconds: 20 },
        });
        setMatchId(res.matchId);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Тоглолт үүсгэж чадсангүй.");
      }
    })();
  }, [matchId, mode, roomId]);

  // Realtime төлөв
  useEffect(() => {
    if (!matchId) return;
    return subscribeToMatch(matchId, setState);
  }, [matchId]);

  // Тоглоом эхлэхэд ширээ рүү шилжинэ
  useEffect(() => {
    if (state?.match.status === "playing") {
      router.replace({ pathname: "/multiplayerGame", params: { matchId: state.match.id } });
    }
  }, [state?.match.status, state?.match.id, router]);

  const start = async () => {
    if (!matchId) return;
    setStarting(true);
    setError("");
    try {
      await api(`/matches/${matchId}/start`, { method: "POST" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Эхлүүлж чадсангүй.");
      setStarting(false);
    }
  };

  const players = state?.players ?? [];
  const me = players.find((p) => p.isMe);
  const isHost = !!me?.isHost;
  const emptyCount = Math.max(0, 5 - players.length);

  if (!state) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        {error ? (
          <>
            <Text style={[styles.errorBig, { color: colors.text }]}>{error}</Text>
            <Pressable
              onPress={() => router.back()}
              style={[styles.leaveBtn, { borderColor: colors.border, marginTop: 16 }]}
            >
              <Text style={[styles.leaveBtnText, { color: colors.muted }]}>Буцах</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.subText }]}>
              Тоглолт бэлдэж байна…
            </Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressedDown,
          ]}
        >
          <Text style={[styles.backBtnText, { color: colors.text }]}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Хүлээх өрөө</Text>
          <Text style={[styles.roomCode, { color: colors.muted }]}>
            {mode === "friends" ? "Найзуудтай" : "Санамсаргүй"} · {state.match.id.slice(0, 8)}
          </Text>
        </View>
      </View>

      {/* СТАТУС */}
      <View style={[styles.statusCard, { backgroundColor: colors.sunken }]}>
        <ActivityIndicator size="small" color={colors.accent} style={styles.statusSpinner} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            {isHost ? "Эхлүүлэхэд бэлэн" : "Хост эхлүүлэхийг хүлээж байна"}
          </Text>
          <Text style={[styles.statusHint, { color: colors.muted }]}>
            {emptyCount > 0
              ? `${emptyCount} суудал сул · эхлэхэд ботоор нөхөгдөнө`
              : "Бүгд бүрдсэн · 5/5"}
          </Text>
        </View>
        <Text style={[styles.statusCount, { color: colors.subText }]}>{players.length}/5</Text>
      </View>

      {/* ТОГЛОГЧИД */}
      <ScrollView style={styles.playersScroll} contentContainerStyle={styles.playersList}>
        {players.map((p) => (
          <View
            key={p.seat}
            style={[
              styles.slot,
              { backgroundColor: colors.card, borderColor: p.isMe ? colors.accent : colors.border },
            ]}
          >
            <Avatar
              label={(p.name.trim()[0] ?? "?").toUpperCase()}
              color={AVATAR_COLORS[p.seat % 5]}
            />
            <View style={styles.slotBody}>
              <Text style={[styles.slotName, { color: colors.text }]} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={[styles.slotNote, { color: colors.muted }]}>
                {[p.isMe ? "Чи" : null, p.isBot ? "Бот" : p.playerCode].filter(Boolean).join(" · ")}
              </Text>
            </View>
            {p.isHost && (
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>Хост</Text>
              </View>
            )}
          </View>
        ))}

        {Array.from({ length: emptyCount }).map((_, idx) => (
          <View
            key={`empty_${idx}`}
            style={[styles.slot, styles.slotEmpty, { borderColor: colors.border }]}
          >
            <Avatar label="+" color={colors.sunken} textColor={colors.muted} />
            <View style={styles.slotBody}>
              <Text style={[styles.slotName, { color: colors.muted }]}>Хоосон суудал</Text>
              <Text style={[styles.slotNote, { color: colors.muted }]}>Ботоор нөхөгдөнө</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.buttonsContainer}>
        {isHost && (
          <PushButton
            label={starting ? "Эхлүүлж байна…" : "Тоглоом эхлүүлэх"}
            color={starting ? colors.sunken : PALETTE.green}
            shadowColor={starting ? "transparent" : PALETTE.greenDark}
            textColor={starting ? colors.muted : "#fff"}
            disabled={starting}
            onPress={start}
          />
        )}

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.leaveBtn,
            { borderColor: colors.border },
            pressed && styles.pressedDown,
          ]}
        >
          <Text style={[styles.leaveBtnText, { color: colors.muted }]}>Өрөөнөөс гарах</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24 },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { fontSize: 14, fontWeight: "600", marginTop: 14 },
  errorBig: { fontSize: 15, fontWeight: "700", textAlign: "center" },

  pressedDown: { transform: [{ translateY: 2 }] },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },

  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  backBtnText: { fontSize: 18, fontWeight: "800", marginTop: -2 },
  title: { fontSize: 19, fontWeight: "800" },
  roomCode: { fontSize: 13, fontFamily: MONO, marginTop: 1 },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    marginBottom: 14,
  },

  statusSpinner: { width: 34, height: 34 },
  statusTitle: { fontSize: 14, fontWeight: "800" },
  statusHint: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  statusCount: { fontSize: 15, fontFamily: MONO },

  playersScroll: { flex: 1 },
  playersList: { gap: 10, paddingBottom: 10 },

  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 2,
  },

  slotEmpty: { borderStyle: "dashed", backgroundColor: "transparent" },
  slotBody: { flex: 1, minWidth: 0 },
  slotName: { fontSize: 15, fontWeight: "800" },
  slotNote: { fontSize: 11, fontWeight: "600", marginTop: 1 },

  hostBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: PALETTE.hostSoft,
  },

  hostBadgeText: { fontSize: 11, fontWeight: "800", color: PALETTE.hostText },

  errorBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PALETTE.redSoft,
    marginBottom: 10,
  },

  errorText: { fontSize: 12, fontWeight: "700", color: PALETTE.redText },

  buttonsContainer: { gap: 10, marginTop: 6 },

  leaveBtn: { paddingVertical: 14, borderRadius: 16, borderWidth: 2, alignItems: "center" },
  leaveBtnText: { fontSize: 14, fontWeight: "800" },
});
