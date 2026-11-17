/**
 * Даалуу API-тай харилцах клиент.
 * Токеныг AuthContext эндээс тохируулна — дэлгэцүүд токен барихгүй.
 */

import { Platform } from "react-native";

/**
 * Серверийн хаяг.
 *  - Хөгжүүлэлт: .env → EXPO_PUBLIC_API_URL=http://localhost:4000
 *  - Вэб build-ийг сервер өөрөө үйлчлэх үед: .env.production → "same-origin"
 *    (хуудас ямар хаягаар нээгдсэн, API ч тэр хаяг дээр — tunnel/домэйн солигдоход засах шаардлагагүй)
 *  - Утасны build: байршуулсан серверийн https хаяг
 */
const resolveApiUrl = () => {
  const env = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
  const sameOrigin = !env || env === "same-origin";
  if (sameOrigin && Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return sameOrigin ? "http://localhost:4000" : env.replace(/\/$/, "");
};

export const API_URL = resolveApiUrl();

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

/** Серверээс ирсэн алдаа — message нь хэрэглэгчид харуулах монгол текст */
export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Нэвтрэлт шаардахгүй хүсэлт (register/login) */
  anonymous?: boolean;
};

export const api = async <T = any>(path: string, options: Options = {}): Promise<T> => {
  const { method = "GET", body, anonymous } = options;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(!anonymous && authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", "Сервертэй холбогдож чадсангүй. Интернэтээ шалгана уу.");
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(json.error ?? "unknown", json.message ?? "Алдаа гарлаа. Дахин оролдоно уу.");
  }

  return json as T;
};

/** Сервер асаалттай эсэхийг шалгах */
export const pingServer = async () => {
  try {
    await api("/health", { anonymous: true });
    return true;
  } catch {
    return false;
  }
};
