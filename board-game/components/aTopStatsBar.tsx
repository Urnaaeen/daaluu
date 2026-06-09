import React from "react";
import { Image, ImageBackground, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

// ✅ тогтмол asset-ууд (замыг өөрийнхөө project-т тааруулаад солиорой)
const BG = require("../assets/zurag/pointbg.png");
const CENTER_TILE = require("../assets/objects/6_2_1.png");

type TopStatsBarProps = {
  avlaga: number;
  uglug: number;
  tsai: number;
  tsaiTotal: number;
  ger: number;
};

export function TopStatsBar({
  avlaga,
  uglug,
  tsai,
  tsaiTotal,
  ger,
}: TopStatsBarProps) {
  const { colors  } = useTheme();
  return (
    <View style={styles.wrap}>
        <ImageBackground source={BG} resizeMode="contain" style={styles.size}>
          <View style={[styles.stat, { left: 10 }]}>
            <Text style={styles.label}>АВЛ.</Text>
            <Text style={[styles.value, { color: colors.text }]}>{avlaga}</Text>
          </View>

          <View style={[styles.stat, { left: 60 }]}>
            <Text style={styles.label}>ӨР</Text>
            <Text style={[styles.value, { color: colors.text }]}>{uglug}</Text>
          </View>

          <View style={[styles.stat, { right: 60 }]}>
            <Text style={styles.label}>ЦАЙ</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {tsai}/{tsaiTotal}
            </Text>
          </View>

          <View style={[styles.stat, { right: 10 }]}>
            <Text style={styles.label}>ГЭР</Text>
            <Text style={[styles.value, { color: colors.text }]}>{ger}</Text>
          </View>

          {/* ✅ center tile тогтмол */}
          <Image source={CENTER_TILE} style={styles.centerTile} resizeMode="contain" />
        </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: 1 },
  size: { width: 300, height: 100},

  stat: { position: "absolute", top: 30, alignItems: "center", width: 70 },
  label: { fontSize: 14, fontWeight: "800", color: "#E24B4B" },
  value: { marginTop: 1, fontSize: 20, fontWeight: "800", color: "#111" },

  centerTile: {
    position: "absolute",
    top: 30,
    left: "50%",
    marginLeft: -16,
    width: 32,
    height: 52,
  },
});
