import { TILE_TYPES } from "../app/types";

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
};

export const tileView = (tileId: string): TileView | null => {
  const type = byType.get(typeOfTile(tileId));
  if (!type) return null;
  return {
    id: tileId,
    typeId: type.typeId,
    title: type.title,
    color: type.color,
    rank: type.rank,
    image: type.image,
  };
};

export const tileViews = (tileIds: string[]): TileView[] =>
  tileIds.map(tileView).filter((t): t is TileView => t !== null);

/** Гарыг эрэмбээр нь буurаж эрэмбэлнэ (дэлгэц дээр том нь эхэнд) */
export const sortHand = (tileIds: string[]): TileView[] =>
  tileViews(tileIds).sort((a, b) =>
    b.rank !== a.rank ? b.rank - a.rank : a.typeId.localeCompare(b.typeId)
  );
