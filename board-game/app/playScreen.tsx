import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import ExitConfirmModal from "../components/ExitConfirmModal";
import FeltBackdrop from "../components/FeltBackdrop";
import GameEndModal from "../components/GameEndModal";
import GameSeat from "../components/GameSeat";
import HistoryDrawer, { type HistoryRound } from "../components/HistoryDrawer";
import PauseModal from "../components/PauseModal";
import PeekModal from "../components/PeekModal";
import SocialPanel from "../components/SocialPanel";
import PushButton from "../components/ui/PushButton";
import { useTheme } from "../context/ThemeContext";
import { AVATAR_COLORS, MONO, PALETTE } from "../theme/colors";
import ChatModule, { type ChatModuleRef } from './ask';
import { selectBotMove } from './botlogic';
import { calculateWinner, executeTradingSystem, type FinalScorePlayer } from './trading';
import { TILE_TYPES, type TileInstance } from './types';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from "expo-router";

export function createDeck(): TileInstance[] {
    const deck: TileInstance[] = [];
    for (const t of TILE_TYPES) {
        for (let i = 1; i <= t.count; i++) {
            deck.push({ ...t, id: `${t.typeId}_${i}`, copyIndex: i });
        }
    }
    if (deck.length !== 50) console.warn("Deck is not 50:", deck.length);
    return deck;
}


export function shuffle<T>(arr: T[]) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function deal5(deck: TileInstance[]) {
    const shuffled = shuffle(deck);
    const hands: TileInstance[][] = [[], [], [], [], []];
    for (let i = 0; i < 50; i++) hands[i % 5].push(shuffled[i]);
    return hands;
}

export function colorMatches(color1: string | undefined, color2: string | null | undefined): boolean {
    if (!color1 || !color2) return true;
    return color1 === color2;
}

export default function PlayScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [myIndex] = useState(0);
    const chatModuleRef = useRef<ChatModuleRef>(null);

    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

    const [roundMoves, setRoundMoves] = useState<{ playerIndex: number, tiles: TileInstance[] }[]>([]);

    const [timeLeft, setTimeLeft] = useState(20);
    const [isTimerActive, setIsTimerActive] = useState(false);

    const initialData = useMemo(() => {
        const deck = createDeck();
        const hands = deal5(deck);
        const center: (TileInstance | TileInstance[])[] = [];

        console.log("🎴 ТОГЛООМ ЭХЭЛЛЭЭ - МОДУУД ХУВААГДЛАА");

        hands.forEach((hand, index) => {
            const playerName = index === 0 ? "👤 ТА" : `🤖 БОТ ${index}`;
            console.log(`\n${playerName}:`);  // ⬅️ () ХААЛТ!
            console.log(`Модны тоо: ${hand.length}`);  // ⬅️ () ХААЛТ!

            const sorted = [...hand].sort((a, b) => b.rank - a.rank);
            sorted.forEach((tile, i) => {
                console.log(`  ${i + 1}. ${tile.title} (rank: ${tile.rank}, өнгө: ${tile.color || 'хоосон'})`);  // ⬅️ () ХААЛТ!
            });
        });

        return { hands, center };
    }, []);

    const [hands, setHands] = useState(initialData.hands);
    const [center, setCenter] = useState<(TileInstance | TileInstance[])[]>(initialData.center);
    const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);

    // ===== ДИЗАЙНЫ UI STATES =====
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [peekIndex, setPeekIndex] = useState(-1);
    const [pressHint, setPressHint] = useState(true);
    const [paused, setPaused] = useState(false);
    const [turnLimit, setTurnLimit] = useState(20);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<HistoryRound[]>([]);
    const [social, setSocial] = useState<"emoji" | "quick" | null>(null);
    const [bubbles, setBubbles] = useState<(string | null)[]>([null, null, null, null, null]);
    const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ярианы бөмбөлөг 2.6 секундын дараа арилна
    const say = (seat: number, text: string) => {
        if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
        setBubbles(prev => {
            const next = prev.slice();
            next[seat] = text;
            return next;
        });
        bubbleTimer.current = setTimeout(() => {
            setBubbles(prev => {
                const next = prev.slice();
                next[seat] = null;
                return next;
            });
        }, 2600);
    };

    useEffect(() => () => {
        if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    }, []);

    const myHand = useMemo(() => {
        return [...hands[myIndex]].sort((a, b) => {
            if (b.rank !== a.rank) {
                return b.rank - a.rank;
            }
            return a.typeId.localeCompare(b.typeId);
        });
    }, [hands, myIndex]);

    const getAllCenterTiles = (): TileInstance[] => {
        const allTiles: TileInstance[] = [];
        for (const entry of center) {
            if (Array.isArray(entry)) {
                allTiles.push(...entry);
            } else {
                allTiles.push(entry);
            }
        }
        return allTiles;
    };

    const allCenterTiles = getAllCenterTiles();

    const currentEntry = center.length > 0 ? center[center.length - 1] : null;
    const isLastEntryPair = Array.isArray(currentEntry);

    const currentTiles = useMemo(() => {
        if (center.length === 0) return [];
        const firstEntry = center[0];
        const referenceColor = Array.isArray(firstEntry)
            ? firstEntry[0].color
            : firstEntry.color;

        const pairEntries = center.filter(entry => Array.isArray(entry)) as TileInstance[][];

        if (pairEntries.length > 0) {
            const validPairs = pairEntries.filter(pair => {
                if (pair[0].typeId === "nuuts") return false;
                const pairColor = pair[0].color;
                return !pairColor || !referenceColor || pairColor === referenceColor;
            });
            const highestValidPair = validPairs.reduce((maxPair, pair) => {
                return pair[0].rank > maxPair[0].rank ? pair : maxPair;
            });
            return highestValidPair;

        } else {
            if (allCenterTiles.length === 0) return [];

            const validTiles = allCenterTiles.filter(tile => {
                const tileColor = tile.color;
                return !tileColor || !referenceColor || tileColor === referenceColor;
            });

            return [validTiles.reduce((max, tile) =>
                tile.rank > max.rank ? tile : max
            )];
        }
    }, [center, allCenterTiles]);


    const lastTile = currentTiles.length > 0 ? currentTiles[0] : null;

    const previousTiles = useMemo(() => {
        const filtered = allCenterTiles
            .filter(tile => !currentTiles.some(ct => ct.id === tile.id));

        const secretTiles = filtered.filter(t => t.typeId === "nuuts");
        const nonSecretTiles = filtered.filter(t => t.typeId !== "nuuts");

        const secretGroups = new Map<string, TileInstance>();
        for (const tile of secretTiles) {
            // id format: "nuuts_1234567890_1" or "nuuts_1234567890_2"
            const baseId = tile.id.split('_').slice(0, 2).join('_');
            if (!secretGroups.has(baseId)) {
                secretGroups.set(baseId, tile);
            }
        }

        const finalSecrets = Array.from(secretGroups.values());

        return [...nonSecretTiles, ...finalSecrets].slice(-4);
    }, [allCenterTiles, currentTiles]);

    const hasValidSingleMove = useMemo(() => {
        if (!lastTile || center.length === 0 || isLastEntryPair) return false;
        return myHand.some(tile =>
            colorMatches(tile.color, lastTile.color) && tile.rank > lastTile.rank
        );
    }, [myHand, lastTile, center.length, isLastEntryPair]);

    const hasHigherSameColorPair = useMemo(() => {
        if (!lastTile || !isLastEntryPair) return false;

        const pairCounts = new Map<string, number>();
        for (const tile of myHand) {
            pairCounts.set(tile.typeId, (pairCounts.get(tile.typeId) || 0) + 1);
        }

        for (const tile of myHand) {
            if (pairCounts.get(tile.typeId)! >= 2 &&
                colorMatches(tile.color, lastTile.color) &&
                tile.rank > lastTile.rank) {
                return true;
            }
        }

        return false;
    }, [myHand, lastTile, isLastEntryPair]);

    const hasLowerSameColorPair = useMemo(() => {
        if (!lastTile || !isLastEntryPair) return false;

        const pairCounts = new Map<string, number>();
        for (const tile of myHand) {
            pairCounts.set(tile.typeId, (pairCounts.get(tile.typeId) || 0) + 1);
        }

        for (const tile of myHand) {
            if (pairCounts.get(tile.typeId)! >= 2 &&
                colorMatches(tile.color, lastTile.color) &&
                tile.rank < lastTile.rank) {
                return true;
            }
        }

        return false;
    }, [myHand, lastTile, isLastEntryPair]);

    const canSelectTile = (tile: TileInstance) => {
        if (center.length === 0) {
            if (selectedTileIds.length === 0) {
                return true;
            }

            if (selectedTileIds.length === 1) {
                const firstTile = myHand.find(t => t.id === selectedTileIds[0]);
                if (!firstTile) return false;
                return tile.typeId === firstTile.typeId;
            }

            return false;
        }

        if (isLastEntryPair) {
            // Хос гаргах шаардлагатай
            if (selectedTileIds.length === 0) {
                if (hasHigherSameColorPair || hasLowerSameColorPair) {
                    const pairCount = myHand.filter(t => t.typeId === tile.typeId).length;
                    if (pairCount < 2) return false;
                    if (!colorMatches(tile.color, lastTile!.color)) return false;

                    if (hasHigherSameColorPair) {
                        return tile.rank > lastTile!.rank;
                    } else if (hasLowerSameColorPair) {
                        return tile.rank < lastTile!.rank;
                    }
                } else {
                    return true;
                }
            }

            if (selectedTileIds.length === 1) {
                // 2 дахь мод сонгох
                const firstTile = myHand.find(t => t.id === selectedTileIds[0]);
                if (!firstTile) return false;

                if (hasHigherSameColorPair || hasLowerSameColorPair) {
                    return tile.typeId === firstTile.typeId;
                } else {
                    return true;
                }
            }

            return false;
        } else {
            if (selectedTileIds.length > 0) return false;

            if (hasValidSingleMove) {
                return colorMatches(tile.color, lastTile!.color) && tile.rank > lastTile!.rank;
            } else {
                return true;
            }
        }
    };

    const handleSelectTile = (tileId: string) => {
        if (selectedTileIds.includes(tileId)) {
            setSelectedTileIds(selectedTileIds.filter(id => id !== tileId));
        } else {
            const tile = myHand.find(t => t.id === tileId);
            if (tile && canSelectTile(tile)) {
                setSelectedTileIds([...selectedTileIds, tileId]);
            }
        }
    };

    const canPlaySelected = () => {
        if (selectedTileIds.length === 0) return false;

        if (center.length === 0) {
            if (selectedTileIds.length === 1) {
                const tile = myHand.find(t => t.id === selectedTileIds[0]);
                return tile ? tile.rank >= 8 : false;
            }

            if (selectedTileIds.length === 2) {
                const tile1 = myHand.find(t => t.id === selectedTileIds[0]);
                const tile2 = myHand.find(t => t.id === selectedTileIds[1]);
                return tile1 && tile2 && tile1.typeId === tile2.typeId;
            }

            return false;
        }

        if (isLastEntryPair) {
            // Хос гаргах ёстой
            if (selectedTileIds.length !== 2) return false;

            const tile1 = myHand.find(t => t.id === selectedTileIds[0]);
            const tile2 = myHand.find(t => t.id === selectedTileIds[1]);
            if (!tile1 || !tile2) return false;

            // Ижил өнгөтэй хос байгаа эсэхээс хамаарна
            if (hasHigherSameColorPair || hasLowerSameColorPair) {
                if (tile1.typeId !== tile2.typeId) return false;
                if (!colorMatches(tile1.color, lastTile!.color)) return false;

                if (hasHigherSameColorPair) {
                    return tile1.rank > lastTile!.rank;
                } else if (hasLowerSameColorPair) {
                    return tile1.rank < lastTile!.rank;
                }
            }

            // Ижил өнгөтэй хос байхгүй бол ямар ч 2 мод
            return true;
        } else {
            if (selectedTileIds.length !== 1) return false;

            const tile = myHand.find(t => t.id === selectedTileIds[0]);
            if (!tile) return false;

            if (hasValidSingleMove) {
                return colorMatches(tile.color, lastTile!.color) && tile.rank > lastTile!.rank;
            } else {
                return true;
            }
        }
    };

    const handlePlayTile = () => {
        if (!canPlaySelected()) return;
        setIsTimerActive(false);

        const tilesToPlay = myHand.filter(t => selectedTileIds.includes(t.id));
        if (tilesToPlay.length === 0) return;

        if (tilesToPlay.length === 2) {
            // Хос эсэхийг шалгах
            const isPair = tilesToPlay[0].typeId === tilesToPlay[1].typeId;

            if (isPair) {
                if (isLastEntryPair) {
                    const lastPair = currentEntry as TileInstance[];
                    const newPair = tilesToPlay;

                    if (newPair[0].rank > lastPair[0].rank) {
                        const updatedCenter = center.slice(0, -1);
                        updatedCenter.push(lastPair[0]);
                        updatedCenter.push(newPair);
                        setCenter(updatedCenter);
                    } else {
                        setCenter([...center, [newPair[0]]]);
                    }
                } else {
                    setCenter([...center, tilesToPlay]);
                }
            } else {
                // Хосгүй 2 мод - Нууц мод ХОСООР оруулах
                const secretTile = TILE_TYPES.find(t => t.typeId === "nuuts");
                if (secretTile) {
                    const timestamp = Date.now();
                    const secretInstance: TileInstance = {
                        ...secretTile,
                        id: `nuuts_${timestamp}`,
                        copyIndex: 1
                    };
                    const secretInstance2: TileInstance = {
                        ...secretTile,
                        id: `nuuts_${timestamp}_2`,
                        copyIndex: 2
                    };
                    setCenter([...center, [secretInstance, secretInstance2]]);
                }
            }
        } else {
            // 1 мод
            setCenter([...center, tilesToPlay[0]]);
        }

        const newHands = [...hands];
        newHands[myIndex] = newHands[myIndex].filter(t => !selectedTileIds.includes(t.id));
        setHands(newHands);
        setSelectedTileIds([]);
        const newRoundMoves = [...roundMoves, { playerIndex: currentPlayerIndex, tiles: tilesToPlay }];
        setRoundMoves(newRoundMoves);

        if (newRoundMoves.length === 5) {
            console.log("✅ 5 тоглогч дууслаа, оноо тооцож байна...");
            setTimeout(() => {
                calculateRoundScore(newHands)
            }, 2000);
            return;
        }
        setCurrentPlayerIndex((prev) => (prev + 1) % 5);
    };

    const calculateHasHigherPair = (botHand: TileInstance[]) => {
        if (!lastTile || !isLastEntryPair) return false;

        const pairCounts = new Map<string, number>();
        for (const tile of botHand) {
            pairCounts.set(tile.typeId, (pairCounts.get(tile.typeId) || 0) + 1);
        }

        for (const tile of botHand) {
            if (pairCounts.get(tile.typeId)! >= 2 &&
                colorMatches(tile.color, lastTile.color) &&
                tile.rank > lastTile.rank) {
                return true;
            }
        }
        return false;
    };

    const calculateHasLowerPair = (botHand: TileInstance[]) => {
        if (!lastTile || !isLastEntryPair) return false;

        const pairCounts = new Map<string, number>();
        for (const tile of botHand) {
            pairCounts.set(tile.typeId, (pairCounts.get(tile.typeId) || 0) + 1);
        }

        for (const tile of botHand) {
            if (pairCounts.get(tile.typeId)! >= 2 &&
                colorMatches(tile.color, lastTile.color) &&
                tile.rank < lastTile.rank) {
                return true;
            }
        }
        return false;
    };

    // Бот тоглох
    const playBotMove = (botIndex: number) => {
        const botHand = hands[botIndex];

        const selectedTiles = selectBotMove(
            botHand,
            center,
            currentTiles,
            isLastEntryPair,
            lastTile,
            calculateHasHigherPair(botHand),
            calculateHasLowerPair(botHand)
        );

        // Center-д мод нэмэх (handlePlayTile-тэй ижил)
        if (selectedTiles.length === 2) {
            const isPair = selectedTiles[0].typeId === selectedTiles[1].typeId;

            if (isPair) {
                if (isLastEntryPair) {
                    const lastPair = currentEntry as TileInstance[];
                    const newPair = selectedTiles;

                    if (newPair[0].rank > lastPair[0].rank) {
                        const updatedCenter = center.slice(0, -1);
                        updatedCenter.push(lastPair[0]);
                        updatedCenter.push(newPair);
                        setCenter(updatedCenter);
                    } else {
                        setCenter([...center, [newPair[0]]]);
                    }
                } else {
                    setCenter([...center, selectedTiles]);
                }
            } else {
                const secretTile = TILE_TYPES.find(t => t.typeId === "nuuts");
                if (secretTile) {
                    const timestamp = Date.now();
                    const s1: TileInstance = { ...secretTile, id: `nuuts_${timestamp}`, copyIndex: 1 };
                    const s2: TileInstance = { ...secretTile, id: `nuuts_${timestamp}_2`, copyIndex: 2 };
                    setCenter([...center, [s1, s2]]);
                }
            }
        } else {
            setCenter([...center, selectedTiles[0]]);
        }

        // Ботын гараас хасах
        const newHands = [...hands];
        const selectedIds = selectedTiles.map(t => t.id);
        newHands[botIndex] = newHands[botIndex].filter(t => !selectedIds.includes(t.id));
        setHands(newHands);

        const newRoundMoves = [...roundMoves, { playerIndex: botIndex, tiles: selectedTiles }];
        setRoundMoves(newRoundMoves);

        if (newRoundMoves.length === 5) {
            setTimeout(() => {
                calculateRoundScore(newHands)
            }, 3000);
            return;
        }

        setTimeout(() => {
            setCurrentPlayerIndex((prev) => (prev + 1) % 5);
        }, 800);
    };

    const calculateRoundScore = (currentHands: TileInstance[][]) => {
        console.log("💰 calculateRoundScore() дуудагдлаа");

        if (!roundInProgress) {
            console.log("⚠️ Round дууссан, алгасав");
            return;
        }

        if (roundMoves.length === 0) {
            console.log("⚠️ RoundMoves хоосон, алгасав");
            return;
        }

        const isPairMode = currentTiles.length === 2;
        const referenceColor = currentTiles.length > 0 ? currentTiles[0].color : null;

        console.log(`🎲 Тоглоомын горим: ${isPairMode ? 'ХОС' : 'SINGLE'}, Өнгө: ${referenceColor || 'хоосон'}`);

        let maxRank = -999;
        let winnerIndex = -1;

        for (const move of roundMoves) {
            const tiles = move.tiles;

            const isActualPair = tiles.length === 2 && tiles[0].typeId === tiles[1].typeId;
            const isSecret = tiles.length === 2 && !isActualPair;

            let tileRank: number;
            let tileColor: string | undefined;

            if (isSecret) {
                tileRank = 1;
                tileColor = undefined;
                console.log(`🤫 Тоглогч ${move.playerIndex}: Нууц мод (rank 1)`);
            } else {
                tileRank = tiles[0].rank;
                tileColor = tiles[0].color;
            }

            let isValid = true;

            if (!isSecret) {
                if (!colorMatches(tileColor, referenceColor)) {
                    isValid = false;
                    console.log(`❌ Тоглогч ${move.playerIndex}: Өнгө таарахгүй (${tileColor || 'яадаг'} vs ${referenceColor || 'хоосон'})`);
                }
            }

            if (isValid) {
                if (tileRank > maxRank) {
                    maxRank = tileRank;
                    winnerIndex = move.playerIndex;
                }
            }
        }

        if (winnerIndex === -1) {
            console.log("❌ Валид мод байхгүй!");
            return;
        }

        const winnerMove = roundMoves.find(m => m.playerIndex === winnerIndex);
        const isPairRound = winnerMove && winnerMove.tiles.length === 2 &&
            winnerMove.tiles[0].typeId === winnerMove.tiles[1].typeId;
        const scoreToAdd = isPairRound ? 2 : 1;

        console.log(`🏆 Ялагч: Тоглогч ${winnerIndex}, Rank: ${maxRank}, Оноо: ${scoreToAdd}`);

        // Гарын түүхэд бүртгэх
        const playedBySeat: (TileInstance[] | null)[] = [0, 1, 2, 3, 4].map(
            seat => roundMoves.find(m => m.playerIndex === seat)?.tiles ?? null
        );
        setHistory(prev => [...prev, { winner: winnerIndex, plays: playedBySeat }]);

        let updatedMyScore = myScore;
        let updatedOpponents = opponents;

        // Оноо нэмэх
        if (winnerIndex === 0) {
            updatedMyScore = {
                ...myScore,
                stars: myScore.stars + scoreToAdd
            };
            setMyScore(updatedMyScore);
            console.log(`🎉 Та +${scoreToAdd} оноо авлаа!`);
        } else {
            const newOpponents = [...opponents];
            const botIndex = winnerIndex - 1;
            newOpponents[botIndex].stars += scoreToAdd;
            updatedOpponents = newOpponents;
            setOpponents(newOpponents);
            console.log(`🤖 ${newOpponents[botIndex].name} +${scoreToAdd} оноо авлаа!`);
        }

        setTimeout(() => {
            setCenter([]);
            setRoundMoves([]);

            let startPlayer = winnerIndex;
            let attempts = 0;
            let canAnyoneStart = false;

            while (attempts < 5) {
                const playerHand = currentHands[startPlayer];
                const canStart = checkCanStartGame(playerHand);

                if (canStart) {
                    console.log(`✅ Тоглогч ${startPlayer} эхлэх эрхтэй`);
                    canAnyoneStart = true;
                    setCurrentPlayerIndex(startPlayer);
                    break;
                }

                console.log(`⏭️ Тоглогч ${startPlayer} эхлэх эрхгүй`);
                startPlayer = (startPlayer + 1) % 5;
                attempts++;
            }

            if (canAnyoneStart) {
                return;
            }

            console.log("⚠️ Хэн ч эхлэх эрхгүй!");

            const allHandsEmpty = currentHands.every(hand => hand.length === 0);

            if (allHandsEmpty) {
                console.log("🎊 Бүх гар хоосон! Худалдаа эхлүүлж байна...");
                setRoundInProgress(false);

                setTimeout(() => {
                    executeTrading(updatedMyScore, updatedOpponents);
                }, 1000);
                return;
            }

            console.log("💎 Гараас мод үлдсэн! Хамгийн их rank модтой тоглогч оноо авна");

            let maxRankForBonus = -999;
            let maxRankPlayer = -1;

            for (let i = 0; i < 5; i++) {
                const playerHand = currentHands[i];
                if (playerHand.length === 0) continue;

                const highestTile = playerHand.reduce((max, tile) =>
                    tile.rank > max.rank ? tile : max
                );

                if (highestTile.rank > maxRankForBonus) {
                    maxRankForBonus = highestTile.rank;
                    maxRankPlayer = i;
                }
            }

            if (maxRankPlayer === -1) {
                console.log("❌ Бүх гар хоосон (алдаа)");
                return;
            }

            if (maxRankPlayer === 0) {
                updatedMyScore = {
                    ...updatedMyScore,
                    stars: updatedMyScore.stars + 1
                };
                setMyScore(updatedMyScore);
                console.log(`🎁 Та хамгийн их rank (${maxRankForBonus}) модтой! +1 оноо`);
            } else {
                const newOpponents = [...updatedOpponents];
                const botIndex = maxRankPlayer - 1;
                newOpponents[botIndex].stars += 1;
                updatedOpponents = newOpponents;
                setOpponents(newOpponents);
                console.log(`🎁 ${newOpponents[botIndex].name} хамгийн их rank (${maxRankForBonus}) модтой! +1 оноо`);
            }

            setCurrentPlayerIndex(maxRankPlayer);

        }, 2000);
    };

    const checkCanStartGame = (hand: TileInstance[]): boolean => {
        if (hand.length === 0) return false;

        const hasHighRank = hand.some(t => t.rank >= 8);
        if (hasHighRank) return true;

        const pairCounts = new Map<string, number>();
        hand.forEach(t => pairCounts.set(t.typeId, (pairCounts.get(t.typeId) || 0) + 1));
        const hasPair = Array.from(pairCounts.values()).some(count => count >= 2);

        return hasPair;
    };

    const executeTrading = (
        currentMyScore = myScore,
        currentOpponents = opponents
    ) => {
        console.log("💰 Худалдаа эхлүүлж байна...");

        setRoundMoves([]);

        const result = executeTradingSystem(currentMyScore, currentOpponents);  // ⬅️ PARAMETER АШИГЛАХ

        setMyScore(result.myScore);
        setOpponents(result.opponents);

        setTimeout(() => {
            // Боттой тоглолт нь "Нэг л удаа хуваах" дүрмээр явна —
            // мод нэг удаа тарааж, тэр гараа дуусгамагц дүгнэнэ.
            const endCheck = { gameEnded: true, reason: "single" as const };

            if (endCheck.gameEnded) {
                console.log("🏆 ТОГЛООМ ДУУСЛАА!");
                console.log(`📊 Шалтгаан: нэг л удаа хуваах дүрэм`);

                const winnerData = calculateWinner(result.myScore, result.opponents);
                console.log(`🎉 Ялагч: ${winnerData.winner.name} (${winnerData.winner.finalScore} оноо)`);

                setRoundInProgress(false);

                // Дизайны "Дүн · ялагч" дэлгэц рүү шилжинэ
                const rows = winnerData.allScores.map((p, i) => ({
                    place: String(i + 1),
                    name: p.name,
                    detail: `${p.tsai} цай · ${p.avlaga} авлага · ${p.uglug} өглөг`,
                    score: String(p.finalScore),
                    seat: p.index ?? i,
                }));

                router.push({
                    pathname: "/end",
                    params: {
                        scores: JSON.stringify(rows),
                        winner: winnerData.winner.name,
                        summary: `${winnerData.winner.finalScore} цай хурааж дуусгав`,
                    },
                });
            } else {
                console.log("🔄 Шинэ round эхэллээ");
                startNewRound();
            }
        }, 2000);
    };

    const handleRestart = () => {
        setGameEnded(false);
        setFinalScores(null);
        setMyScore({ stars: 0, tsai: 2, avlaga: 0, uglug: 0 });
        setOpponents(prev => prev.map(opp => ({ ...opp, stars: 0, tsai: 2, avlaga: 0, uglug: 0 })));
        startNewRound();
    };

    const handleExit = () => {
        setGameEnded(false);
        setFinalScores(null);
        setMyScore({ stars: 0, tsai: 2, avlaga: 0, uglug: 0 });
        setOpponents(prev => prev.map(opp => ({ ...opp, stars: 0, tsai: 2, avlaga: 0, uglug: 0 })));
        console.log("Гарах");
        router.push('/');
    };

    const startNewRound = () => {
        setMyScore(prev => ({
            ...prev,
            stars: 0
        }));
        setOpponents(prev => prev.map(opp => ({
            ...opp,
            stars: 0
        })));

        const deck = createDeck();
        const newHands = deal5(deck);
        setHands(newHands);

        setCenter([]);
        setRoundMoves([]);

        setRoundInProgress(true);
        setCurrentPlayerIndex(0);
    };

    const [opponents, setOpponents] = useState([
        { id: "p1", name: "ХАНДДОРЖ", tsai: 2, avlaga: 0, uglug: 0, stars: 0 },
        { id: "p2", name: "ШИЖИР", tsai: 2, avlaga: 0, uglug: 0, stars: 0 },
        { id: "p3", name: "ЭНХЛЭН", tsai: 2, avlaga: 0, uglug: 0, stars: 0 },
        { id: "p4", name: "УЛАМБАЯР", tsai: 2, avlaga: 0, uglug: 0, stars: 0 },
    ]);

    const [myScore, setMyScore] = useState({
        stars: 0,
        tsai: 2,
        avlaga: 0,
        uglug: 0
    });

    const [roundInProgress, setRoundInProgress] = useState(true);
    const [gameEnded, setGameEnded] = useState(false);
    const [finalScores, setFinalScores] = useState<{ winner: FinalScorePlayer; allScores: FinalScorePlayer[] } | null>(null);

    useEffect(() => {
        if (currentPlayerIndex === 0) {
            setTimeLeft(turnLimit);
            setIsTimerActive(true);
        } else {
            setTimeLeft(2);
            setIsTimerActive(true);

            const timer = setTimeout(() => {
                playBotMove(currentPlayerIndex);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [currentPlayerIndex]);

    // Дэлгэц дээрх цагийг буулгаж харуулах (зөвхөн харагдац — автомат гаргалт хийхгүй)
    useEffect(() => {
        if (paused || turnLimit === 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [currentPlayerIndex, paused, turnLimit]);


    // Animation хувьсагч
    const wiggleAnim = useRef(new Animated.Value(0)).current;

    // Таны ээлж ирэх үед ээлжийн pill чичирнэ
    useEffect(() => {
        if (currentPlayerIndex === 0) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(wiggleAnim, {
                        toValue: 6,
                        duration: 400,
                        useNativeDriver: true
                    }),
                    Animated.timing(wiggleAnim, {
                        toValue: -6,
                        duration: 800,
                        useNativeDriver: true
                    }),
                    Animated.timing(wiggleAnim, {
                        toValue: 0,
                        duration: 400,
                        useNativeDriver: true
                    })
                ])
            ).start();
        } else {
            wiggleAnim.setValue(0);
        }
    }, [currentPlayerIndex]);

    // ===== ДИЗАЙНЫ ТУСЛАХ УТГУУД =====
    const dispNames = ["Чи", ...opponents.map(o => o.name)];
    const myTurn = currentPlayerIndex === 0;
    const roundFull = roundMoves.length === 5;
    const lowTime = myTurn && timeLeft <= 5;

    const seatTiles = (i: number) => roundMoves.find(m => m.playerIndex === i)?.tiles ?? null;

    const biggestOwnerIndex = useMemo(() => {
        if (currentTiles.length === 0) return -1;
        const move = roundMoves.find(m => m.tiles.some(t => currentTiles.some(ct => ct.id === t.id)));
        return move ? move.playerIndex : -1;
    }, [roundMoves, currentTiles]);

    const turnLabel = roundFull
        ? "Тооцоолж байна…"
        : myTurn
            ? turnLimit === 0 ? "Таны ээлж" : `Таны ээлж · ${timeLeft} сек`
            : `${dispNames[currentPlayerIndex]} бодож байна…`;

    const peekData = peekIndex < 0 ? null : peekIndex === 0
        ? { name: "Чи", color: AVATAR_COLORS[0], stats: { tsai: myScore.tsai, ger: myScore.stars, avlaga: myScore.avlaga, uglug: myScore.uglug } }
        : {
            name: opponents[peekIndex - 1].name,
            color: AVATAR_COLORS[peekIndex],
            stats: {
                tsai: opponents[peekIndex - 1].tsai,
                ger: opponents[peekIndex - 1].stars,
                avlaga: opponents[peekIndex - 1].avlaga,
                uglug: opponents[peekIndex - 1].uglug
            }
        };

    const seatFor = (i: number) => (
        <GameSeat
            name={dispNames[i]}
            color={AVATAR_COLORS[i]}
            isTurn={!roundFull && currentPlayerIndex === i}
            timeLeft={turnLimit === 0 ? null : timeLeft}
            ger={i === 0 ? myScore.stars : opponents[i - 1].stars}
            tiles={seatTiles(i)}
            isBiggest={biggestOwnerIndex === i}
            bubble={bubbles[i]}
            onLongPress={() => setPeekIndex(i)}
        />
    );

    return (
        <View style={[styles.safe, { backgroundColor: colors.feltTop }]}>
            <FeltBackdrop />

            {/* TOP BAR */}
            <View style={styles.topBar}>
                <Pressable
                    onPress={() => setPaused(true)}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressedDown]}
                >
                    <Text style={styles.iconBtnText}>❙❙</Text>
                </Pressable>

                <View style={styles.turnPillWrap}>
                    <Animated.View
                        style={[
                            styles.turnPill,
                            {
                                backgroundColor: roundFull
                                    ? "rgba(255,255,255,0.14)"
                                    : myTurn
                                        ? lowTime ? PALETTE.red : PALETTE.yellow
                                        : "rgba(255,255,255,0.14)",
                                transform: [{ translateX: wiggleAnim }]
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.turnPillText,
                                {
                                    color: roundFull
                                        ? "rgba(255,255,255,0.85)"
                                        : myTurn
                                            ? lowTime ? "#fff" : PALETTE.yellowText
                                            : "rgba(255,255,255,0.85)"
                                }
                            ]}
                        >
                            {turnLabel}
                        </Text>
                    </Animated.View>
                </View>

                <Pressable
                    onPress={() => setShowHistory(true)}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressedDown]}
                >
                    <Text style={styles.iconBtnText}>☰</Text>
                </Pressable>
            </View>

            {/* TOP SEATS (2, 3) */}
            <View style={styles.topSeats}>
                {seatFor(2)}
                {seatFor(3)}
            </View>

            {/* MIDDLE: LEFT SEAT + CENTER + RIGHT SEAT */}
            <View style={styles.middleRow}>
                {seatFor(1)}

                <View style={styles.centerArea}>
                    {currentTiles.length > 0 ? (
                        <>
                            <Text style={styles.centerLabel}>ХАМГИЙН ТОМ</Text>
                            <View style={styles.centerTilesRow}>
                                {currentTiles.map((tile, idx) => (
                                    <ExpoImage
                                        key={tile.id}
                                        source={tile.image}
                                        style={[styles.centerTile, idx === 1 && styles.centerTileOverlap]}
                                        contentFit="contain"
                                        priority="high"
                                        cachePolicy="memory-disk"
                                    />
                                ))}
                            </View>
                            <View style={styles.centerOwnerPill}>
                                <Text style={styles.centerOwnerText}>
                                    {biggestOwnerIndex >= 0 ? `${dispNames[biggestOwnerIndex]} · ` : ""}
                                    {currentTiles[0].title}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <View style={styles.centerEmpty}>
                            <Text style={styles.centerEmptyText}>
                                Гол хоосон{"\n"}8-аас дээш мод эсвэл хосоор эхэл
                            </Text>
                        </View>
                    )}

                    {previousTiles.length > 0 && (
                        <View style={styles.prevRow}>
                            {previousTiles.map((tile, idx) => (
                                <ExpoImage
                                    key={`${tile.id}_${idx}`}
                                    source={tile.image}
                                    style={styles.prevTile}
                                    contentFit="contain"
                                    cachePolicy="memory-disk"
                                />
                            ))}
                        </View>
                    )}
                </View>

                {seatFor(4)}
            </View>

            {/* MY PLAYED TILE */}
            <View style={styles.mySlotRow}>
                {seatTiles(0) ? (
                    <View style={styles.myPlayedRow}>
                        {seatTiles(0)!.slice(0, 2).map((t, i) => (
                            <ExpoImage
                                key={`${t.id}_${i}`}
                                source={t.image}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                                style={[
                                    styles.myPlayedTile,
                                    i === 1 && styles.myPlayedTileSecond,
                                    biggestOwnerIndex === 0 && styles.myPlayedTileWin
                                ]}
                            />
                        ))}
                    </View>
                ) : (
                    <View style={styles.mySlotEmpty}>
                        <Text style={styles.mySlotEmptyText}>Чи</Text>
                    </View>
                )}
            </View>

            {/* MY ROW: AVATAR + STATS */}
            <View style={styles.myRow}>
                <View
                    style={[
                        styles.myRing,
                        {
                            backgroundColor: myTurn && !roundFull
                                ? lowTime ? PALETTE.red : PALETTE.yellow
                                : "rgba(255,255,255,0.10)"
                        }
                    ]}
                >
                    {!!bubbles[0] && (
                        <View style={styles.myBubble}>
                            <Text style={styles.myBubbleText} numberOfLines={1}>{bubbles[0]}</Text>
                        </View>
                    )}
                    <Pressable onLongPress={() => setPeekIndex(0)} delayLongPress={380}>
                        <View style={[styles.myAvatar, { backgroundColor: AVATAR_COLORS[0] }]}>
                            <Text style={styles.myAvatarText}>Ч</Text>
                        </View>
                    </Pressable>
                </View>

                <View style={styles.chipsRow}>
                    <View style={styles.chip}>
                        <Text style={styles.chipLabel}>ЦАЙ</Text>
                        <Text style={[styles.chipValue, { color: PALETTE.yellow }]}>{myScore.tsai}</Text>
                    </View>
                    <View style={styles.chip}>
                        <Text style={styles.chipLabel}>АВЛАГА</Text>
                        <Text style={[styles.chipValue, { color: PALETTE.green }]}>{myScore.avlaga}</Text>
                    </View>
                    <View style={styles.chip}>
                        <Text style={styles.chipLabel}>ӨГЛӨГ</Text>
                        <Text style={[styles.chipValue, { color: PALETTE.orange }]}>{myScore.uglug}</Text>
                    </View>
                </View>

                <View style={styles.gerChip}>
                    <Text style={styles.chipLabel}>ГЭР</Text>
                    <Text style={[styles.chipValue, { color: PALETTE.yellow }]}>🏠 {myScore.stars}</Text>
                </View>
            </View>

            {/* PRESS HINT */}
            {pressHint && (
                <View style={styles.hintRow}>
                    <Text style={styles.hintText}>
                        Тоглогчийн зураг дээр удаан дарж цай · авлага · өглөгийг хар
                    </Text>
                    <Pressable onPress={() => setPressHint(false)} style={styles.hintBtn}>
                        <Text style={styles.hintBtnText}>Ойлголоо</Text>
                    </Pressable>
                </View>
            )}

            {/* ACTIONS */}
            <View style={styles.actionRow}>
                <Pressable
                    onPress={() => setSocial("emoji")}
                    style={({ pressed }) => [styles.socialBtn, pressed && styles.pressedDown]}
                >
                    <Text style={styles.socialBtnText}>🙂</Text>
                </Pressable>

                <Pressable
                    onPress={() => setSocial("quick")}
                    style={({ pressed }) => [styles.socialBtn, pressed && styles.pressedDown]}
                >
                    <Text style={styles.socialBtnText}>💬</Text>
                </Pressable>

                <PushButton
                    label={selectedTileIds.length > 0 ? `Мод гаргах (${selectedTileIds.length})` : "Мод гаргах"}
                    color={canPlaySelected() && myTurn ? PALETTE.green : "rgba(255,255,255,0.10)"}
                    shadowColor={canPlaySelected() && myTurn ? PALETTE.greenDark : "transparent"}
                    textColor={canPlaySelected() && myTurn ? "#fff" : "rgba(255,255,255,0.45)"}
                    onPress={handlePlayTile}
                    disabled={!canPlaySelected() || !myTurn}
                    radius={15}
                    style={{ flex: 1 }}
                    faceStyle={{ paddingVertical: 14 }}
                    textStyle={{ fontSize: 16 }}
                />

                {selectedTileIds.length > 0 && (
                    <PushButton
                        label="✕"
                        color={PALETTE.red}
                        shadowColor={PALETTE.redDark}
                        onPress={() => setSelectedTileIds([])}
                        radius={15}
                        faceStyle={{ width: 48, paddingVertical: 14, paddingHorizontal: 0 }}
                        textStyle={{ fontSize: 16 }}
                    />
                )}
            </View>

            {/* MY HAND */}
            <View style={styles.handWrap}>
                <FlatList
                    horizontal
                    data={myHand}
                    keyExtractor={(t) => t.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 14, gap: 9 }}
                    renderItem={({ item }) => {
                        const isSelected = selectedTileIds.includes(item.id);
                        const canSelect = canSelectTile(item);

                        return (
                            <Pressable
                                style={[
                                    styles.handItem,
                                    isSelected && styles.handItemSelected,
                                    !isSelected && !canSelect && styles.handItemDisabled
                                ]}
                                onPress={() => handleSelectTile(item.id)}
                                disabled={!isSelected && !canSelect}
                            >
                                <ExpoImage
                                    source={item.image}
                                    style={styles.handTile}
                                    contentFit="contain"
                                    transition={0}
                                    cachePolicy="memory-disk"
                                />
                                <Text style={styles.handLabel} numberOfLines={1}>
                                    {item.title}
                                </Text>
                            </Pressable>
                        );
                    }}
                />
            </View>

            {/* MODALS */}
            {peekData && (
                <PeekModal
                    visible={peekIndex >= 0}
                    onClose={() => setPeekIndex(-1)}
                    name={peekData.name}
                    color={peekData.color}
                    stats={peekData.stats}
                />
            )}

            <PauseModal
                visible={paused}
                turnLimit={turnLimit}
                endRuleShort="Нэг хуваалт"
                onPickLimit={(value) => {
                    setTurnLimit(value);
                    setTimeLeft(value);
                }}
                onResume={() => setPaused(false)}
                onExit={() => {
                    setPaused(false);
                    setShowExitConfirm(true);
                }}
            />

            <HistoryDrawer
                visible={showHistory}
                onClose={() => setShowHistory(false)}
                rounds={history}
                names={dispNames}
            />

            <SocialPanel
                mode={social}
                onClose={() => setSocial(null)}
                onSend={(text) => say(0, text)}
            />

            <ExitConfirmModal
                visible={showExitConfirm}
                ger={myScore.stars}
                onConfirm={() => {
                    setShowExitConfirm(false);
                    handleExit();
                }}
                onCancel={() => setShowExitConfirm(false)}
            />

            {finalScores && (
                <GameEndModal
                    visible={gameEnded}
                    winner={finalScores.winner}
                    allScores={finalScores.allScores}
                    onRestart={handleRestart}
                    onExit={handleExit}
                />
            )}
            <ChatModule ref={chatModuleRef} />
        </View>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        paddingTop: 8,
        paddingBottom: 12,
    },

    pressedDown: {
        transform: [{ translateY: 2 }],
    },

    topBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingBottom: 6,
    },

    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.14)",
        alignItems: "center",
        justifyContent: "center",
    },

    iconBtnText: {
        fontSize: 15,
        fontWeight: "800",
        color: "#fff",
    },

    turnPillWrap: {
        flex: 1,
        alignItems: "center",
    },

    turnPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
    },

    turnPillText: {
        fontSize: 13,
        fontWeight: "800",
    },

    topSeats: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingHorizontal: 44,
        paddingTop: 2,
    },

    middleRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
    },

    centerArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 210,
    },

    centerLabel: {
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1,
        color: "rgba(255,255,255,0.78)",
    },

    centerTilesRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    centerTile: {
        width: 96,
        height: 152,
    },

    centerTileOverlap: {
        marginLeft: -60,
    },

    centerOwnerPill: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: "rgba(0,0,0,0.3)",
    },

    centerOwnerText: {
        fontSize: 12,
        fontWeight: "800",
        color: PALETTE.yellow,
    },

    centerEmpty: {
        width: 130,
        height: 170,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: "rgba(255,255,255,0.18)",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
    },

    centerEmptyText: {
        fontSize: 12,
        fontWeight: "700",
        lineHeight: 18,
        textAlign: "center",
        color: "rgba(255,255,255,0.5)",
    },

    prevRow: {
        flexDirection: "row",
        gap: 4,
        marginTop: 2,
    },

    prevTile: {
        width: 26,
        height: 40,
        opacity: 0.55,
    },

    mySlotRow: {
        alignItems: "center",
        paddingVertical: 4,
    },

    myPlayedRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    myPlayedTile: {
        width: 46,
        height: 70,
        borderRadius: 8,
    },

    myPlayedTileSecond: {
        marginLeft: -30,
    },

    myPlayedTileWin: {
        borderWidth: 3,
        borderColor: PALETTE.yellow,
        borderRadius: 10,
    },

    mySlotEmpty: {
        width: 46,
        height: 70,
        borderRadius: 10,
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: "rgba(255,255,255,0.38)",
        alignItems: "center",
        justifyContent: "center",
    },

    mySlotEmptyText: {
        fontSize: 9,
        fontWeight: "700",
        color: "rgba(255,255,255,0.72)",
    },

    myRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 6,
        overflow: "visible",
    },

    myRing: {
        width: 50,
        height: 50,
        borderRadius: 16,
        padding: 5,
        overflow: "visible", // ярианы бөмбөлөг гадагш гарна
    },

    myAvatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },

    myAvatarText: {
        fontSize: 14,
        fontWeight: "900",
        color: "#fff",
    },

    myBubble: {
        position: "absolute",
        bottom: 54,
        left: 0,
        maxWidth: 150,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 14,
        backgroundColor: "#fff",
        zIndex: 3,
    },

    myBubbleText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#2B2D31",
    },

    chipsRow: {
        flex: 1,
        flexDirection: "row",
        gap: 5,
    },

    chip: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.10)",
        borderRadius: 10,
        paddingVertical: 4,
        paddingHorizontal: 2,
        alignItems: "center",
    },

    gerChip: {
        backgroundColor: "rgba(255,200,61,0.16)",
        borderRadius: 10,
        paddingVertical: 4,
        paddingHorizontal: 10,
        alignItems: "center",
    },

    chipLabel: {
        fontSize: 8,
        fontWeight: "700",
        letterSpacing: 0.4,
        color: "rgba(255,255,255,0.78)",
    },

    chipValue: {
        fontSize: 13,
        fontFamily: MONO,
        marginTop: 1,
    },

    hintRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        paddingHorizontal: 14,
        paddingBottom: 4,
    },

    hintText: {
        flexShrink: 1,
        fontSize: 10,
        fontWeight: "600",
        color: "rgba(255,255,255,0.72)",
    },

    hintBtn: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.16)",
    },

    hintBtnText: {
        fontSize: 9,
        fontWeight: "800",
        color: "#fff",
    },

    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingBottom: 6,
    },

    socialBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.14)",
        alignItems: "center",
        justifyContent: "center",
    },

    socialBtnText: {
        fontSize: 18,
    },

    handWrap: {
        paddingTop: 12,
    },

    handItem: {
        width: 70,
        alignItems: "center",
        gap: 5,
        paddingTop: 7,
        paddingBottom: 8,
        paddingHorizontal: 5,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: "transparent",
    },

    handItemSelected: {
        borderColor: PALETTE.green,
        backgroundColor: "rgba(70,201,58,0.22)",
        transform: [{ translateY: -10 }],
    },

    handItemDisabled: {
        opacity: 0.42,
    },

    handTile: {
        width: 53,
        height: 84,
    },

    handLabel: {
        fontSize: 9,
        fontWeight: "700",
        color: "rgba(255,255,255,0.85)",
        maxWidth: 66,
    },
});
