import { Image as ExpoImage } from "expo-image";
import { useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

// 4px бүдгэрүүлж, дээрээс нь хөшиг татдаг тул нарийвчлал шаардлагагүй —
// 720px өргөнтэй JPEG (эх PNG нь 2.5 MB тутам байсан)
const DARK = require("../assets/zurag/menu-bg.jpg");
const LIGHT = require("../assets/zurag/nevtreh-bg.jpg");

// Вэб: html-ийн дэвсгэр (public/bg/*-blur.jpg — урьдчилан бүдгэрүүлсэн).
// Апп-ын харагдах хэсгээс гадуурх зурваст (iOS PWA-ийн home indicator,
// Android-ийн навигацийн самбар) энэ л харагдана.
const PAGE_BG = {
  dark: { url: "/bg/menu-blur.jpg", color: "#3a1d0e" },
  light: { url: "/bg/nevtreh-blur.jpg", color: "#3b1709" },
};

const setPageBackdrop = (isDark: boolean, veil: number) => {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const bg = isDark ? PAGE_BG.dark : PAGE_BG.light;
  const st = document.documentElement.style;
  st.backgroundColor = bg.color;
  st.backgroundImage = `linear-gradient(rgba(12,8,4,${veil}), rgba(12,8,4,${veil})), url(${bg.url})`;
};

/**
 * Аппын нэгдсэн дэвсгэр — бүх дэлгэцэд хэрэглэнэ.
 * Харанхуй горимд menu.png, гэрэлтэй горимд nevtreh.png.
 *
 * Дэлгэцийн агуулга safe area дотор (root layout-ын padding) байдаг ч дэвсгэр
 * нь notch, status bar, home indicator-ийн ард хүртэл бүтэн хучих ёстой —
 * тиймээс safe area-ийн хэмжээгээр гадагшаа сунгана (edge-to-edge).
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
  const insets = useSafeAreaInsets();
  const isDark = !forceLight && theme === "dark";
  const veil = scrim ?? (isDark ? 0.5 : 0.45);

  // Идэвхтэй дэлгэцийн дэвсгэрийг html дээр давхар тавина
  useFocusEffect(
    useCallback(() => {
      setPageBackdrop(isDark, veil);
    }, [isDark, veil])
  );

  // blur нь зургийн ирмэгийг бараан болгодог тул тэр хэсгийг дэлгэцээс гадна гаргана
  const edge = blurRadius * 4;
  const bleed = {
    position: "absolute" as const,
    top: -insets.top - edge,
    bottom: -insets.bottom - edge,
    left: -insets.left - edge,
    right: -insets.right - edge,
  };

  return (
    <View style={bleed} pointerEvents="none">
      <ExpoImage
        source={isDark ? DARK : LIGHT}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={blurRadius}
        cachePolicy="memory-disk"
        transition={300}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(12,8,4,${veil})` }]} />
    </View>
  );
}
