import { View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function Screen({ children }: any) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {children}
    </View>
  );
}
