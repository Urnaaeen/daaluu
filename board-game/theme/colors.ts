import { Platform } from "react-native";

// "Цай хураах" дизайны токенууд (Claude Design prototype-оос)
export const COLORS = {
  light: {
    background: "#F7F9FB",
    card: "#FFFFFF",
    sunken: "#EEF1F4",
    text: "#2B2D31",
    subText: "#5A5F66",
    muted: "#969CA3",
    border: "#E5E8EB",
    header: "#F7F9FB",
    title: "#2B2D31",
    // Гэрийн зурагны дулаан улбар шартай нийцүүлсэн үндсэн өнгө
    accent: "#FF7A1A",
    accentDark: "#D65A00",
    feltTop: "#123A2E",
    feltBottom: "#0C2A21",
  },

  dark: {
    background: "#15181D",
    card: "#1E222A",
    sunken: "#252A33",
    text: "#F2F4F6",
    subText: "#A7AEB8",
    muted: "#767E8A",
    border: "#2F3540",
    header: "#15181D",
    title: "#F2F4F6",
    accent: "#FF7A1A",
    accentDark: "#D65A00",
    feltTop: "#0E2C24",
    feltBottom: "#08201A",
  },
};

// Хоёр горимд адилхан хэрэглэгдэх утгууд
export const PALETTE = {
  green: "#46C93A",
  greenDark: "#3AA82F",
  greenSoft: "#E3F8E1",
  greenText: "#1F7A18",
  orange: "#FF9600",
  orangeDark: "#E07F00",
  // Үндсэн улбар шарын зөөлөн хувилбар — сонгогдсон төлөв тэмдэглэхэд
  accentSoft: "#FFE9D6",
  accentText: "#B04A00",
  red: "#FF4B4B",
  redDark: "#E13838",
  redSoft: "#FFE8E8",
  redText: "#B02020",
  yellow: "#FFC83D",
  yellowText: "#5E4400",
  gold: "#8A6A00",
  goldSoft: "#FFF6D6",
  hostSoft: "#FFEFD6",
  hostText: "#8A4F00",
};

// nevtreh.png бүдгэрсэн дэвсгэртэй дэлгэцүүдийн зах — зурагны дулаан
// бараан өнгөтэй нийцүүлж, safe-area ирмэг цайж харагдахаас сэргийлнэ.
export const BLUR_BG = "#20150D";

// Тоглогчдын аватар өнгө (суудлын дарааллаар).
// Эхнийх нь өөрөө — үндсэн улбар шар, бусад нь ялгарах өнгөнүүд.
export const AVATAR_COLORS = ["#FF7A1A", "#2B8FF0", "#46C93A", "#9B6BFF", "#FF4B4B"];

// Тоо, код харуулах mono фонт
export const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
