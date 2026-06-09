import React, { useMemo } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Path, Polygon, Text as SvgText, TextPath } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";

type Player = {
  id: string;
  name: string;
  tsai: number;
  avlaga: number;
  uglug: number;
  stars: number;
};

type PlayerProArcProps = {
  opponents: Player[];
  showOpponentScores?: boolean;
  currentPlayerIndex: number;
  timeLeft: number;
};

const BADGE = 50;
const ARC_RADIUS = 165;
const ARC_Y = 130;

export default function PlayerScore({ 
  opponents, 
  showOpponentScores = false,
  currentPlayerIndex,
  timeLeft
}: PlayerProArcProps) {
  const [w, setW] = React.useState(0);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const cx = w / 2;
  const cy = ARC_Y;

  const angles = useMemo(() => {
    const start = -130;
    const end = -50;
    const step = opponents.length === 1 ? 0 : (end - start) / (opponents.length - 1);
    return opponents.map((_, i) => (start + step * i) * (Math.PI / 180));
  }, [opponents.length]);

  return (
    <View style={styles.arcWrap} onLayout={onLayout}>
      {w > 0 &&
        opponents.map((player, i) => {
          const a = angles[i];
          const x = cx + ARC_RADIUS * Math.cos(a) - BADGE / 2;
          const y = cy + ARC_RADIUS * Math.sin(a) - BADGE / 2;
          
          const isCurrentPlayer = currentPlayerIndex === i + 1;

          return (
            <View key={player.id} style={[styles.badgeAbs, { left: x, top: y }]}>
              <OpponentBadge 
                player={player} 
                showScores={showOpponentScores}
                isCurrentPlayer={isCurrentPlayer}
                timeLeft={timeLeft}
              />
            </View>
          );
        })}
    </View>
  );
}

function OpponentBadge({ 
  player, 
  showScores,
  isCurrentPlayer,
  timeLeft
}: { 
  player: Player; 
  showScores: boolean;
  isCurrentPlayer: boolean;
  timeLeft: number;
}) {
  const label = player.name.length > 12 ? player.name.slice(0, 12) + "…" : player.name;
  const letter = (player.name.trim()[0] ?? "?").toUpperCase();

  const createStarPath = (cx: number, cy: number, outerRadius: number, innerRadius: number) => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(" ");
  };

  // Одны мөр бүрт хэдэн од харуулахыг тооцоолох
  const starsFirstRow = player.stars <= 5 ? player.stars : Math.ceil(player.stars / 2);
  const starsSecondRow = player.stars > 5 ? Math.floor(player.stars / 2) : 0;
  const { colors  } = useTheme();

  return (
    <View style={styles.badge}>
      {/* SVG - зөвхөн тойрог, үсэг, timer */}
      <Svg width={BADGE} height={BADGE} viewBox={`0 0 ${BADGE} ${BADGE}`}>
        <Defs>
          <Path
            id={`arc-${player.id}`}
            d={`M 6 ${BADGE / 2 - 3} A ${BADGE / 2 - 8} ${BADGE / 2 - 8} 0 0 1 ${BADGE - 6} ${
              BADGE / 2 - 3
            }`}
            fill="none"
          />
        </Defs>

        {/* Тойрог */}
        <Circle 
          cx={BADGE / 2} 
          cy={BADGE / 2} 
          r={BADGE / 2 - 2} 
          fill={isCurrentPlayer ? "rgba(76, 175, 80, 0.3)" : "rgba(255,255,255,0.85)"}
          stroke={isCurrentPlayer ? "#4CAF50" : "transparent"}
          strokeWidth={isCurrentPlayer ? 2 : 0}
        />

        {/* Нэр */}
        <SvgText fill={colors.text} fontSize="4" fontWeight="700">
          <TextPath href={`#arc-${player.id}`} startOffset="50%" textAnchor="middle" letterSpacing="0.3">
            {label}
          </TextPath>
        </SvgText>

        {/* Үсэг */}
        <SvgText x="50%" y="60%" textAnchor="middle" fontSize="20" fontWeight="900" fill="#111">
          {letter}
        </SvgText>

        {/* Timer */}
        {isCurrentPlayer && (
          <SvgText 
            x="50%" 
            y="40%"
            textAnchor="middle" 
            fontSize="8" 
            fontWeight="bold" 
            fill={timeLeft <= 5 ? "#ff0000" : "#4CAF50"}
          >
            {timeLeft}s
          </SvgText>
        )}

        {/* Оноо */}
        {showScores && (
          <SvgText x="50%" y="94%" textAnchor="middle" fontSize="5" fill="#111" fontWeight="600">
            С:{player.tsai} А:{player.avlaga} Ү:{player.uglug}
          </SvgText>
        )}
      </Svg>

      {/* ⬇️⬇️⬇️ ОД - SVG ГАДНА, ДООР ⬇️⬇️⬇️ */}
      {player.stars > 0 && (
        <View style={styles.starsContainer}>
          {/* 1-р мөр */}
          {starsFirstRow > 0 && (
            <View style={styles.starRow}>
              {Array.from({ length: starsFirstRow }).map((_, idx) => (
                <View key={`star1-${idx}`} style={styles.star}>
                  <Svg width={8} height={8} viewBox="0 0 8 8">
                    <Polygon
                      points={createStarPath(4, 4, 3, 1.5)}
                      fill="#FFD700"
                      stroke="#FFA500"
                      strokeWidth="0.3"
                    />
                  </Svg>
                </View>
              ))}
            </View>
          )}

          {/* 2-р мөр */}
          {starsSecondRow > 0 && (
            <View style={styles.starRow}>
              {Array.from({ length: starsSecondRow }).map((_, idx) => (
                <View key={`star2-${idx}`} style={styles.star}>
                  <Svg width={8} height={8} viewBox="0 0 8 8">
                    <Polygon
                      points={createStarPath(4, 4, 3, 1.5)}
                      fill="#FFD700"
                      stroke="#FFA500"
                      strokeWidth="0.3"
                    />
                  </Svg>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  arcWrap: { width: "100%", height: 220, position: "relative" },
  badgeAbs: { position: "absolute", width: BADGE, height: BADGE },

  badge: {
    width: BADGE,
    height: BADGE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

    starsContainer: {
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 1,
  },
  star: {
    marginHorizontal: 1,
  },
});