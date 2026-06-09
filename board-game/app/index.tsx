import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { Image as ExpoImage } from 'expo-image';

type ModalMode = "join" | "create";

export default function Menu() {
  const router = useRouter();
  const { colors } = useTheme();

  // ===== STATES =====
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("join");
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isCreated, setIsCreated] = useState(false);

  // ===== HELPERS =====
  const generateRoomCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
  };

  const closeModal = () => {
    setShowModal(false);
    setIsCreated(false);
    setRoomCode("");
    setPlayerName("");
  };

  // ===== UI =====
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* LOGO */}
      <View style={styles.logoBox}>
        <ExpoImage
          source={require("../assets/zurag/menu1.png")}
          style={styles.logoImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={200}
        />
      </View>

      {/* MENU */}
      <View style={styles.menu}>
        <Pressable
          style={[styles.button, { backgroundColor: colors.card }]}
          onPress={() => {
            setModalMode("create");
            generateRoomCode();
            setIsCreated(false);
            setShowModal(true);
          }}
        >
          <Text style={[styles.buttonText, { color: colors.title }]}>
            Тоглоом үүсгэх
          </Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: colors.card }]}
          onPress={() => {
            setModalMode("join");
            setRoomCode("");
            setShowModal(true);
          }}
        >
          <Text style={[styles.buttonText, { color: colors.title }]}>
            Холбогдож тоглох
          </Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: colors.card }]}
          onPress={() => router.push("/playScreen")}
        >
          <Text style={[styles.buttonText, { color: colors.title }]}>
            Боттой тоглох
          </Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: colors.card }]}
          onPress={() => router.push("/rules")}
        >
          <Text style={[styles.buttonText, { color: colors.title }]}>
            Тоглоомын заавар
          </Text>
        </Pressable>
      </View>

      {/* ========== MODAL ========== */}
      <Modal visible={showModal} transparent animationType="slide">
        <Pressable style={StyleSheet.absoluteFill} onPress={closeModal}>
          <BlurView
            intensity={35}
            tint={colors.background === "#FFFFFF" ? "light" : "dark"}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Pressable>

        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {modalMode === "create" ? "Тоглоом үүсгэх" : "Холбогдох"}
              </Text>
              <Pressable onPress={closeModal}>
                <Text style={[styles.close, { color: colors.text }]}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.label, { color: colors.subText }]}>
              Өрөөний код
            </Text>
            <TextInput
              style={[
                styles.codeInput,
                { color: colors.text, borderColor: colors.border },
              ]}
              placeholder="# 0000"
              placeholderTextColor={colors.subText}
              keyboardType="number-pad"
              maxLength={4}
              editable={modalMode === "join"}
              value={roomCode}
              onChangeText={setRoomCode}
            />

            <Text style={[styles.label, { color: colors.subText }]}>
              Тоглогчийн нэр
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.card, color: colors.text },
              ]}
              placeholder="Нэрээ оруулна уу"
              placeholderTextColor={colors.subText}
              value={playerName}
              onChangeText={setPlayerName}
            />

            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.text },
              ]}
              onPress={() => {
                if (modalMode === "create") {
                  if (!isCreated) {
                    setIsCreated(true);
                  } else {
                    setShowModal(false);
                    router.push({
                      pathname: "/multiplayer",
                      params: {
                        roomCode,
                        host: "true",
                        playerName,
                      },
                    });
                  }
                } else {
                  setShowModal(false);
                  router.push({
                    pathname: "/multiplayer",
                    params: {
                      roomCode,
                      host: "false",
                      playerName,
                    },
                  });
                }
              }}
            >
              <Text
                style={[
                  styles.actionText,
                  { color: colors.background },
                ]}
              >
                {modalMode === "create"
                  ? isCreated
                    ? "Эхлэх"
                    : "Үүсгэх"
                  : "Холбогдох"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ========== STYLES (UNCHANGED STRUCTURE) ========== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  logoBox: {
    width: 200,
    height: 200,
    marginBottom: 40,
  },

  logoImage: {
    width: "100%",
    height: "100%",
  },

  menu: {
    width: "80%",
  },

  button: {
    paddingVertical: 14,
    borderRadius: 20,
    marginBottom: 14,
    alignItems: "center",
  },

  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  modalWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },

  card: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
  },

  close: {
    fontSize: 22,
    fontWeight: "600",
  },

  label: {
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
  },

  codeInput: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 4,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },

  input: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },

  actionBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },

  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
});


// npx expo start --tunnel