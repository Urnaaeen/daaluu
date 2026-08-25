import React from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";

type AvatarProps = {
  label: string;
  color: string;
  size?: number;
  radius?: number;
  fontSize?: number;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
};

// Дугуйруулсан дөрвөлжин, үсэгтэй аватар
export default function Avatar({
  label,
  color,
  size = 40,
  radius = 13,
  fontSize = 15,
  textColor = "#fff",
  style,
}: AvatarProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text style={{ fontSize, fontWeight: "900", color: textColor }}>{label}</Text>
    </View>
  );
}
