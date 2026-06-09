import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native";
import AppHeader from "../components/AppHeader";
import { ThemeProvider } from "../context/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <AppHeader />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaView>
    </ThemeProvider>
  );
}