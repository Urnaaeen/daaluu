import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, SafeAreaView, View } from "react-native";
import { AppStateProvider } from "../context/AppStateContext";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { PresenceProvider } from "../context/PresenceContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { BLUR_BG } from "../theme/colors";

// Тоглоомын ширээний дэлгэцүүд — ногоон ширээний өнгөөр дүүрнэ
const FELT_ROUTES = ["playScreen", "multiplayerGame", "long", "end", "setup"];

// nevtreh.png бүдгэрсэн дэвсгэртэй дэлгэцүүд ("" нь үндсэн цэс)
const BLUR_ROUTES = ["", "match", "login", "register"];

// Нэвтрэхгүйгээр үзэх боломжтой дэлгэцүүд
const AUTH_ROUTES = ["login", "register"];

function Shell() {
  const { colors, theme } = useTheme();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const route = segments[0] ?? "";
  const isFelt = FELT_ROUTES.includes(route);
  const isBlur = BLUR_ROUTES.includes(route);
  const onAuthRoute = AUTH_ROUTES.includes(route);
  const bg = isFelt ? colors.feltTop : isBlur ? BLUR_BG : colors.background;

  // Нэвтрээгүй бол нэвтрэх дэлгэц рүү, нэвтэрсэн бол цэс рүү
  useEffect(() => {
    if (loading) return;
    if (!user && !onAuthRoute) router.replace("/login");
    else if (user && onAuthRoute) router.replace("/");
  }, [user, loading, onAuthRoute, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isFelt || isBlur || theme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bg },
        }}
      />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PresenceProvider>
          <AppStateProvider>
            <Shell />
          </AppStateProvider>
        </PresenceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
