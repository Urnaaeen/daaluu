import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Platform, SafeAreaView, View } from "react-native";
import OfflineBanner from "../components/OfflineBanner";
import RoomInviteBanner from "../components/RoomInviteBanner";
import { AppStateProvider } from "../context/AppStateContext";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { PresenceProvider } from "../context/PresenceContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { BLUR_BG } from "../theme/colors";

// Нэвтрэхгүйгээр үзэх боломжтой дэлгэцүүд
const AUTH_ROUTES = ["login", "register"];

function Shell() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const route = segments[0] ?? "";
  const onAuthRoute = AUTH_ROUTES.includes(route);

  // Бүх дэлгэц ижил бүдгэрсэн дэвсгэртэй тул зах нь ч ижил бараан өнгөтэй
  const bg = BLUR_BG;

  // Вэб дээрх хөтчийн табын нэр. expo-router-ийн helmet хоосон <title>
  // үүсгэдэг бөгөөд дэлгэц бүр өөрийн гарчиг заадаггүй тул энд тогтооно.
  useEffect(() => {
    if (Platform.OS === "web") document.title = "Цай хураах";
  }, []);

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
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bg },
          // Вэб дээрх хөтчийн табын нэр — expo-router үүнийг <title>-д тавина
          title: "Цай хураах",
        }}
      />
      {user && <RoomInviteBanner />}
      <OfflineBanner />
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
