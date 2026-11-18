import { Image as ExpoImage } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { TILE_TYPES } from "../app/types";
import { useTheme } from "../context/ThemeContext";
import { JANLII_OPTIONS } from "../lib/janlii";
import { MONO, PALETTE } from "../theme/colors";

const imageOf = new Map(TILE_TYPES.map((t) => [t.typeId as string, t.image]));

type Props = {
  /** Сонгох эрхтэй бол сонголтын цонх, үгүй бол хүлээх мэдэгдэл */
  canChoose: boolean;
  chooserName: string;
  /** Сонгох хугацааны төгсгөл (ms). Тоолуур үүгээр явна */
  deadline: number | null;
  onPick?: (typeId: string) => void;
  /** Сонгосны дараа серверийн хариу хүлээж байна */
  busy?: boolean;
};

/**
 * Майхны эхэнд жанлий сонгох цонх. Өнгө нь апп-ын сэдвийг (харанхуй / гэрэлтэй) дагана.
 * RN Web дээр <Modal> хөлдөөдөг тул энгийн overlay View.
 */
export default function JanliiPicker({ canChoose, chooserName, deadline, onPick, busy }: Props) {
  const { colors, theme } = useTheme();
  const isDark = theme === "dark";

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedRef = useRef(false);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [deadline]);

  const pick = (typeId: string) => {
    if (!canChoose || pickedRef.current || busy) return;
    pickedRef.current = true;
    setPicked(typeId);
    onPick?.(typeId);
  };

  return (
    <View style={[styles.overlay, { backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(20,14,8,0.45)" }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            shadowOpacity: isDark ? 0.5 : 0.18,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>
            {canChoose ? "Жанлий сонгоно уу" : `${chooserName} жанлий сонгож байна…`}
          </Text>
          {secondsLeft !== null && (
            <Text
              style={[
                styles.timer,
                { color: secondsLeft <= 5 ? PALETTE.red : colors.accent },
              ]}
            >
              {secondsLeft}с
            </Text>
          )}
        </View>

        {canChoose ? (
          <View style={styles.grid}>
            {JANLII_OPTIONS.map((o) => {
              const isPicked = picked === o.typeId;
              const dim = picked !== null && !isPicked;
              return (
                <Pressable
                  key={o.typeId}
                  onPress={() => pick(o.typeId)}
                  disabled={!!picked || busy}
                  accessibilityLabel={`Жанлий: ${o.short}`}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      opacity: dim ? 0.35 : pressed ? 0.7 : 1,
                      transform: [{ scale: isPicked ? 1.1 : pressed ? 0.95 : 1 }],
                    },
                  ]}
                >
                  <ExpoImage
                    source={imageOf.get(o.typeId)}
                    style={styles.tile}
                    contentFit="contain"
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: isPicked ? colors.text : colors.subText },
                      isPicked && { fontWeight: "900" },
                    ]}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.waitBox}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.waitText, { color: colors.subText }]}>
              Жанлий сонгогдсоны дараа мод тараагдана.{"\n"}
              Сонгогдсон мод энэ майханд бүх модыг дийлнэ.
            </Text>
          </View>
        )}

        {canChoose && (
          <Text style={[styles.hint, { color: colors.muted }]}>
            {picked
              ? "Мод тарааж байна…"
              : "Сонгосон мод энэ майханд бүх модыг дийлж, аль ч өнгөн дээр тавигдана."}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    zIndex: 80,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 14,
    gap: 16,
    shadowColor: "#000",
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  title: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  timer: { fontSize: 18, fontWeight: "900", fontFamily: MONO },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    rowGap: 16,
  },
  option: { width: "33.33%", alignItems: "center", gap: 6 },
  tile: { width: 44, height: 76 },
  label: { fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 16 },
  waitBox: { alignItems: "center", gap: 12, paddingVertical: 10 },
  waitText: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  hint: { fontSize: 11, textAlign: "center", lineHeight: 15 },
});
