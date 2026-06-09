import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { Image as ExpoImage } from 'expo-image';
import { useEffect } from 'react';

export default function AppHeader() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { colors } = useTheme();

  useEffect(() => {
    ExpoImage.prefetch([
      require("../assets/zurag/dark.png"),
      require("../assets/zurag/light.png")
    ]);
  }, []);

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.header },
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

      <Switch
        value={theme === "dark"}
        onValueChange={toggleTheme}
        trackColor={{
          false: colors.card,
          true: colors.card
        }}
        thumbColor={theme === "dark" ? "#dbe9ff" : "#FFFFFF"}
        ios_backgroundColor={colors.card}
      />
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
});