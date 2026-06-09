import { TILE_TYPES, type TileInstance } from './types';

// Өнгө таарах
function colorMatches(color1: string, color2: string): boolean {
    if (!color1 || !color2) return true;
    return color1 === color2;
}

// Хос олох
function findPairs(hand: TileInstance[]): TileInstance[][] {
    const pairMap = new Map<string, TileInstance[]>();
    
    for (const tile of hand) {
        const existing = pairMap.get(tile.typeId) || [];
        existing.push(tile);
        pairMap.set(tile.typeId, existing);
    }
    
    const pairs: TileInstance[][] = [];
    for (const [_, tiles] of pairMap) {
        if (tiles.length >= 2) {
            pairs.push([tiles[0], tiles[1]]);
        }
    }
    
    return pairs;
}

// ГОЛ ХООСОН ҮЕИЙН МОД СОНГОХ
function selectStartMove(hand: TileInstance[]): TileInstance[] {
    // 1. Хос байвал хамгийн их rank хос
    const pairs = findPairs(hand);
    if (pairs.length > 0) {
        const sortedPairs = pairs.sort((a, b) => b[0].rank - a[0].rank);
        return sortedPairs[0];
    }
    
    // 2. Rank>=8 мод
    const validSingles = hand.filter(t => t.rank >= 8);
    if (validSingles.length > 0) {
        const sorted = validSingles.sort((a, b) => b.rank - a.rank);
        return [sorted[0]];
    }
    
    // 3. Ямар ч их rank мод (fallback)
    const sorted = hand.sort((a, b) => b.rank - a.rank);
    return [sorted[0]];
}

// НЭГЭЭР ТОГЛОХ ҮЕИЙН МОД СОНГОХ
function selectSingleMove(
    hand: TileInstance[],
    displayTile: TileInstance
): TileInstance[] {
    // Valid move байвал их rank-ийг гаргах
    const validMoves = hand.filter(t => 
        colorMatches(t.color, displayTile.color) && t.rank > displayTile.rank
    );
    
    if (validMoves.length > 0) {
        const sorted = validMoves.sort((a, b) => b.rank - a.rank);
        return [sorted[0]]; // Хамгийн их rank
    }
    
    // Valid move байхгүй - хамгийн бага rank (их модоо хадгал)
    const sorted = hand.sort((a, b) => a.rank - b.rank);
    return [sorted[0]];
}

// ХОСООР ТОГЛОХ ҮЕИЙН МОД СОНГОХ
function selectPairMove(
    hand: TileInstance[],
    lastTile: TileInstance,
    hasHigherSameColorPair: boolean,
    hasLowerSameColorPair: boolean
): TileInstance[] {
    const pairs = findPairs(hand);
    
    // Valid хос байвал
    if (hasHigherSameColorPair || hasLowerSameColorPair) {
        const validPairs = pairs.filter(pair => {
            const matchesColor = colorMatches(pair[0].color, lastTile.color);
            const higherRank = pair[0].rank > lastTile.rank;
            const lowerRank = pair[0].rank < lastTile.rank;
            
            if (hasHigherSameColorPair) {
                return matchesColor && higherRank;
            } else {
                return matchesColor && lowerRank;
            }
        });
        
        if (validPairs.length > 0) {
            // Их rank хос гаргах
            const sorted = validPairs.sort((a, b) => b[0].rank - a[0].rank);
            return sorted[0];
        }
    }
    
    // Valid хос байхгүй - ямар ч 2 мод (бага rank)
    const sorted = hand.sort((a, b) => a.rank - b.rank);
    return [sorted[0], sorted[1]];
}

// ҮНДСЭН ФУНКЦ - БОТ МОД СОНГОХ
export function selectBotMove(
    hand: TileInstance[],
    center: (TileInstance | TileInstance[])[],
    currentTiles: TileInstance[],
    isLastEntryPair: boolean,
    lastTile: TileInstance | null,
    hasHigherSameColorPair: boolean,
    hasLowerSameColorPair: boolean
): TileInstance[] {
    // Гол хоосон
    if (center.length === 0) {
        return selectStartMove(hand);
    }
    
    // Хосоор тоглох
    if (isLastEntryPair && lastTile) {
        return selectPairMove(hand, lastTile, hasHigherSameColorPair, hasLowerSameColorPair);
    }
    
    // Нэгээр тоглох
    if (currentTiles.length > 0) {
        return selectSingleMove(hand, currentTiles[0]);
    }
    
    // Fallback
    return [hand[0]];
}