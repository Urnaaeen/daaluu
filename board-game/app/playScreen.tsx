import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { TopStatsBar } from "../components/aTopStatsBar";
import GameEndModal from "../components/GameEndModal";
import PlayerScore from "../components/PlayerScore";
import { useTheme } from "../context/ThemeContext";
import ChatModule, { type ChatModuleRef } from './ask';
import { selectBotMove } from './botlogic';
import { calculateWinner, checkGameEnd, executeTradingSystem, type FinalScorePlayer } from './trading';
import { TILE_TYPES, type TileInstance } from './types';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from "expo-router";
import { Animated } from 'react-native';

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
            const endCheck = checkGameEnd(result.myScore, result.opponents);

            if (endCheck.gameEnded) {
                console.log("🏆 ТОГЛООМ ДУУСЛАА!");
                console.log(`📊 Шалтгаан: ${endCheck.reason === 'tsai' ? '10 цай' : '10 өглөг'}`);

                const winnerData = calculateWinner(result.myScore, result.opponents);
                console.log(`🎉 Ялагч: ${winnerData.winner.name} (${winnerData.winner.finalScore} оноо)`);

                setFinalScores(winnerData);
                setGameEnded(true);
                setRoundInProgress(false);
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
            setTimeLeft(20);
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


    // useEffect(() => {
    //     if (!isTimerActive) return;

    //     if (timeLeft <= 0) {
    //         // Цаг дууссан - автомат алгас
    //         console.log("⏰ Цаг дууслаа - автомат алгас");
    //         if (currentPlayerIndex === 0) {
    //             // Хүн тоглогч - автоматаар мод гаргах
    //             autoPlayForUser();
    //         }
    //         return;
    //     }

    //     const timer = setInterval(() => {
    //         setTimeLeft(prev => prev - 1);
    //     }, 1000);

    //     return () => clearInterval(timer);
    // }, [isTimerActive, timeLeft, currentPlayerIndex]);

    useEffect(() => {
        const preloadImages = async () => {
            const imageUris = TILE_TYPES.map(tile => tile.image);
            await ExpoImage.prefetch(imageUris);
            console.log('✅ Бүх модны зургууд ачааллаа!');
        };
        preloadImages();
    }, []);


    // Автомат мод гаргах (хүний хувьд - цаг дууссан)
    // const autoPlayForUser = () => {
    //     if (myHand.length === 0) return;

    //     console.log("⏰ Цаг дууслаа! Автоматаар мод гаргаж байна...");

    //     if (isLastEntryPair) {
    //         // ХОС гаргах ёстой
    //         const validTiles = myHand.filter(t => canSelectTile(t));

    //         if (validTiles.length === 0) {
    //             console.log("❌ Гаргах мод байхгүй");
    //             return;
    //         }

    //         const sorted = validTiles.sort((a, b) => a.rank - b.rank);
    //         const tile1 = sorted[0];

    //         const remainingValid = myHand.filter(t =>
    //             t.id !== tile1.id && canSelectTile(t)
    //         );

    //         if (remainingValid.length > 0) {
    //             const tile2 = remainingValid.sort((a, b) => a.rank - b.rank)[0];
    //             setSelectedTileIds([tile1.id, tile2.id]);
    //         } else {
    //             setSelectedTileIds([tile1.id]);
    //         }

    //     } else {
    //         // НЭГЭЭР тоглох
    //         const validTiles = myHand.filter(t => canSelectTile(t));

    //         if (validTiles.length === 0) {
    //             console.log("❌ Гаргах мод байхгүй");
    //             return;
    //         }

    //         const sorted = validTiles.sort((a, b) => a.rank - b.rank);
    //         setSelectedTileIds([sorted[0].id]);
    //     }

    //     setTimeout(() => {
    //         handlePlayTile();
    //     }, 5000);
    // };

        // Animation хувьсагч
    const wiggleAnim = useRef(new Animated.Value(0)).current;
    
    // Таны ээлж иржих үед animation эхлүүлэх
    useEffect(() => {
        if (currentPlayerIndex === 0) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(wiggleAnim, {
                        toValue: 8,  // Баруун тийш 8px
                        duration: 400,
                        useNativeDriver: true
                    }),
                    Animated.timing(wiggleAnim, {
                        toValue: -8,  // Зүүн тийш 8px
                        duration: 800,
                        useNativeDriver: true
                    }),
                    Animated.timing(wiggleAnim, {
                        toValue: 0,  // Төв рүү буцах
                        duration: 400,
                        useNativeDriver: true
                    })
                ])
            ).start();
        } else {
            wiggleAnim.setValue(0);  // Бусдын ээлж бол зогсоох
        }
    }, [currentPlayerIndex]);

    return (
        <View style={[styles.safe, { backgroundColor: colors.background }]}>
            <TopStatsBar
                avlaga={myScore.avlaga}
                uglug={myScore.uglug}
                tsai={myScore.tsai}
                tsaiTotal={10}
                ger={myScore.stars}
            />

            <View style={styles.gameArea}>

                {/* Center board */}
                <View style={styles.centerWrap}>
                    <View style={[styles.centerBoard, { backgroundColor: colors.card }]}>
                        <Animated.View style={[
                            styles.centerBoard,
                            {
                                backgroundColor: colors.card,  // Өнгө өөрчлөхгүй
                                transform: [{ translateX: wiggleAnim }]  // ⬅️ Зүүн-баруун
                            }
                        ]}>
                        {/* Өмнөх модууд */}
                        {previousTiles.length > 0 && (
                            <View style={styles.previousTilesRow}>
                                {previousTiles.map((tile, idx) => (
                                    <View key={`${tile.id}_${idx}`} style={styles.previousTileItem}>
                                        <ExpoImage
                                            source={tile.image}
                                            style={styles.previousTileImage}
                                            contentFit="contain"
                                            cachePolicy="memory-disk"
                                        />
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Одоогийн том мод(ууд) */}
                        {currentTiles.length > 0 ? (
                            <View style={styles.currentTilesWrap}>
                                {currentTiles.map((tile, idx) => (
                                    <View
                                        key={tile.id}
                                        style={[
                                            styles.centerTileContainer,
                                            currentTiles.length === 2 && idx === 1 && styles.centerTileOverlap
                                        ]}
                                    >
                                        <ExpoImage
                                            source={tile.image}
                                            style={styles.centerTile}
                                            contentFit="contain"
                                            priority="high"
                                            cachePolicy="memory-disk"
                                        />
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.emptyText}>Гол хоосон</Text>
                        )}
                        </Animated.View>
                    </View>
                </View>

                {/* Action row */}
                <View style={styles.actionRow}>
                    <Pressable
                        style={[styles.actionBtn, { backgroundColor: colors.card }]}
                        onPress={() => chatModuleRef.current?.open()}
                    >
                        <Text style={styles.actionText}>Дүрэм асуух</Text>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.actionBtn,
                            styles.primaryBtn,
                            { backgroundColor: colors.card },
                            (!canPlaySelected() || currentPlayerIndex !== 0) && styles.disabledBtn
                        ]}
                        onPress={handlePlayTile}
                        disabled={!canPlaySelected() || currentPlayerIndex !== 0}
                    >
                        <Text style={[styles.actionText, styles.primaryText]}>
                            Гарах {selectedTileIds.length > 0 && `(${selectedTileIds.length})`}
                        </Text>
                    </Pressable>

                    {/* <Pressable style={[styles.actionBtn, { backgroundColor: colors.card }]}>
                        <Text style={styles.actionText}>Дуудлага</Text>
                    </Pressable> */}

                    {selectedTileIds.length > 0 && (
                        <Pressable
                            style={styles.clearBtn}
                            onPress={() => setSelectedTileIds([])}
                        >
                            <Text style={styles.clearBtnText}>✕</Text>
                        </Pressable>
                    )}
                </View>

                {/* My hand */}
                <View style={styles.handWrap}>
                    <FlatList
                        horizontal
                        data={myHand}
                        keyExtractor={(t) => t.id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 12 }}
                        renderItem={({ item }) => {
                            const isSelected = selectedTileIds.includes(item.id);
                            const canSelect = canSelectTile(item);

                            return (
                                <Pressable
                                    style={[
                                        styles.handItem,
                                        isSelected && styles.handItemSelected,
                                        !canSelect && styles.handItemDisabled
                                    ]}
                                    onPress={() => handleSelectTile(item.id)}
                                    disabled={!isSelected && !canSelect}
                                >
                                    <ExpoImage
                                        source={item.image}
                                        style={[
                                            styles.handTile,
                                            !canSelect && styles.handTileDisabled
                                        ]}
                                        contentFit="contain"
                                        transition={0}
                                        cachePolicy="memory-disk"
                                    />
                                    <Text style={[
                                        styles.handLabel,
                                        !canSelect && styles.handLabelDisabled,
                                        { color: colors.text }
                                    ]} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                </Pressable>
                            );
                        }}
                    />
                </View>

                <View style={styles.playersOverlay}>
                    <PlayerScore
                        opponents={opponents}
                        showOpponentScores={!roundInProgress}
                        currentPlayerIndex={currentPlayerIndex}
                        timeLeft={timeLeft}
                    />
                </View>
            </View>
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
        </View >
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        // backgroundColor: "#dbe9ff"
    },

    gameArea: {
        flex: 1,
        position: "relative",
    },

    centerWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    playersOverlay: {
        position: "absolute",
        top: 50,
        left: 0,
        right: 0,
        zIndex: 999,
        pointerEvents: "box-none",
    },

    previousTilesRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
        gap: 4,
    },
    previousTileItem: {
        width: 48,
        height: 64,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffffaa",
        borderRadius: 8,
    },
    previousTileImage: {
        width: 44,
        height: 60,
        opacity: 0.8,
    },

    centerBoard: {
        width: 240,
        height: 320,
        borderRadius: 28,
        backgroundColor: "#ffffffcc",
        alignItems: "center",
        justifyContent: "center",
    },

    currentTilesWrap: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    centerTileContainer: {
        alignItems: "center",
        justifyContent: "center",
    },
    centerTileOverlap: {
        marginLeft: -40,
    },
    centerTile: {
        width: 120,
        height: 200
    },
    emptyText: {
        fontSize: 14,
        opacity: 0.5,
    },

    actionRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingBottom: 8,
    },
    actionBtn: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: "#ffffffaa",
    },
    primaryBtn: { backgroundColor: "#ffffff" },
    disabledBtn: { opacity: 0.5 },
    actionText: { fontWeight: "700" },
    primaryText: { color: "#d44" },

    clearBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#ff4444",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
    },
    clearBtnText: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
    },

    handWrap: { paddingVertical: 10 },
    handItem: {
        marginRight: 12,
        alignItems: "center",
        width: 84,
        padding: 4,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "transparent",
    },
    handItemSelected: {
        borderColor: "#4CAF50",
        backgroundColor: "#e8f5e9",
        transform: [{ translateY: -8 }],
    },
    handItemDisabled: {
        opacity: 0.4,
    },
    handTile: {
        width: 70,
        height: 110
    },
    handTileDisabled: {
        opacity: 0.5,
    },
    handLabel: {
        fontSize: 11,
        marginTop: 4,
        opacity: 0.75
    },
    handLabelDisabled: {
        opacity: 0.3,
    },
});