/**
 * QPay урсгалын шалгалт. Тусдаа порт дээр QPAY_ENABLED=true сервер асаана.
 *
 *   node scripts/qpay-smoke.js           # жинхэнэ QPay sandbox (merchant-sandbox.qpay.mn)
 *   node scripts/qpay-smoke.js --fake    # дотоод хуурамч QPay — "төлөгдсөн" замыг шалгана
 */
import { spawn } from "node:child_process";
import http from "node:http";

const FAKE = process.argv.includes("--fake");
const PORT = 4100;
const FAKE_PORT = 4201;
const BASE = `http://localhost:${PORT}/api`;
const SECRET = "cb_test_secret";

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

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

/* ── хуурамч QPay: нэхэмжлэх бүрт төлсөн дүнг гараар тохируулна ── */
const paidAmounts = new Map();
let fakeChecks = 0;
const fakeQpay = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    const send = (j) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(j));
    };
    if (req.url === "/v2/auth/token") return send({ access_token: "fake", expires_in: 3600 });
    if (req.url === "/v2/invoice") {
      const id = `FAKE-${body.sender_invoice_no}`;
      paidAmounts.set(id, 0);
      return send({
        invoice_id: id,
        qr_text: "000201FAKE",
        qr_image: "iVBORw0KGgo=",
        urls: [{ name: "Khan bank", description: "Хаан банк", logo: "", link: "khanbank://q?x" }],
      });
    }
    if (req.url === "/v2/payment/check") {
      fakeChecks++;
      const amt = paidAmounts.get(body.object_id) ?? 0;
      return send({
        count: amt ? 1 : 0,
        paid_amount: amt,
        rows: amt ? [{ payment_id: "p1", payment_status: "PAID", payment_amount: String(amt) }] : [],
      });
    }
    res.writeHead(404).end();
  });
});

const startServer = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["src/index.js"], {
      env: {
        ...process.env,
        PORT: String(PORT),
        PUBLIC_URL: `http://localhost:${PORT}`,
        QPAY_ENABLED: "true",
        QPAY_BASE_URL: FAKE ? `http://localhost:${FAKE_PORT}` : "https://merchant-sandbox.qpay.mn",
        QPAY_USERNAME: "TEST_MERCHANT",
        QPAY_PASSWORD: "123456",
        QPAY_INVOICE_CODE: "TEST_INVOICE",
        QPAY_CALLBACK_SECRET: SECRET,
        ALLOW_DEMO_PAYMENTS: "false",
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

const run = async () => {
  if (FAKE) await new Promise((r) => fakeQpay.listen(FAKE_PORT, r));
  const server = await startServer();
  console.log(FAKE ? "── Хуурамч QPay ──" : "── QPay sandbox ──");

  try {
    const reg = await call("POST", "/auth/register", {
      body: { name: "Төлөгч", email: `qp_${Date.now().toString(36)}@test.mn`, password: "nuuts12345" },
    });
    const token = reg.json.token;

    const inv = await call("POST", "/coins/invoice", { token, body: { packId: "p50" } });
    const p = inv.json.payment;
    check("нэхэмжлэх үүсэв", inv.status === 201 && p?.id, JSON.stringify(inv.json).slice(0, 200));
    check("жинхэнэ (mock биш)", inv.json.mock === false);
    check("demo товч хаалттай", inv.json.demo === false);
    check("QR текст ирэв", (p?.qr_text ?? "").startsWith("000201"));
    check("QR зураг ирэв", !!p?.qr_image);
    check("банкны холбоосууд ирэв", p?.bank_urls?.length > 0, String(p?.bank_urls?.length));
    check("QPay invoice_id хадгалагдав", !!p?.qpay_invoice_id && !p.qpay_invoice_id.startsWith("MOCK-"));

    const demo = await call("POST", `/coins/invoice/${p.id}/demo-pay`, { token });
    check("demo төлбөр хаалттай", demo.json.error === "demo_disabled");

    const st = await call("GET", `/coins/invoice/${p.id}`, { token });
    check("төлөгдөөгүй → pending", st.json.payment?.status === "pending", JSON.stringify(st.json).slice(0, 200));

    const noSecret = await fetch(`${BASE}/coins/callback?payment_id=${p.id}`);
    check("нууцгүй callback татгалзав", noSecret.status === 403);

    const cb = await fetch(`${BASE}/coins/callback?payment_id=${p.id}&secret=${SECRET}`);
    const cbJson = await cb.json();
    check("төлөөгүй үед callback зоос нэмсэнгүй", cb.status === 200 && cbJson.settled === false, JSON.stringify(cbJson));

    if (FAKE) {
      // Дутуу төлбөр
      paidAmounts.set(p.qpay_invoice_id, 500);
      const part = await fetch(`${BASE}/coins/callback?payment_id=${p.id}&secret=${SECRET}`).then((r) => r.json());
      check("дутуу төлбөр (500₮/1000₮) зоос нэмсэнгүй", part.settled === false);

      // Бүтэн төлбөр — callback-аар
      paidAmounts.set(p.qpay_invoice_id, 1000);
      const full = await fetch(`${BASE}/coins/callback?payment_id=${p.id}&secret=${SECRET}`).then((r) => r.json());
      check("бүтэн төлбөр → 50 зоос нэмэгдэв", full.settled === true && full.coins === 50, JSON.stringify(full));

      const again = await fetch(`${BASE}/coins/callback?payment_id=${p.id}&secret=${SECRET}`).then((r) => r.json());
      check("давхар callback дахин нэмсэнгүй", again.settled === false);

      const bal = await call("GET", "/coins/balance", { token });
      check("үлдэгдэл 50, ledger-т 1 мөр", bal.json.coins === 50 && bal.json.ledger.length === 1);

      // Апп асуух замаар (callback ирээгүй ч) — 2 дахь нэхэмжлэх
      const inv2 = await call("POST", "/coins/invoice", { token, body: { packId: "p120" } });
      paidAmounts.set(inv2.json.payment.qpay_invoice_id, 2000);
      const poll = await call("GET", `/coins/invoice/${inv2.json.payment.id}`, { token });
      check("callback-гүйгээр асуухад төлөгдөв", poll.json.payment?.status === "paid" && poll.json.coins === 170, JSON.stringify(poll.json).slice(0, 160));

      const before = fakeChecks;
      await call("GET", `/coins/invoice/${inv2.json.payment.id}`, { token });
      check("төлөгдсөн нэхэмжлэхийг QPay руу дахин асуусангүй", fakeChecks === before);
    }
  } finally {
    server.kill();
    if (FAKE) fakeQpay.close();
  }

  console.log(`\n${passed} тэнцсэн, ${failed} унасан`);
  process.exit(failed ? 1 : 0);
};

run().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
