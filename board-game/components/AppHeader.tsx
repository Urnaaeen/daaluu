import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { Image as ExpoImage } from 'expo-image';

// Тоглоомын ширээн дээр header нуугдана (дэлгэц бүтэн ногоон ширээ болно)
const HIDDEN_ROUTES = ["/playScreen", "/multiplayerGame", "/long"];

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme, colors } = useTheme();

  if (HIDDEN_ROUTES.includes(pathname)) return null;

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.background },
      ]}
    >
      {/* LEFT – LOGO */}
      <Pressable onPress={() => router.push("/")}>
        <ExpoImage
          source={
            theme === "dark"
              ? require("../assets/zurag/dark.png")
              : require("../assets/zurag/light.png")
          }
          style={styles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
        />
      </Pressable>

      {/* RIGHT – THEME TOGGLE */}
      <Pressable
        onPress={toggleTheme}
        style={({ pressed }) => [
          styles.themeBtn,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && { transform: [{ translateY: 2 }] },
        ]}
      >
        <Text style={styles.themeIcon}>{theme === "dark" ? "🌙" : "☀️"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  logo: {
    width: 110,
    height: 28,
  },

  themeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  themeIcon: {
    fontSize: 15,
  },
});
