import { Image as ExpoImage } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

// 4px бүдгэрүүлж, дээрээс нь хөшиг татдаг тул нарийвчлал шаардлагагүй —
// 720px өргөнтэй JPEG (эх PNG нь 2.5 MB тутам байсан)
const DARK = require("../assets/zurag/menu-bg.jpg");
const LIGHT = require("../assets/zurag/nevtreh-bg.jpg");

/**
 * Аппын нэгдсэн дэвсгэр — бүх дэлгэцэд хэрэглэнэ.
 * Харанхуй горимд menu.png, гэрэлтэй горимд nevtreh.png.
 *
 * Зургийг өөрийг нь бүдгэрүүлнэ (backdrop-filter нь өөрийн хайрцгаараа
 * хязгаарлагддаг тул дэлгэцийг бүтэн хучихгүй байсан).
 */
export default function BlurredBackdrop({
  blurRadius = 4,
  /** Дээрх бараан хөшгийн хүч — цагаан бичиг уншигдахуйц болгоно */
  scrim,
  /** Нэвтрэх, бүртгүүлэх дэлгэц үргэлж гэрэлтэй хувилбарыг хэрэглэнэ */
  forceLight = false,
}: {
  blurRadius?: number;
  scrim?: number;
  forceLight?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = !forceLight && theme === "dark";
  const veil = scrim ?? (isDark ? 0.5 : 0.45);

  return (
    <>
      <ExpoImage
        source={isDark ? DARK : LIGHT}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={blurRadius}
        cachePolicy="memory-disk"
        transition={300}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(12,8,4,${veil})` }]} />
    </>
  );
}
