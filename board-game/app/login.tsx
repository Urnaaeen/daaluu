import { useRouter } from "expo-router";
import { useState } from "react";
import AuthScreen from "../components/AuthScreen";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
    else router.replace("/");
  };

  return (
    <AuthScreen
      subtitle="Тоглохын тулд нэвтэрнэ үү"
      fields={[
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
          placeholder: "••••••",
          secure: true,
        },
      ]}
      error={error}
      busy={busy}
      submitLabel="Нэвтрэх"
      onSubmit={submit}
      footerText="Бүртгэлгүй юу?"
      footerAction="Бүртгүүлэх"
      onFooterPress={() => router.push("/register")}
    />
  );
}
