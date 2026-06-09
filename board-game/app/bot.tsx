import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function BotScreen() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🤖 Боттой тоглох</Text>

      <View style={styles.card}>
        <Text style={styles.infoText}>{running ? "Бот ажиллаж байна" : "Бот зогссон"}</Text>
        <Pressable
          style={[styles.smallButton, running && styles.smallButtonActive]}
          onPress={() => setRunning((r) => !r)}
        >
          <Text style={styles.smallButtonText}>{running ? "Зогсоох" : "Эхлүүлэх"}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.back} onPress={() => router.back()}> 
        <Text style={styles.backText}>Буцах</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { fontSize: 22, marginBottom: 24 },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f6f6f6",
    borderRadius: 12,
    marginBottom: 24,
  },
  infoText: { fontSize: 16, marginBottom: 12 },
  smallButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#e6e6e6",
    borderRadius: 10,
  },
  smallButtonActive: { backgroundColor: "#d8e3ff" },
  smallButtonText: { fontSize: 16 },
  back: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "#eee",
    borderRadius: 12,
  },
  backText: { fontSize: 16 },
});
