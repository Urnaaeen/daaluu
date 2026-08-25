import { useRouter } from "expo-router";
import { useState } from "react";
import AuthScreen from "../components/AuthScreen";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    const err = await signUp(name, email, password);
    setBusy(false);
    if (err) setError(err);
    else router.replace("/");
  };

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
      submitLabel="Бүртгүүлэх"
      onSubmit={submit}
      footerText="Бүртгэлтэй юу?"
      footerAction="Нэвтрэх"
      onFooterPress={() => router.replace("/login")}
    />
  );
}
