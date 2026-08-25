import React from "react";
import {
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

type PushButtonProps = {
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
  color: string;
  shadowColor: string;
  textColor?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  faceStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
};

// Дизайны "0 4px 0" сүүдэртэй, дарахад доош суудаг товч
export default function PushButton({
  label,
  onPress,
  disabled,
  color,
  shadowColor,
  textColor = "#fff",
  radius = 16,
  style,
  faceStyle,
  textStyle,
  children,
}: PushButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      {({ pressed }) => {
        const flat = pressed || disabled;
        return (
          <View
            style={{
              borderRadius: radius,
              backgroundColor: flat ? "transparent" : shadowColor,
              paddingBottom: 4,
            }}
          >
            <View
              style={[
                {
                  borderRadius: radius,
                  backgroundColor: color,
                  paddingVertical: 15,
                  paddingHorizontal: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ translateY: pressed && !disabled ? 4 : 0 }],
                },
                faceStyle,
              ]}
            >
              {children ?? (
                <Text
                  style={[
                    { fontSize: 15, fontWeight: "800", color: textColor },
                    textStyle,
                  ]}
                >
                  {label}
                </Text>
              )}
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}
