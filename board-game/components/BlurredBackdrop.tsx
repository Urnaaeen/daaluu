import { Image as ExpoImage } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";

const BACKDROP = require("../assets/zurag/nevtreh.png");

/**
 * Гэр дотор даалуу тоглож буй зураг — дэлгэцийн дэвсгэр.
 * Зургийг өөрийг нь бүдгэрүүлнэ (backdrop-filter нь өөрийн хайрцгаараа
 * хязгаарлагддаг тул дэлгэцийг бүтэн хучихгүй байсан).
 */
export default function BlurredBackdrop({
  blurRadius = 4,
  /** Дээрх бараан хөшгийн хүч — цагаан бичиг уншигдахуйц болгоно */
  scrim = 0.45,
}: {
  blurRadius?: number;
  scrim?: number;
}) {
  return (
    <>
      <ExpoImage
        source={BACKDROP}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={blurRadius}
        cachePolicy="memory-disk"
        transition={300}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(12,8,4,${scrim})` }]} />
    </>
  );
}
