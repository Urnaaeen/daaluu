import { Image as ExpoImage } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

const DARK = require("../assets/zurag/playgame.png");
const LIGHT = require("../assets/zurag/playgamelight.png");

/**
 * Тоглох ширээний дэвсгэр — монгол хивс.
 * Ширээн дээрх бичиг бүгд цагаан тул дээр нь бараан хөшиг тавина;
 * цайвар хивс дээр хөшиг арай хүчтэй байна.
 */
export default function FeltBackdrop({ blurRadius = 4 }: { blurRadius?: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? "rgba(10,6,3,0.38)" : "rgba(20,12,6,0.46)" },
        ]}
      />
    </>
  );
}
