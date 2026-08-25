// components/GameEndModal.tsx
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { FinalScorePlayer } from "../app/trading";
import { useTheme } from "../context/ThemeContext";
import { AVATAR_COLORS, MONO, PALETTE } from "../theme/colors";
import Avatar from "./ui/Avatar";
import PushButton from "./ui/PushButton";

type GameEndModalProps = {
    visible: boolean;
    winner: FinalScorePlayer;
    allScores: FinalScorePlayer[];
    onRestart: () => void;
    onExit: () => void;
};

export default function GameEndModal({
    visible,
    winner,
    allScores,
    onRestart,
    onExit
}: GameEndModalProps) {
    const { colors } = useTheme();

    // Хаалттай үед DOM-д үлдэхгүйн тулд бүрмөсөн салгана (RN Web)
    if (!visible) return null;

    return (
        <Modal
            visible
            transparent
            animationType="fade"
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* Ялагч зарлах */}
                    <View style={styles.banner}>
                        <Text style={styles.bannerLabel}>ТОГЛООМ ДУУСЛАА</Text>
                        <Text style={styles.bannerName}>{winner.name} яллаа</Text>
                        <Text style={styles.bannerScore}>{winner.finalScore} оноо авав</Text>
                    </View>

                    {/* Байрын жагсаалт */}
                    <View style={[styles.table, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ScrollView style={styles.tableBody}>
                            {allScores.map((player, idx) => (
                                <View
                                    key={player.index ?? idx}
                                    style={[
                                        styles.row,
                                        idx === 0 && styles.winnerRow
                                    ]}
                                >
                                    <Text style={[styles.place, { color: colors.muted }]}>{idx + 1}</Text>
                                    <Avatar
                                        label={(player.name?.trim()?.[0] ?? "?").toUpperCase()}
                                        color={AVATAR_COLORS[(player.index ?? idx) % 5]}
                                        size={38}
                                        radius={12}
                                        fontSize={14}
                                    />
                                    <View style={styles.rowBody}>
                                        <Text
                                            style={[styles.rowName, { color: idx === 0 ? "#2B2D31" : colors.text }]}
                                            numberOfLines={1}
                                        >
                                            {player.name}
                                        </Text>
                                        <Text
                                            style={[styles.rowDetail, { color: idx === 0 ? PALETTE.gold : colors.muted }]}
                                        >
                                            {player.tsai} цай · {player.avlaga} авлага · {player.uglug} өглөг
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.rowScore,
                                            { color: idx === 0 ? PALETTE.gold : colors.text }
                                        ]}
                                    >
                                        {player.finalScore}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Товчнууд */}
                    <View style={styles.buttons}>
                        <PushButton
                            label="Дахин тоглох"
                            color={colors.accent}
                            shadowColor={colors.accentDark}
                            onPress={onRestart}
                            textStyle={{ fontSize: 17 }}
                        />
                        <Pressable
                            onPress={onExit}
                            style={({ pressed }) => [
                                styles.exitBtn,
                                { borderColor: "rgba(255,255,255,0.35)" },
                                pressed && { transform: [{ translateY: 2 }] },
                            ]}
                        >
                            <Text style={styles.exitText}>Үндсэн цэс</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(8,20,16,0.7)",
        justifyContent: "center",
        padding: 18,
    },
    content: {
        width: "100%",
        maxWidth: 420,
        alignSelf: "center",
        gap: 14,
    },
    banner: {
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 22,
        backgroundColor: PALETTE.goldSoft,
    },
    bannerLabel: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.2,
        color: PALETTE.gold,
    },
    bannerName: {
        fontSize: 28,
        fontWeight: "900",
        color: "#2B2D31",
        marginTop: 4,
        textAlign: "center",
    },
    bannerScore: {
        fontSize: 13,
        fontWeight: "700",
        color: PALETTE.gold,
        marginTop: 2,
    },
    table: {
        borderRadius: 22,
        borderWidth: 2,
        padding: 8,
    },
    tableBody: {
        maxHeight: 330,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 16,
    },
    winnerRow: {
        backgroundColor: PALETTE.goldSoft,
    },
    place: {
        width: 22,
        fontSize: 15,
        fontFamily: MONO,
        textAlign: "center",
    },
    rowBody: {
        flex: 1,
        minWidth: 0,
    },
    rowName: {
        fontSize: 15,
        fontWeight: "800",
    },
    rowDetail: {
        fontSize: 11,
        fontWeight: "600",
        marginTop: 1,
    },
    rowScore: {
        fontSize: 20,
        fontFamily: MONO,
    },
    buttons: {
        gap: 10,
    },
    exitBtn: {
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 2,
        alignItems: "center",
    },
    exitText: {
        fontSize: 15,
        fontWeight: "800",
        color: "rgba(255,255,255,0.85)",
    },
});
