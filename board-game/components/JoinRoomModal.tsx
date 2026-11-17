import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { api, ApiError } from "../lib/api";
import { subscribeToRoomMatch } from "../lib/socket";
import { MONO, PALETTE } from "../theme/colors";
import PushButton from "./ui/PushButton";

type JoinedRoom = {
  id: string;
  name: string;
  code: string;
  owner_name: string;
  my_status: "invited" | "joined";
  lobby_match_id: string | null;
};

type JoinResult = {
  room: { id: string; name: string; code: string; ownerName: string };
  isOwner: boolean;
  matchId: string | null;
  playing: boolean;
};

/**
 * Найзын өрөөнд 4 оронтой кодоор нэгдэх.
 * RN Web дээр <Modal visible={false}> дэлгэц хөлдөөдөг тул энгийн overlay View —
 * эцэг нь зөвхөн нээлттэй үед render хийнэ.
 */
export default function JoinRoomModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState<JoinResult["room"] | null>(null);
  const [myRooms, setMyRooms] = useState<JoinedRoom[]>([]);

  const goToLobby = (matchId: string) => {
    onClose();
    router.push({ pathname: "/multiplayer", params: { matchId, mode: "friends" } });
  };

  // Өмнө нь нэгдсэн / уригдсан өрөөнүүд
  useEffect(() => {
    api<{ rooms: JoinedRoom[] }>("/rooms/joined")
      .then((r) => setMyRooms(r.rooms))
      .catch(() => {});
  }, []);

  // Хост тоглолт нээхийг хүлээж байгаа бол нээгдэнгүүт лобби руу орно
  useEffect(() => {
    if (!waiting) return;
    return subscribeToRoomMatch((e) => {
      if (e.roomId === waiting.id) goToLobby(e.matchId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  const join = async (value = code) => {
    if (!/^\d{4}$/.test(value)) {
      setError("4 оронтой код оруулна уу.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api<JoinResult>("/rooms/join", { method: "POST", body: { code: value } });
      if (res.isOwner) {
        setError("Энэ таны өөрийн өрөө. “Өөрийн хүмүүстэй” цэснээс тоглолт эхлүүлнэ үү.");
      } else if (res.matchId) {
        goToLobby(res.matchId);
      } else if (res.playing) {
        setError("Энэ өрөөнд тоглолт явагдаж байна. Дууссаны дараа дахин оролдоорой.");
      } else {
        setWaiting(res.room);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Нэгдэж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Найзын өрөөнд нэгдэх</Text>

        {waiting ? (
          <View style={styles.waitBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.waitTitle, { color: colors.text }]}>
              “{waiting.name}” өрөөнд нэгдлээ
            </Text>
            <Text style={[styles.sub, { color: colors.subText }]}>
              {waiting.ownerName} тоглолт нээхийг хүлээж байна. Нээгдмэгц автоматаар орно.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sub, { color: colors.subText }]}>
              Өрөөний эзнээс 4 оронтой кодыг нь асуугаарай.
            </Text>
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
              onSubmitEditing={() => join()}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={colors.muted}
              autoFocus
              style={[
                styles.codeInput,
                { color: colors.text, backgroundColor: colors.sunken, borderColor: colors.border },
              ]}
            />
            <PushButton
              label={busy ? "Шалгаж байна…" : "Нэгдэх"}
              onPress={() => join()}
              disabled={busy || code.length !== 4}
              color={colors.accent}
              shadowColor={colors.accentDark}
            />

            {myRooms.length > 0 && (
              <View style={styles.list}>
                <Text style={[styles.listTitle, { color: colors.muted }]}>МИНИЙ ӨРӨӨНҮҮД</Text>
                {myRooms.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => (r.lobby_match_id ? goToLobby(r.lobby_match_id) : join(r.code))}
                    style={({ pressed }) => [
                      styles.roomRow,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roomName, { color: colors.text }]}>{r.name}</Text>
                      <Text style={[styles.roomMeta, { color: colors.subText }]}>
                        {r.owner_name} · <Text style={{ fontFamily: MONO }}>{r.code}</Text>
                      </Text>
                    </View>
                    {r.lobby_match_id ? (
                      <View style={styles.liveBadge}>
                        <Text style={styles.liveBadgeText}>Нээлттэй</Text>
                      </View>
                    ) : (
                      <Text style={[styles.roomMeta, { color: colors.muted }]}>
                        {r.my_status === "invited" ? "Уригдсан" : "Хүлээх"}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: colors.muted }]}>Хаах</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    zIndex: 50,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 2,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: "900", textAlign: "center" },
  sub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  codeInput: {
    fontSize: 32,
    fontFamily: MONO,
    letterSpacing: 12,
    textAlign: "center",
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 12,
  },
  waitBox: { alignItems: "center", gap: 10, paddingVertical: 12 },
  waitTitle: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  list: { gap: 8, marginTop: 4 },
  listTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  roomName: { fontSize: 15, fontWeight: "800" },
  roomMeta: { fontSize: 12, marginTop: 2 },
  liveBadge: {
    backgroundColor: PALETTE.greenSoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveBadgeText: { color: PALETTE.greenText, fontSize: 11, fontWeight: "900" },
  error: { color: PALETTE.red, fontSize: 13, textAlign: "center", fontWeight: "700" },
  closeBtn: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: 16 },
  closeText: { fontSize: 14, fontWeight: "800" },
});
