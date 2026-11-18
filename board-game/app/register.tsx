import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AuthScreen from "../components/AuthScreen";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

/**
 * Бүртгэл 2 алхамтай:
 *  1. нэр, и-мэйл, нууц үг → сервер и-мэйл рүү 6 оронтой код илгээнэ
 *  2. кодоо оруулж бүртгэлээ баталгаажуулна
 * Сервер дээр и-мэйл баталгаажуулалт унтраалттай бол 1-р алхамаас шууд бүртгэнэ.
 */
export default function Register() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requestSignupCode, signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const finish = async (withCode?: string) => {
    const err = await signUp(name, email, password, withCode);
    if (err) {
      setError(err);
      return false;
    }
    router.replace("/");
    return true;
  };

  const sendCode = async () => {
    setBusy(true);
    setError("");
    const res = await requestSignupCode(name, email, password);
    if (res.error !== undefined) {
      setError(res.error);
    } else if (!res.required) {
      await finish();
    } else {
      setStep("code");
      setCode(res.devCode ?? "");
      setResendIn(res.resendIn ?? 60);
    }
    setBusy(false);
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("И-мэйлээр ирсэн 6 оронтой кодоо оруулна уу.");
      return;
    }
    setBusy(true);
    setError("");
    await finish(code);
    setBusy(false);
  };

  if (step === "code") {
    return (
      <AuthScreen
        subtitle="И-мэйлээ баталгаажуулах"
        fields={[
          {
            key: "code",
            label: "БАТАЛГААЖУУЛАХ КОД",
            value: code,
            onChange: (t) => {
              setCode(t.replace(/\D/g, "").slice(0, 6));
              setError("");
            },
            placeholder: "000000",
            keyboard: "number-pad",
            maxLength: 6,
          },
        ]}
        error={error}
        busy={busy}
        submitLabel="Бүртгүүлэх"
        onSubmit={confirm}
        footerText="И-мэйл буруу юу?"
        footerAction="Буцах"
        onFooterPress={() => {
          setStep("form");
          setCode("");
          setError("");
        }}
      >
        <View style={styles.info}>
          <Text style={[styles.infoText, { color: colors.subText }]}>
            <Text style={{ fontWeight: "800", color: colors.text }}>{email.trim().toLowerCase()}</Text>
            {" "}хаяг руу 6 оронтой код илгээлээ. Spam хавтсаа ч шалгаарай.
          </Text>
          <Pressable onPress={sendCode} disabled={busy || resendIn > 0}>
            <Text
              style={[
                styles.resend,
                { color: resendIn > 0 ? colors.muted : colors.accent },
              ]}
            >
              {resendIn > 0 ? `Дахин илгээх (${resendIn}с)` : "Код дахин илгээх"}
            </Text>
          </Pressable>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      subtitle="Шинэ бүртгэл үүсгэх"
      fields={[
        {
          key: "name",
          label: "ТОГЛОГЧИЙН НЭР",
          value: name,
          onChange: setName,
          placeholder: "Тэмүүлэн",
        },
        {
          key: "email",
          label: "И-МЭЙЛ",
          value: email,
          onChange: setEmail,
          placeholder: "tamir@example.com",
          keyboard: "email-address",
        },
        {
          key: "password",
          label: "НУУЦ ҮГ",
          value: password,
          onChange: setPassword,
          placeholder: "Дор хаяж 6 тэмдэгт",
          secure: true,
        },
      ]}
      error={error}
      busy={busy}
      submitLabel="Үргэлжлүүлэх"
      onSubmit={sendCode}
      footerText="Бүртгэлтэй юу?"
      footerAction="Нэвтрэх"
      onFooterPress={() => router.replace("/login")}
    />
  );
}

const styles = StyleSheet.create({
  info: { gap: 10, alignItems: "center" },
  infoText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  resend: { fontSize: 14, fontWeight: "800", paddingVertical: 4 },
});
