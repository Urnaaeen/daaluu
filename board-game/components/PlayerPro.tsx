import React, { useMemo, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Defs, Path, Text as SvgText, TextPath, Circle } from "react-native-svg";

type Opponent = {
  id: string;
  name: string;
};

const BADGE = 74;
const ARC_RADIUS = 165;
const ARC_Y = 95;

export default function PlayerProArc() {
  const [w, setW] = useState(0);

  // ✅ Одоохондоо 4 opponent-оо эндээ шууд тавьчих
  const opponents: Opponent[] = useMemo(
    () => [
      { id: "p1", name: "ХАНДДОРЖ" },
      { id: "p2", name: "ШИЖИРТҮҮД" },
      { id: "p3", name: "ЭНХЛЭН" },
      { id: "p4", name: "УЛАМБАЯРДАН" },
    ],
    []
  );

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const cx = w / 2;
  const cy = ARC_Y;

  // (-150°..-30°) нумын дагуу тараах
  const angles = useMemo(() => {
    const start = -150;
    const end = -30;
    const step = opponents.length === 1 ? 0 : (end - start) / (opponents.length - 1);
    return opponents.map((_, i) => (start + step * i) * (Math.PI / 180));
  }, [opponents]);

  return (
    <View style={styles.arcWrap} onLayout={onLayout}>
      {w > 0 &&
        opponents.map((p, i) => {
          const a = angles[i];
          const x = cx + ARC_RADIUS * Math.cos(a) - BADGE / 2;
          const y = cy + ARC_RADIUS * Math.sin(a) - BADGE / 2;

          return (
            <View key={p.id} style={[styles.badgeAbs, { left: x, top: y }]}>
              <OpponentBadge name={p.name} />
            </View>
          );
        })}
    </View>
  );
}

function OpponentBadge({ name }: { name: string }) {
  const label = name.length > 12 ? name.slice(0, 12) + "…" : name;
  const letter = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <View style={styles.badge}>
      <Svg width={BADGE} height={BADGE} viewBox={`0 0 ${BADGE} ${BADGE}`}>
        <Defs>
          <Path
            id="arc"
            d={`M 10 ${BADGE / 2 + 6} A ${BADGE / 2 - 6} ${BADGE / 2 - 6} 0 0 1 ${
              BADGE - 10
            } ${BADGE / 2 + 6}`}
            fill="none"
          />
        </Defs>

        <Circle cx={BADGE / 2} cy={BADGE / 2} r={BADGE / 2 - 2} fill="rgba(255,255,255,0.75)" />

        <SvgText fill="#0b1a2a" fontSize="10" fontWeight="800">
          <TextPath href="#arc" startOffset="50%" textAnchor="middle" letterSpacing="0.5">
            {label}
          </TextPath>
        </SvgText>

        <SvgText x="50%" y="55%" textAnchor="middle" fontSize="22" fontWeight="900" fill="#111">
          {letter}
        </SvgText>
      </Svg>

      <View style={styles.smallStarsRow}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <View style={styles.starDot} />
          <View style={styles.starDot} />
          <View style={styles.starDot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  arcWrap: { width: "100%", height: 220, position: "relative" },
  badgeAbs: { position: "absolute", width: BADGE, height: BADGE },

  badge: { width: BADGE, height: BADGE, alignItems: "center", justifyContent: "center" },

  smallStarsRow: { position: "absolute", bottom: -14, alignItems: "center", justifyContent: "center" },

  starDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#111", opacity: 0.9 },
});
