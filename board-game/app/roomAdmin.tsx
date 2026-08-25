import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Avatar from "../components/ui/Avatar";
import PushButton from "../components/ui/PushButton";
import { useAppState, type RoomMember } from "../context/AppStateContext";
import { useTheme } from "../context/ThemeContext";
import { AVATAR_COLORS, MONO, PALETTE } from "../theme/colors";

export default function RoomAdmin() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    coins,
    rooms,
    roomPrice,
    playerName,
    playerId,
    loadingRooms,
    refreshRooms,
    buyRoom,
    roomMembers,
    inviteToRoom,
    removeFromRoom,
  } = useAppState();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [inviteId, setInviteId] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [noCoins, setNoCoins] = useState(false);

  useEffect(() => {
    refreshRooms();
  }, []);

  const openRoom = async (roomId: string) => {
    setExpanded(roomId);
    setInviteError("");
    setInviteId("");
    setMembers(await roomMembers(roomId));
  };

  const handleInvite = async () => {
    if (!expanded) return;
    setBusy(true);
    const err = await inviteToRoom(expanded, inviteId.trim());
    setBusy(false);
    setInviteError(err ?? "");
    if (!err) {
      setInviteId("");
      setMembers(await roomMembers(expanded));
    }
  };

  const handleRemove = async (userId: string) => {
    if (!expanded) return;
    await removeFromRoom(expanded, userId);
    setMembers(await roomMembers(expanded));
  };

  const handleBuy = async () => {
    setBusy(true);
    const err = await buyRoom("Шинэ өрөө");
    setBusy(false);
    if (err) {
      if (err.includes("хүрэлцэхгүй")) setNoCoins(true);
      else setInviteError(err);
    }
  };

  const lobbyCount = 1 + members.length;
  const ready = members.length >= 4;

  // Хост + уригдсан гишүүд + хоосон суудлууд
  const slots = [
    {
      key: "me",
      name: playerName,
      note: `Чи · ${playerId}`,
      initial: (playerName.trim()[0] ?? "Т").toUpperCase(),
      color: AVATAR_COLORS[0],
      isHost: true,
      userId: null as string | null,
      empty: false,
    },
    ...members.map((m, i) => ({
      key: m.id,
      name: m.name,
      note: `${m.player_code} · ${m.status === "joined" ? "Нэгдсэн" : "Уриа илгээсэн"}`,
      initial: (m.name.trim()[0] ?? "?").toUpperCase(),
      color: AVATAR_COLORS[(i + 1) % 5],
      isHost: false,
      userId: m.id,
      empty: false,
    })),
    ...Array.from({ length: Math.max(0, 4 - members.length) }, (_, i) => ({
      key: `empty_${i}`,
      name: "Хоосон суудал",
      note: "ID-гаар урина",
      initial: "+",
      color: colors.sunken,
      isHost: false,
      userId: null as string | null,
      empty: true,
    })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Миний өрөөнүүд</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Найзуудтайгаа тоглох хаалттай өрөө
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/coins")}
          style={({ pressed }) => [styles.coinPill, pressed && styles.pressedDown]}
        >
          <Text style={styles.coinPillText}>🪙 {coins}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {loadingRooms && rooms.length === 0 && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {!loadingRooms && rooms.length === 0 && (
          <View style={[styles.emptyBox, { backgroundColor: colors.sunken }]}>
            <Text style={[styles.emptyText, { color: colors.subText }]}>
              Одоогоор өрөө байхгүй байна. Доорх товчоор шинэ өрөө аваарай.
            </Text>
          </View>
        )}

        {rooms.map((room) => {
          const open = expanded === room.id;
          return (
            <View
              key={room.id}
              style={[
                styles.roomCard,
                { backgroundColor: colors.card, borderColor: open ? colors.accent : colors.border },
              ]}
            >
              <View style={styles.roomHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roomName, { color: colors.text }]}>{room.name}</Text>
                  <Text style={[styles.roomMeta, { color: colors.muted }]}>
                    {(open ? lobbyCount : room.member_count + 1)} тоглогч
                  </Text>
                </View>
                <Text style={[styles.roomCode, { color: colors.subText }]}>{room.code}</Text>
              </View>

              {!open ? (
                <PushButton
                  label="Урих"
                  color={colors.accent}
                  shadowColor={colors.accentDark}
                  radius={14}
                  onPress={() => openRoom(room.id)}
                  faceStyle={{ paddingVertical: 12 }}
                  textStyle={{ fontSize: 13 }}
                />
              ) : (
                <View style={{ gap: 10 }}>
                  <View style={styles.slotsHead}>
                    <Text style={[styles.slotsLabel, { color: colors.muted }]}>
                      УРИГДСАН ТОГЛОГЧИД
                    </Text>
                    <Text
                      style={[styles.slotsCount, { color: ready ? PALETTE.green : colors.subText }]}
                    >
                      {lobbyCount} / 5
                    </Text>
                  </View>

                  <View style={{ gap: 8 }}>
                    {slots.map((s) => (
                      <View
                        key={s.key}
                        style={[
                          styles.slot,
                          {
                            backgroundColor: s.empty ? "transparent" : colors.card,
                            borderColor: colors.border,
                            borderStyle: s.empty ? "dashed" : "solid",
                          },
                        ]}
                      >
                        <Avatar
                          label={s.initial}
                          color={s.color}
                          size={34}
                          radius={11}
                          fontSize={13}
                          textColor={s.empty ? colors.muted : "#fff"}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[styles.slotName, { color: s.empty ? colors.muted : colors.text }]}
                            numberOfLines={1}
                          >
                            {s.name}
                          </Text>
                          <Text
                            style={[styles.slotNote, { color: colors.muted }]}
                            numberOfLines={1}
                          >
                            {s.note}
                          </Text>
                        </View>
                        {s.isHost && (
                          <View style={styles.hostBadge}>
                            <Text style={styles.hostBadgeText}>Хост</Text>
                          </View>
                        )}
                        {s.userId && (
                          <Pressable
                            onPress={() => handleRemove(s.userId!)}
                            style={[styles.removeBtn, { backgroundColor: colors.sunken }]}
                          >
                            <Text style={styles.removeText}>✕</Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>

                  <View>
                    <Text style={[styles.slotsLabel, { color: colors.muted, marginBottom: 6 }]}>
                      ID-ГААР УРИХ
                    </Text>
                    <View style={styles.inviteRow}>
                      <TextInput
                        value={inviteId}
                        onChangeText={setInviteId}
                        placeholder="daaluu#0000"
                        placeholderTextColor={colors.muted}
                        autoCapitalize="none"
                        editable={!busy}
                        style={[
                          styles.inviteInput,
                          {
                            backgroundColor: colors.sunken,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                      />
                      <PushButton
                        label="Урих"
                        color={colors.accent}
                        shadowColor={colors.accentDark}
                        radius={14}
                        disabled={busy}
                        onPress={handleInvite}
                        faceStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}
                        textStyle={{ fontSize: 12 }}
                      />
                    </View>

                    {!!inviteError && (
                      <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{inviteError}</Text>
                      </View>
                    )}
                  </View>

                  <PushButton
                    label={ready ? "Тоглоом эхлүүлэх" : "Тоглогч хүлээж байна"}
                    color={ready ? PALETTE.green : colors.sunken}
                    shadowColor={ready ? PALETTE.greenDark : "transparent"}
                    textColor={ready ? "#fff" : colors.muted}
                    disabled={!ready}
                    onPress={() =>
                      router.push({ pathname: "/setup", params: { roomId: room.id } })
                    }
                    radius={15}
                    textStyle={{ fontSize: 15 }}
                  />
                  <Text style={[styles.startHint, { color: colors.muted }]}>
                    {ready
                      ? "Бүгд бүрдлээ · эхлүүлэх боломжтой"
                      : `${4 - members.length} тоглогч дутуу · ID-гаар урь`}
                  </Text>

                  <Pressable onPress={() => setExpanded(null)} style={styles.collapseBtn}>
                    <Text style={[styles.collapseText, { color: colors.muted }]}>Хаах</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        <Pressable
          onPress={handleBuy}
          disabled={busy}
          style={({ pressed }) => [
            styles.buyBtn,
            { borderColor: colors.border, opacity: busy ? 0.6 : 1 },
            pressed && styles.pressedDown,
          ]}
        >
          <Text style={[styles.buyText, { color: colors.subText }]}>
            + Шинэ өрөө авах · 🪙 {roomPrice}
          </Text>
        </Pressable>

        <Text style={[styles.footNote, { color: colors.muted }]}>
          Өрөө худалдаж авсны дараа хугацаагүй ашиглана. Уригдсан найзууд үнэгүй холбогдоно.
        </Text>
      </ScrollView>

      {noCoins && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setNoCoins(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <Text style={styles.modalCoin}>🪙</Text>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Зоос хүрэлцэхгүй</Text>
              <Text style={[styles.modalBody, { color: colors.subText }]}>
                Өрөө үүсгэхэд {roomPrice} зоос шаардана. Одоо {coins} зоос байна.
              </Text>
              <PushButton
                label="Зоос цэнэглэх"
                color={PALETTE.orange}
                shadowColor={PALETTE.orangeDark}
                onPress={() => {
                  setNoCoins(false);
                  router.push("/coins");
                }}
                style={{ width: "100%" }}
              />
              <Pressable onPress={() => setNoCoins(false)} style={styles.laterBtn}>
                <Text style={[styles.laterText, { color: colors.muted }]}>Дараа</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressedDown: { transform: [{ translateY: 2 }] },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 12,
  },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  backText: { fontSize: 18, fontWeight: "800", marginTop: -2 },
  title: { fontSize: 19, fontWeight: "800" },
  sub: { fontSize: 12, fontWeight: "600", marginTop: 1 },

  coinPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PALETTE.goldSoft,
  },

  coinPillText: { fontSize: 12, fontWeight: "800", color: PALETTE.gold },

  list: { paddingHorizontal: 22, paddingBottom: 44, gap: 10 },

  loadingBox: { paddingVertical: 30, alignItems: "center" },
  emptyBox: { padding: 16, borderRadius: 18 },
  emptyText: { fontSize: 12, fontWeight: "600", lineHeight: 19, textAlign: "center" },

  roomCard: { padding: 14, borderRadius: 20, borderWidth: 2, gap: 10 },

  roomHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roomName: { fontSize: 16, fontWeight: "800" },
  roomMeta: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  roomCode: { fontSize: 22, fontFamily: MONO, letterSpacing: 4 },

  slotsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slotsLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.9 },
  slotsCount: { fontSize: 12, fontFamily: MONO },

  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
  },

  slotName: { fontSize: 14, fontWeight: "800" },
  slotNote: { fontSize: 10, fontWeight: "600", marginTop: 1 },

  hostBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: PALETTE.hostSoft,
  },

  hostBadgeText: { fontSize: 10, fontWeight: "800", color: PALETTE.hostText },

  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  removeText: { fontSize: 13, fontWeight: "800", color: PALETTE.red },

  inviteRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },

  inviteInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 14,
    fontFamily: MONO,
  },

  errorBox: {
    marginTop: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: PALETTE.redSoft,
  },

  errorText: { fontSize: 11, fontWeight: "700", color: PALETTE.redText },

  startHint: { fontSize: 11, fontWeight: "600", textAlign: "center" },

  collapseBtn: { paddingVertical: 10, alignItems: "center" },
  collapseText: { fontSize: 12, fontWeight: "800" },

  buyBtn: {
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
  },

  buyText: { fontSize: 15, fontWeight: "800" },

  footNote: { fontSize: 12, fontWeight: "600", lineHeight: 19, marginTop: 6 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,12,16,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },

  modalCard: {
    width: "100%",
    maxWidth: 300,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },

  modalCoin: { fontSize: 34 },
  modalTitle: { fontSize: 19, fontWeight: "900", textAlign: "center" },
  modalBody: { fontSize: 13, fontWeight: "600", lineHeight: 20, textAlign: "center", marginBottom: 4 },

  laterBtn: { paddingVertical: 13, alignItems: "center" },
  laterText: { fontSize: 14, fontWeight: "800" },
});
