import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { subscribeToRoomMatch, type RoomMatchEvent } from "../lib/socket";
import { PALETTE } from "../theme/colors";

// Тоглолтын дэлгэц дээр байхад урилга гаргахгүй
const BUSY_ROUTES = ["multiplayer", "multiplayerGame", "playScreen"];

/**
 * Миний гишүүн болсон найзын өрөөнд хост тоглолт нээхэд
 * аль ч дэлгэц дээр дээд талд гарч ирэх урилга.
 */
export default function RoomInviteBanner() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const [invite, setInvite] = useState<RoomMatchEvent | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToRoomMatch(setInvite);
  }, [user]);

  const route = segments[0] ?? "";
  if (!invite || BUSY_ROUTES.includes(route)) return null;

  const accept = () => {
    const matchId = invite.matchId;
    setInvite(null);
    router.push({ pathname: "/multiplayer", params: { matchId, mode: "friends" } });
  };

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.accent }]}
      pointerEvents="box-none"
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>
          {invite.hostName} тоглолт нээлээ
        </Text>
        <Text style={[styles.sub, { color: colors.subText }]} numberOfLines={1}>
          “{invite.roomName}” өрөө · одоо нэгдэх үү?
        </Text>
      </View>
      <Pressable onPress={() => setInvite(null)} style={styles.btnGhost}>
        <Text style={[styles.btnGhostText, { color: colors.muted }]}>Дараа</Text>
      </Pressable>
      <Pressable onPress={accept} style={styles.btn}>
        <Text style={styles.btnText}>Нэгдэх</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: { fontSize: 14, fontWeight: "900" },
  sub: { fontSize: 12, marginTop: 2 },
  btn: {
    backgroundColor: PALETTE.green,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  btnGhost: { paddingVertical: 9, paddingHorizontal: 8 },
  btnGhostText: { fontSize: 13, fontWeight: "800" },
});
