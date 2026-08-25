import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PushButton from "../components/ui/PushButton";
import { useAppState, type CoinPack } from "../context/AppStateContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api, ApiError } from "../lib/api";
import { MONO, PALETTE } from "../theme/colors";

type BankUrl = { name: string; scheme: string; link: string };

type Payment = {
  id: number;
  pack_coins: number;
  price_mnt: number;
  qr_text: string;
  bank_urls: BankUrl[];
  status: string;
};

export default function Coins() {
  const router = useRouter();
  const { colors } = useTheme();
  const { coins, packs } = useAppState();
  const { refresh } = useAuth();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  const closeSheet = () => {
    setPayment(null);
    setPaid(false);
    setError("");
  };

  const createInvoice = async (pack: CoinPack) => {
    setCreating(true);
    setError("");
    try {
      const res = await api<{ payment: Payment }>("/coins/invoice", {
        method: "POST",
        body: { packId: pack.id },
      });
      setPaid(false);
      setPayment(res.payment);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Нэхэмжлэх үүсгэж чадсангүй.");
    } finally {
      setCreating(false);
    }
  };

  // Банкны апп руу үсрэх — суулгаагүй бол алдаа өгнө
  const openBank = async (bank: BankUrl) => {
    try {
      const can = await Linking.canOpenURL(bank.link);
      if (!can) {
        setError(`${bank.name} апп олдсонгүй. Суулгасан эсэхээ шалгана уу.`);
        return;
      }
      await Linking.openURL(bank.link);
    } catch {
      setError(`${bank.name} апп нээгдсэнгүй.`);
    }
  };

  // Мерчант эрх авах хүртэлх demo баталгаажуулалт
  const demoPay = async () => {
    if (!payment) return;
    setPaying(true);
    setError("");
    try {
      await api(`/coins/invoice/${payment.id}/demo-pay`, { method: "POST" });
      await refresh();
      setPaid(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Төлбөр баталгаажсангүй.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
            <Text style={[styles.title, { color: colors.text }]}>Зоос цэнэглэх</Text>
            <Text style={[styles.sub, { color: colors.muted }]}>Одоо: 🪙 {coins} зоос</Text>
          </View>
        </View>

        {!!error && !payment && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {packs.length === 0 ? (
          <View style={[styles.note, { backgroundColor: colors.sunken }]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.noteText, { color: colors.subText, marginTop: 8 }]}>
              Багцуудыг ачаалж байна…
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {packs.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => createInvoice(p)}
                disabled={creating}
                style={({ pressed }) => [
                  styles.packCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: p.coins === 120 ? colors.accent : colors.border,
                    opacity: creating ? 0.6 : 1,
                  },
                  pressed && styles.pressedDown,
                ]}
              >
                <View style={styles.packIcon}>
                  <Text style={styles.packIconText}>🪙</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.packTitleRow}>
                    <Text style={[styles.packAmount, { color: colors.text }]}>{p.coins} зоос</Text>
                    {!!p.bonus && (
                      <View style={styles.bonusBadge}>
                        <Text style={styles.bonusText}>{p.bonus}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.packRooms, { color: colors.muted }]}>
                    {p.rooms} өрөө үүсгэх боломжтой
                  </Text>
                </View>
                <Text style={[styles.packPrice, { color: colors.text }]}>
                  {p.price.toLocaleString("en-US")}₮
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.note, { backgroundColor: colors.sunken }]}>
          <Text style={[styles.noteText, { color: colors.subText }]}>
            Багц сонгоод банкны аппаа сонгоно уу. Төлбөр хийгдмэгц зоос шууд нэмэгдэнэ.
          </Text>
        </View>
      </ScrollView>

      {/* ТӨЛБӨРИЙН SHEET */}
      {!!payment && (
        <Modal visible transparent animationType="slide" onRequestClose={closeSheet}>
          <View style={styles.overlay}>
            <Pressable style={{ flex: 1 }} onPress={closeSheet} />
            <View style={[styles.sheet, { backgroundColor: colors.card }]}>
              <View style={[styles.grabber, { backgroundColor: colors.border }]} />

              {!paid ? (
                <>
                  <View style={styles.qpayHeader}>
                    <View style={styles.qpayLogo}>
                      <Text style={styles.qpayLogoText}>Q</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.qpayTitle, { color: colors.text }]}>
                        {payment.price_mnt.toLocaleString("en-US")}₮ төлөх
                      </Text>
                      <Text style={[styles.qpaySub, { color: colors.muted }]}>
                        🪙 {payment.pack_coins} зоос · банкаа сонгоно уу
                      </Text>
                    </View>
                    <Pressable
                      onPress={closeSheet}
                      style={[styles.closeBtn, { backgroundColor: colors.sunken }]}
                    >
                      <Text style={[styles.closeText, { color: colors.subText }]}>✕</Text>
                    </Pressable>
                  </View>

                  {!!error && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {/* БАНКНЫ АППУУД */}
                  <ScrollView style={styles.bankScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.bankGrid}>
                      {payment.bank_urls.map((b) => (
                        <Pressable
                          key={b.scheme}
                          onPress={() => openBank(b)}
                          style={({ pressed }) => [
                            styles.bankBtn,
                            { backgroundColor: colors.sunken, borderColor: colors.border },
                            pressed && styles.pressedDown,
                          ]}
                        >
                          <Text style={[styles.bankName, { color: colors.text }]} numberOfLines={2}>
                            {b.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>

                  {Platform.OS === "web" && (
                    <Text style={[styles.webHint, { color: colors.muted }]}>
                      Банкны апп зөвхөн утсан дээр нээгдэнэ.
                    </Text>
                  )}

                  <PushButton
                    label={paying ? "Шалгаж байна…" : "Төлбөр хийсэн (demo)"}
                    color={paying ? colors.sunken : PALETTE.green}
                    shadowColor={paying ? "transparent" : PALETTE.greenDark}
                    textColor={paying ? colors.muted : "#fff"}
                    disabled={paying}
                    onPress={demoPay}
                    style={{ width: "100%" }}
                    textStyle={{ fontSize: 16 }}
                  />
                </>
              ) : (
                <View style={styles.successBody}>
                  <View style={styles.successIcon}>
                    <Text style={styles.successCheck}>✓</Text>
                  </View>
                  <Text style={[styles.successTitle, { color: colors.text }]}>Төлбөр амжилттай</Text>
                  <Text style={styles.successCoins}>🪙 +{payment.pack_coins} зоос нэмэгдлээ</Text>
                  <PushButton
                    label="Болсон"
                    color={colors.accent}
                    shadowColor={colors.accentDark}
                    onPress={closeSheet}
                    style={{ width: "100%", marginTop: 6 }}
                    textStyle={{ fontSize: 16 }}
                  />
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 44, gap: 14 },

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
  title: { fontSize: 19, fontWeight: "800" },
  sub: { fontSize: 12, fontWeight: "600", marginTop: 1 },

  packCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 15,
    borderRadius: 20,
    borderWidth: 2,
  },

  packIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.goldSoft,
  },

  packIconText: { fontSize: 18 },
  packTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  packAmount: { fontSize: 17, fontWeight: "800" },

  bonusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: PALETTE.greenSoft,
  },

  bonusText: { fontSize: 10, fontWeight: "800", color: PALETTE.greenText },
  packRooms: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  packPrice: { fontSize: 16, fontFamily: MONO },

  note: { padding: 14, borderRadius: 18, alignItems: "center" },
  noteText: { fontSize: 12, fontWeight: "600", lineHeight: 19, textAlign: "center" },

  errorBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PALETTE.redSoft,
  },

  errorText: { fontSize: 12, fontWeight: "700", color: PALETTE.redText },

  overlay: { flex: 1, backgroundColor: "rgba(10,12,16,0.5)" },

  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
    maxHeight: "82%",
  },

  grabber: { width: 44, height: 5, borderRadius: 999, alignSelf: "center" },

  qpayHeader: { flexDirection: "row", alignItems: "center", gap: 10 },

  qpayLogo: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#2B2D31",
    alignItems: "center",
    justifyContent: "center",
  },

  qpayLogoText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  qpayTitle: { fontSize: 17, fontWeight: "800" },
  qpaySub: { fontSize: 11, fontWeight: "600", marginTop: 1 },

  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: { fontSize: 14, fontWeight: "800" },

  bankScroll: { maxHeight: 260 },

  bankGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  bankBtn: {
    width: "48%",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },

  bankName: { fontSize: 12, fontWeight: "800", textAlign: "center" },

  webHint: { fontSize: 11, fontWeight: "600", textAlign: "center" },

  successBody: { alignItems: "center", gap: 10, paddingTop: 6 },

  successIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: PALETTE.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  successCheck: { fontSize: 28, fontWeight: "900", color: PALETTE.greenText },
  successTitle: { fontSize: 20, fontWeight: "900" },
  successCoins: { fontSize: 14, fontWeight: "700", color: PALETTE.gold },
});
