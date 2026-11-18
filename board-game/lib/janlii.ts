/**
 * Жанлий — майхан бүрийн эхэнд ээлжлэн нэг тоглогч сонгодог мод.
 * Сонгогдсон мод тэр майхны турш бүх модыг дийлж, аль ч өнгөн дээр тавигдана.
 * Бусад мод (Нохой ч) нүдний тоогоороо эрэмбэлэгдэнэ.
 *
 * server/src/game/tiles.js-ийн JANLII_OPTIONS-той ИЖИЛ байх ёстой.
 */

export const JANLII_RANK = 100;
export const JANLII_SECONDS = 30;

export const JANLII_OPTIONS: { typeId: string; label: string; short: string }[] = [
  { typeId: "ulaan_ys_Гавал ес", label: "Гавал /\nУлаан", short: "Гавал" },
  { typeId: "tsagaan_ys_Дэгээ ес", label: "Дэгээ /\nЦагаан", short: "Дэгээ" },
  { typeId: "tsagaan_naim2_Муруй найм", label: "Савар /\nМуруй", short: "Савар" },
  { typeId: "tsagaan_naim_Дөнгө найм", label: "Дөнгө", short: "Дөнгө" },
  { typeId: "tsagaan_doloo_Сарлаг долоо", label: "Сарлаг", short: "Сарлаг" },
  { typeId: "ulaan_doloo_Шанага долоо", label: "Шанага", short: "Шанага" },
  { typeId: "tsagaan_tav_Чүү тав", label: "Чүү", short: "Чүү" },
  { typeId: "ulaan_zurgaa_Нохой", label: "Нохой", short: "Нохой" },
];

export const janliiShort = (typeId: string | null | undefined) =>
  JANLII_OPTIONS.find((o) => o.typeId === typeId)?.short ?? "";

export const randomJanlii = () =>
  JANLII_OPTIONS[Math.floor(Math.random() * JANLII_OPTIONS.length)].typeId;

/** Модыг жанлийн дүрмээр хувиргана: хамгийн том, өнгөгүй ("" = ямар ч өнгөтэй таарна) */
export const withJanlii = <T extends { typeId: string; rank: number; color: string }>(
  tile: T,
  janlii: string | null | undefined
): T & { isJanlii: boolean } =>
  janlii && tile.typeId === janlii
    ? { ...tile, rank: JANLII_RANK, color: "", isJanlii: true }
    : { ...tile, isJanlii: false };
