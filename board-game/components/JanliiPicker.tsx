import { Image as ExpoImage } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { TILE_TYPES } from "../app/types";
import { JANLII_OPTIONS } from "../lib/janlii";
import { MONO, PALETTE } from "../theme/colors";

const imageOf = new Map(TILE_TYPES.map((t) => [t.typeId as string, t.image]));

const ORANGE = "#F5A524";

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
 * Майхны эхэнд жанлий сонгох цонх.
 * RN Web дээр <Modal> хөлдөөдөг тул энгийн overlay View.
 */
export default function JanliiPicker({ canChoose, chooserName, deadline, onPick, busy }: Props) {
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
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {canChoose ? "Жанлий сонгоно уу" : `${chooserName} жанлий сонгож байна…`}
          </Text>
          {secondsLeft !== null && (
            <Text style={[styles.timer, secondsLeft <= 5 && { color: PALETTE.red }]}>
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
                    { opacity: dim ? 0.35 : pressed ? 0.75 : 1 },
                  ]}
                >
                  <View style={[styles.tileFrame, isPicked && styles.tileFramePicked]}>
                    <ExpoImage
                      source={imageOf.get(o.typeId)}
                      style={styles.tile}
                      contentFit="contain"
                    />
                  </View>
                  <Text style={styles.label}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.waitBox}>
            <ActivityIndicator color={ORANGE} />
            <Text style={styles.waitText}>
              Жанлий сонгогдсоны дараа мод тараагдана.{"\n"}
              Сонгогдсон мод энэ майханд бүх модыг дийлнэ.
            </Text>
          </View>
        )}

        {canChoose && (
          <Text style={styles.hint}>
            {picked ? "Мод тарааж байна…" : "Сонгосон мод энэ майханд бүх модыг дийлж, аль ч өнгөн дээр тавигдана."}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    zIndex: 80,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#141826",
    borderColor: ORANGE,
    borderWidth: 2.5,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 14,
    gap: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  title: { color: "#7FA8FF", fontSize: 17, fontWeight: "800", textAlign: "center" },
  timer: { color: ORANGE, fontSize: 18, fontWeight: "900", fontFamily: MONO },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    rowGap: 16,
  },
  option: { width: "33.33%", alignItems: "center", gap: 6 },
  tileFrame: {
    borderColor: ORANGE,
    borderWidth: 2,
    borderRadius: 10,
    padding: 2,
    backgroundColor: "#0B0E17",
  },
  tileFramePicked: {
    borderColor: PALETTE.green,
    borderWidth: 3,
    transform: [{ scale: 1.08 }],
  },
  tile: { width: 40, height: 70 },
  label: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
  waitBox: { alignItems: "center", gap: 12, paddingVertical: 10 },
  waitText: { color: "rgba(255,255,255,0.7)", fontSize: 13, textAlign: "center", lineHeight: 19 },
  hint: { color: "rgba(255,255,255,0.5)", fontSize: 11, textAlign: "center", lineHeight: 15 },
});
