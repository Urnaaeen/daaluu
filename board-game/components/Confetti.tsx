import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

const PIECES = [
  { color: "#2B8FF0", left: "5%", duration: 2400, delay: 0 },
  { color: "#FF9600", left: "17%", duration: 3100, delay: 350 },
  { color: "#46C93A", left: "29%", duration: 3800, delay: 700 },
  { color: "#FFC83D", left: "41%", duration: 2400, delay: 1050 },
  { color: "#FF4B4B", left: "53%", duration: 3100, delay: 1400 },
  { color: "#9B6BFF", left: "65%", duration: 3800, delay: 1750 },
  { color: "#2B8FF0", left: "77%", duration: 2400, delay: 2100 },
  { color: "#FFC83D", left: "89%", duration: 3100, delay: 2450 },
];

// Дүнгийн дэлгэц дээр унаж эргэлдэх цаасан хэлтэрхийнүүд
export default function Confetti() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PIECES.map((p, i) => (
        <Piece key={i} {...p} />
      ))}
    </View>
  );
}

function Piece({
  color,
  left,
  duration,
  delay,
}: {
  color: string;
  left: string;
  duration: number;
  delay: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, duration, delay]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-18, 920] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "420deg"] });

  return (
    <Animated.View
      style={[
        styles.piece,
        { backgroundColor: color, left: left as any, transform: [{ translateY }, { rotate }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {
    position: "absolute",
    top: 0,
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});
