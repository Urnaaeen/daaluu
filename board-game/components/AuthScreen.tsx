import { Image as ExpoImage } from "expo-image";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { PALETTE } from "../theme/colors";
import BlurredBackdrop from "./BlurredBackdrop";
import PushButton from "./ui/PushButton";

const TILE_LEFT = require("../assets/objects/11.png");
const TILE_RIGHT = require("../assets/objects/12.png");

export type Field = {
  key: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboard?: "email-address" | "default";
};

type AuthScreenProps = {
  subtitle: string;
  fields: Field[];
  error: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  footerText: string;
  footerAction: string;
  onFooterPress: () => void;
  offlineNote?: boolean;
  children?: React.ReactNode;
};

// Нэвтрэх / бүртгүүлэх дэлгэцийн нийтлэг хэлбэр (дизайны лого + карт + push товч)
export default function AuthScreen({
  subtitle,
  fields,
  error,
  busy,
  submitLabel,
  onSubmit,
  footerText,
  footerAction,
  onFooterPress,
  offlineNote,
  children,
}: AuthScreenProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BlurredBackdrop />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* ЛОГО */}
        <View style={styles.logoBox}>
          <View style={styles.logoTiles}>
            <ExpoImage
              source={TILE_LEFT}
              style={[styles.logoTile, styles.logoTileLeft]}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={200}
            />
            <ExpoImage
              source={TILE_RIGHT}
              style={[styles.logoTile, styles.logoTileRight]}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={200}
            />
          </View>
          <Text style={styles.title}>Цай хураах</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {/* ФОРМ */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {fields.map(f => (
            <View key={f.key}>
              <Text style={[styles.label, { color: colors.muted }]}>{f.label}</Text>
              <TextInput
                value={f.value}
                onChangeText={f.onChange}
                placeholder={f.placeholder}
                placeholderTextColor={colors.muted}
                secureTextEntry={f.secure}
                keyboardType={f.keyboard ?? "default"}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.sunken,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
              />
            </View>
          ))}

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <PushButton
            label={busy ? "Түр хүлээнэ үү…" : submitLabel}
            color={busy ? colors.sunken : colors.accent}
            shadowColor={busy ? "transparent" : colors.accentDark}
            textColor={busy ? colors.muted : "#fff"}
            disabled={busy}
            onPress={onSubmit}
            textStyle={{ fontSize: 16 }}
          />

          {children}
        </View>

        {/* ХӨЛ */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{footerText}</Text>
          <Pressable onPress={onFooterPress} disabled={busy}>
            <Text style={[styles.footerAction, { color: colors.accent }]}>{footerAction}</Text>
          </Pressable>
        </View>

        {offlineNote && (
          <View style={styles.note}>
            <Text style={styles.noteText}>
              Сервер холбогдоогүй тул бүртгэл зөвхөн энэ төхөөрөмжид хадгалагдана.
            </Text>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 34,
    gap: 18,
  },

  logoBox: { alignItems: "center", gap: 10 },

  logoTiles: { width: 120, height: 104 },

  logoTile: { position: "absolute", width: 62, height: 96 },
  logoTileLeft: { left: 4, top: 8, transform: [{ rotate: "-12deg" }] },
  logoTileRight: { right: 4, top: 2, transform: [{ rotate: "10deg" }] },

  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  subtitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: -6,
    color: "rgba(255,255,255,0.85)",
  },

  card: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 18,
    gap: 12,
  },

  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.9,
    marginBottom: 7,
  },

  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    fontSize: 15,
    fontWeight: "700",
  },

  errorBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PALETTE.redSoft,
  },

  errorText: { fontSize: 12, fontWeight: "700", color: PALETTE.redText },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },

  footerText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
  footerAction: { fontSize: 13, fontWeight: "800" },

  note: { padding: 13, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.35)" },
  noteText: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "center",
    color: "rgba(255,255,255,0.85)",
  },
});
