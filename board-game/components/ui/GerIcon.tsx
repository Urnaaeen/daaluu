import { Image as ExpoImage } from "expo-image";
import React from "react";
import { ImageStyle, StyleProp } from "react-native";

const GER = require("../../assets/zurag/ger-icon.png");

/**
 * Гэрийн икон — 🏠 эможийг орлоно.
 * Эх зураг (ger.png, 1254px) хэт том тул 128px-т буулгасан
 * ger-icon.png-ыг ашиглана.
 */
export default function GerIcon({
  size = 14,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <ExpoImage
      source={GER}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      cachePolicy="memory-disk"
    />
  );
}
