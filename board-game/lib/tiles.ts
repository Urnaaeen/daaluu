import { TILE_TYPES } from "../app/types";
import { withJanlii } from "./janlii";

/**
 * Серверээс зөвхөн модны id ирнэ ("ulaan_daaluu_Даалуу_3").
 * Зураг, нэрийг апп-ын лавлахаас олно.
 */

const byType = new Map(TILE_TYPES.map((t) => [t.typeId as string, t]));

/** "ulaan_daaluu_Даалуу_3" → "ulaan_daaluu_Даалуу" */
export const typeOfTile = (tileId: string) => tileId.replace(/_(\d+)$/, "");

export type TileView = {
  id: string;
  typeId: string;
  title: string;
  color: string;
  rank: number;
  image: any;
  /** Тухайн майхны жанлий мөн эсэх (хамгийн том, өнгөгүй) */
  isJanlii: boolean;
};

/** janlii өгөгдвөл тэр төрлийн мод хамгийн том, өнгөгүй болно */
export const tileView = (tileId: string, janlii?: string | null): TileView | null => {
  const type = byType.get(typeOfTile(tileId));
  if (!type) return null;
  return withJanlii(
    {
      id: tileId,
      typeId: type.typeId as string,
      title: type.title as string,
      color: type.color as string,
      rank: type.rank as number,
      image: type.image,
    },
    janlii
  );
};

export const tileViews = (tileIds: string[], janlii?: string | null): TileView[] =>
  tileIds.map((id) => tileView(id, janlii)).filter((t): t is TileView => t !== null);

/** Гарыг эрэмбээр нь буурч эрэмбэлнэ (дэлгэц дээр том нь эхэнд, жанлий хамгийн түрүүнд) */
export const sortHand = (tileIds: string[], janlii?: string | null): TileView[] =>
  tileViews(tileIds, janlii).sort((a, b) =>
    b.rank !== a.rank ? b.rank - a.rank : a.typeId.localeCompare(b.typeId)
  );
