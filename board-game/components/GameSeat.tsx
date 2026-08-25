import { Image as ExpoImage } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MONO, PALETTE } from "../theme/colors";

/** Суудалд зөвхөн зураг харуулах тул id + image л хангалттай */
type SeatTile = { id: string; image: any };

export type SeatProps = {
  name: string;
  color: string;
  isTurn?: boolean;
  timeLeft?: number | null;
  ger: number;
  tiles?: SeatTile[] | null; // энэ гарт гаргасан мод
  isBiggest?: boolean; // одоогийн хамгийн том мод энэ тоглогчийнх үү
  bubble?: string | null; // ярианы бөмбөлөг
  onLongPress?: () => void;
};

// Тоглоомын ширээний нэг суудал: аватар + нэр + гэр + гаргасан модны үүр
export default function GameSeat({
  name,
  color,
  isTurn,
  timeLeft,
  ger,
  tiles,
  isBiggest,
  bubble,
  onLongPress,
}: SeatProps) {
  const low = isTurn && timeLeft != null && timeLeft <= 5;
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const played = tiles && tiles.length > 0 ? tiles.slice(0, 2) : null;

  return (
    <View style={styles.seat}>
      <View style={styles.avatarWrap}>
        {!!bubble && (
          <View style={styles.bubble}>
            <Text style={styles.bubbleText} numberOfLines={1}>
              {bubble}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.ring,
            {
              backgroundColor: isTurn
                ? low
                  ? PALETTE.red
                  : PALETTE.yellow
                : "rgba(255,255,255,0.10)",
            },
          ]}
        >
          <Pressable onLongPress={onLongPress} delayLongPress={380}>
            <View style={[styles.avatar, { backgroundColor: color }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </Pressable>
        </View>
        {isTurn && timeLeft != null && (
          <View
            style={[
              styles.timerPill,
              { backgroundColor: low ? PALETTE.red : PALETTE.yellow },
            ]}
          >
            <Text
              style={[
                styles.timerText,
                { color: low ? "#fff" : PALETTE.yellowText },
              ]}
            >
              {timeLeft}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.ger}>🏠 {ger} гэр</Text>

      <View style={styles.tileSlot}>
        {played ? (
          played.map((t, i) => (
            <ExpoImage
              key={`${t.id}_${i}`}
              source={t.image}
              contentFit="contain"
              cachePolicy="memory-disk"
              style={[
                styles.tileImg,
                i === 1 && styles.tileImgSecond,
                isBiggest && styles.tileWin,
              ]}
            />
          ))
        ) : (
          <View style={styles.tileEmpty} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  seat: {
    alignItems: "center",
    gap: 4,
    width: 86,
    overflow: "visible", // ярианы бөмбөлөг гадагш гарна
  },

  avatarWrap: {
    position: "relative",
    alignItems: "center",
    overflow: "visible",
  },

  ring: {
    width: 50,
    height: 50,
    borderRadius: 16,
    padding: 5,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
  },

  timerPill: {
    position: "absolute",
    bottom: -8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    zIndex: 2,
  },

  timerText: {
    fontSize: 10,
    fontFamily: MONO,
  },

  bubble: {
    position: "absolute",
    bottom: 52,
    maxWidth: 130,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "#fff",
    zIndex: 3,
  },

  bubbleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2B2D31",
  },

  name: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
    maxWidth: 84,
    marginTop: 4,
  },

  ger: {
    fontSize: 10,
    fontFamily: MONO,
    color: PALETTE.yellow,
  },

  tileSlot: {
    flexDirection: "row",
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },

  tileEmpty: {
    width: 46,
    height: 70,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.38)",
  },

  tileImg: {
    width: 46,
    height: 70,
    borderRadius: 8,
  },

  tileImgSecond: {
    marginLeft: -30,
  },

  tileWin: {
    borderWidth: 3,
    borderColor: PALETTE.yellow,
    borderRadius: 10,
  },
});
