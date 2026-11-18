/**
 * И-мэйлийн кодоор бүртгүүлэх урсгалын шалгалт.
 * Тусдаа порт дээр EMAIL_VERIFICATION=true, MAIL_DEV_ECHO=true сервер асаана
 * (код консолд хэвлэгдэж, тестэд хариугаар ирнэ — жинхэнэ и-мэйл илгээхгүй).
 *
 *   npm run smoke:email
 */
import { spawn } from "node:child_process";

const PORT = 4103;
const BASE = `http://localhost:${PORT}/api`;

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} ${detail}`);
  }
};

const call = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const startServer = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["src/index.js"], {
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: String(PORT),
        EMAIL_VERIFICATION: "true",
        MAIL_DEV_ECHO: "true",
        BREVO_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (d) => {
      log += d;
      if (log.includes("Postgres бэлэн")) resolve(child);
    });
    child.stderr.on("data", (d) => (log += d));
    child.on("exit", (code) => reject(new Error(`сервер унтарлаа (${code}):\n${log}`)));
    setTimeout(() => reject(new Error(`сервер асаагүй:\n${log}`)), 15000);
  });

const server = await startServer();
const tag = Date.now().toString(36);
const user = { name: "Шалгагч", email: `mail_${tag}@test.mn`, password: "nuuts123" };

try {
  console.log("Код шаардлага");
  let r = await call("POST", "/auth/register", user);
  check("кодгүй бүртгэл татгалзав", r.status === 400 && r.json.error === "bad_code", JSON.stringify(r));

  r = await call("POST", "/auth/register/code", { ...user, email: "буруу" });
  check("буруу и-мэйлд код илгээхгүй", r.status === 400 && r.json.error === "bad_email");

  r = await call("POST", "/auth/register/code", { ...user, password: "123" });
  check("сул нууц үгэнд код илгээхгүй", r.status === 400 && r.json.error === "weak_password");

  console.log("Код илгээх");
  r = await call("POST", "/auth/register/code", user);
  check("код илгээгдэв", r.status === 200 && r.json.required === true && r.json.sent === true);
  check("6 оронтой код", /^\d{6}$/.test(r.json.devCode ?? ""));
  const code = r.json.devCode;

  r = await call("POST", "/auth/register/code", user);
  check("60 секундэд дахин илгээхгүй", r.status === 429, JSON.stringify(r));

  console.log("Код шалгах");
  const wrong = code === "000000" ? "111111" : "000000";
  r = await call("POST", "/auth/register", { ...user, code: wrong });
  check("буруу код татгалзав", r.status === 400 && r.json.error === "wrong_code");
  check("үлдсэн оролдлого хэлэв", /4 оролдлого/.test(r.json.message ?? ""), r.json.message);

  r = await call("POST", "/auth/register", { ...user, code: "12a" });
  check("формат буруу код", r.status === 400 && r.json.error === "bad_code");

  r = await call("POST", "/auth/register", { ...user, email: `other_${tag}@test.mn`, code });
  check("өөр и-мэйлд тэр код ажиллахгүй", r.status === 400 && r.json.error === "code_missing");

  r = await call("POST", "/auth/register", { ...user, code });
  check("зөв кодоор бүртгэгдэв", r.status === 201 && !!r.json.token && r.json.user?.email === user.email, JSON.stringify(r));

  r = await call("POST", "/auth/register", { ...user, code });
  check("дахин бүртгэхгүй", r.status === 409 && r.json.error === "email_taken");

  r = await call("POST", "/auth/register/code", user);
  check("бүртгэлтэй и-мэйлд код илгээхгүй", r.status === 409);

  r = await call("POST", "/auth/login", { email: user.email, password: user.password });
  check("шинэ бүртгэлээр нэвтэрнэ", r.status === 200 && !!r.json.token);

  console.log("5 буруу оролдлого");
  const u2 = { ...user, email: `lock_${tag}@test.mn` };
  r = await call("POST", "/auth/register/code", u2);
  const code2 = r.json.devCode;
  const bad = code2 === "999999" ? "888888" : "999999";
  for (let i = 0; i < 5; i++) await call("POST", "/auth/register", { ...u2, code: bad });
  r = await call("POST", "/auth/register", { ...u2, code: code2 });
  check("5 удаа буруу бол зөв код ч түгжигдэнэ", r.status === 400 && r.json.error === "code_locked", JSON.stringify(r));
} finally {
  server.kill();
}

console.log(`\n${passed} амжилттай, ${failed} алдаатай`);
process.exit(failed ? 1 : 0);
