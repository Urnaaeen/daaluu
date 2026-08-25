import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BlurredBackdrop from "../components/BlurredBackdrop";
import Avatar from "../components/ui/Avatar";
import PushButton from "../components/ui/PushButton";
import { useAuth } from "../context/AuthContext";
import { usePresence } from "../context/PresenceContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../lib/api";
import {
  queueFillWithBots,
  queueJoin,
  queueLeave,
  queueSetRule,
  subscribeToQueue,
  type QueueState,
} from "../lib/socket";
import { AVATAR_COLORS, BLUR_BG, PALETTE } from "../theme/colors";

type EndRule = { id: string; num: number; title: string; short: string };

export default function Match() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { online } = usePresence();

  const [queue, setQueue] = useState<QueueState | null>(null);
  const [rules, setRules] = useState<EndRule[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const matched = useRef(false);

  // Тасралтгүй эргэх индикатор
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  // Дүрмийн жагсаалт
  useEffect(() => {
    api<{ rules: EndRule[] }>("/matches/end-rules")
      .then((res) => setRules(res.rules))
      .catch(() => {});
  }, []);

  // Дараалалд орж, төлөвийг сонсоно
  useEffect(() => {
    const unsubscribe = subscribeToQueue({
      onUpdate: setQueue,
      onMatched: (matchId) => {
        matched.current = true;
        router.replace({ pathname: "/multiplayerGame", params: { matchId } });
      },
      onError: setError,
    });

    queueJoin().then((res) => {
      if (res?.state) setQueue(res.state);
      else if (res && !res.ok) setError("Дараалалд орж чадсангүй.");
    });

    return () => {
      unsubscribe();
      // Тоглолт бүрдээгүй байж гарвал дарааллаас гарна
      if (!matched.current) queueLeave();
    };
  }, [router]);

  const leave = () => {
    queueLeave();
    router.back();
  };

  const fillWithBots = async () => {
    setBusy(true);
    setError("");
    const res = await queueFillWithBots();
    if (!res?.ok) {
      setBusy(false);
      setError("Тоглолт эхлүүлж чадсангүй. Дахин оролдоно уу.");
    }
    // Амжилттай бол queue:matched ирж дэлгэц солигдоно
  };

  const pickRule = async (id: string) => {
    setError("");
    const res = await queueSetRule(id);
    if (res?.error === "not_owner") setError("Дүрмийг эхэлж орсон тоглогч сонгоно.");
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const players = queue?.players ?? [];
  const size = queue?.size ?? 0;
  const needed = queue?.needed ?? 5;
  const isOwner = !!user && queue?.ownerId === user.id;
  const activeRule = rules.find((r) => r.id === queue?.endRule);
  const ownerName = players.find((p) => p.userId === queue?.ownerId)?.name ?? "";

  return (
    <View style={[styles.container, { backgroundColor: BLUR_BG }]}>
      <BlurredBackdrop />

      <View style={styles.topRow}>
        <Pressable
          onPress={leave}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressedDown]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false}>
        <View style={styles.ringWrap}>
          <Animated.View
            style={[
              styles.spinner,
              {
                borderColor: "rgba(255,255,255,0.18)",
                borderTopColor: colors.accent,
                transform: [{ rotate }],
              },
            ]}
          />
          <View style={styles.ringCount}>
            <Text style={styles.ringCountText}>{size}</Text>
            <Text style={styles.ringCountOf}>/ {needed}</Text>
          </View>
        </View>

        <View style={{ alignItems: "center" }}>
          <Text style={styles.title}>Тоглогч хайж байна…</Text>
          <Text style={styles.sub}>{online} хүн онлайн байна</Text>
        </View>

        {/* ДАРААЛАЛД БАЙГАА ХҮМҮҮС — 5 суудлын эгнээ */}
        <View style={styles.lineup}>
          {Array.from({ length: needed }).map((_, i) => {
            const p = players[i];
            if (!p) {
              return (
                <View key={`empty_${i}`} style={styles.slot}>
                  <View style={styles.slotEmpty}>
                    <Text style={styles.slotEmptyText}>+</Text>
                  </View>
                  <Text style={styles.slotWaiting} numberOfLines={1}>
                    хүлээж…
                  </Text>
                </View>
              );
            }

            const isMe = p.userId === user?.id;
            return (
              <View key={p.userId} style={styles.slot}>
                <View>
                  <Avatar
                    label={(p.name.trim()[0] ?? "?").toUpperCase()}
                    color={AVATAR_COLORS[i % 5]}
                    size={46}
                    radius={15}
                    fontSize={17}
                  />
                  {queue?.ownerId === p.userId && (
                    <View style={styles.crown}>
                      <Text style={styles.crownText}>★</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.slotName, isMe && { color: colors.accent }]} numberOfLines={1}>
                  {isMe ? "Чи" : p.name}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ТӨГСГӨЛИЙН ДҮРЭМ */}
        <View style={styles.ruleBox}>
          <Text style={styles.ruleLabel}>ТӨГСГӨЛИЙН ДҮРЭМ</Text>

          {isOwner ? (
            <View style={styles.ruleChips}>
              {rules.map((r) => {
                const active = r.id === queue?.endRule;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => pickRule(r.id)}
                    style={({ pressed }) => [
                      styles.ruleChip,
                      {
                        borderColor: active ? colors.accent : "rgba(255,255,255,0.25)",
                        backgroundColor: active ? colors.accent : "transparent",
                      },
                      pressed && styles.pressedDown,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ruleChipText,
                        { color: active ? "#fff" : "rgba(255,255,255,0.85)" },
                      ]}
                    >
                      {r.short}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.ruleReadonly}>
              <Text style={styles.ruleReadonlyValue}>{activeRule?.short ?? "…"}</Text>
              <Text style={styles.ruleHint} numberOfLines={2}>
                {ownerName
                  ? `${ownerName} сонгоно — эхэлж орсон тоглогч дүрмээ тогтооно.`
                  : "Эхэлж орсон тоглогч дүрмээ тогтооно."}
              </Text>
            </View>
          )}
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <PushButton
          label={busy ? "Эхлүүлж байна…" : "Хүлээхгүй, ботоор нөхөх"}
          color={busy ? "rgba(255,255,255,0.12)" : colors.accent}
          shadowColor={busy ? "transparent" : colors.accentDark}
          textColor={busy ? "rgba(255,255,255,0.5)" : "#fff"}
          disabled={busy || size === 0}
          onPress={fillWithBots}
          textStyle={{ fontSize: 16 }}
        />
        <Pressable
          onPress={leave}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressedDown]}
        >
          <Text style={styles.cancelText}>Цуцлах</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 34,
  },

  pressedDown: { transform: [{ translateY: 2 }] },

  topRow: { flexDirection: "row" },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  backText: { fontSize: 18, fontWeight: "800", marginTop: -2, color: "#fff" },

  center: {
    alignItems: "center",
    gap: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },

  ringWrap: { width: 92, height: 92, alignItems: "center", justifyContent: "center" },

  spinner: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 5,
  },

  ringCount: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  ringCountText: { fontSize: 26, fontWeight: "900", color: "#fff" },
  ringCountOf: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.7)" },

  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  sub: { fontSize: 13, fontWeight: "600", marginTop: 6, color: "rgba(255,255,255,0.85)" },

  lineup: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 2,
  },

  slot: { alignItems: "center", gap: 6, width: "18%" },

  slotEmpty: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  slotEmptyText: { fontSize: 18, fontWeight: "800", color: "rgba(255,255,255,0.35)" },

  slotName: { fontSize: 11, fontWeight: "800", color: "#fff", maxWidth: "100%" },
  slotWaiting: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.4)" },

  // Дүрэм сонгогчийн тэмдэг
  crown: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PALETTE.goldSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  crownText: { fontSize: 11, fontWeight: "900", color: PALETTE.gold, marginTop: -1 },

  ruleBox: { width: "100%", gap: 8 },

  ruleLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.9,
    color: "rgba(255,255,255,0.7)",
  },

  ruleChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },

  // 2 баганаар — 4 дүрэм тэгш байрлана
  ruleChip: {
    width: "48.6%",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 2,
  },

  ruleChipText: { fontSize: 12, fontWeight: "800" },

  ruleReadonly: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    gap: 3,
  },

  ruleReadonlyValue: { fontSize: 15, fontWeight: "900", color: "#fff" },

  ruleHint: { fontSize: 11, fontWeight: "600", lineHeight: 16, color: "rgba(255,255,255,0.7)" },

  errorBox: {
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PALETTE.redSoft,
  },

  errorText: { fontSize: 12, fontWeight: "700", color: PALETTE.redText },

  actions: { gap: 10 },

  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
  },

  cancelText: { fontSize: 14, fontWeight: "800", color: "rgba(255,255,255,0.8)" },
});
