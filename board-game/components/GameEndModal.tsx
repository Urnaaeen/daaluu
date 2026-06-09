// components/GameEndModal.tsx
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { FinalScorePlayer } from "../app/trading";

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
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    {/* Ялагч зарлах */}
                    <View style={styles.winnerSection}>
                        <Text style={styles.trophy}>🏆</Text>
                        <Text style={styles.winnerTitle}>ЯЛАГЧ</Text>
                        <Text style={styles.winnerName}>{winner.name}</Text>
                        <Text style={styles.winnerScore}>
                            Оноо: {winner.finalScore}
                        </Text>
                    </View>

                    {/* Хүснэгт */}
                    <View style={styles.tableSection}>
                        <Text style={styles.tableTitle}>Эцсийн Үр Дүн</Text>
                        
                        {/* Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, styles.rankCol]}>#</Text>
                            <Text style={[styles.headerCell, styles.nameCol]}>Нэр</Text>
                            <Text style={[styles.headerCell, styles.numCol]}>Цай</Text>
                            <Text style={[styles.headerCell, styles.numCol]}>Авлага</Text>
                            <Text style={[styles.headerCell, styles.numCol]}>Өглөг</Text>
                            <Text style={[styles.headerCell, styles.numCol]}>Оноо</Text>
                        </View>

                        {/* Rows */}
                        <ScrollView style={styles.tableBody}>
                            {allScores.map((player, idx) => (
                                <View
                                    key={player.index}
                                    style={[
                                        styles.tableRow,
                                        idx === 0 && styles.winnerRow
                                    ]}
                                >
                                    <Text style={[styles.cell, styles.rankCol]}>
                                        {idx + 1}
                                    </Text>
                                    <Text style={[styles.cell, styles.nameCol]}>
                                        {player.name}
                                    </Text>
                                    <Text style={[styles.cell, styles.numCol]}>
                                        {player.tsai}
                                    </Text>
                                    <Text style={[styles.cell, styles.numCol]}>
                                        {player.avlaga}
                                    </Text>
                                    <Text style={[styles.cell, styles.numCol]}>
                                        {player.uglug}
                                    </Text>
                                    <Text style={[styles.cell, styles.numCol, styles.scoreCell]}>
                                        {player.finalScore}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Товчнууд */}
                    <View style={styles.buttonRow}>
                        <Pressable style={styles.button} onPress={onRestart}>
                            <Text style={styles.buttonText}>Дахин Тоглох</Text>
                        </Pressable>
                        <Pressable style={[styles.button, styles.exitButton]} onPress={onExit}>
                            <Text style={[styles.buttonText, styles.exitText]}>Гарах</Text>
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
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modal: {
        width: "100%",
        maxWidth: 500,
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 24,
        maxHeight: "80%",
    },
    winnerSection: {
        alignItems: "center",
        marginBottom: 24,
        paddingBottom: 24,
        borderBottomWidth: 2,
        borderBottomColor: "#FFD700",
    },
    trophy: {
        fontSize: 60,
        marginBottom: 8,
    },
    winnerTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#666",
        marginBottom: 8,
    },
    winnerName: {
        fontSize: 32,
        fontWeight: "900",
        color: "#FFD700",
        marginBottom: 8,
    },
    winnerScore: {
        fontSize: 18,
        fontWeight: "700",
        color: "#333",
    },
    tableSection: {
        marginBottom: 24,
    },
    tableTitle: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 12,
        textAlign: "center",
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f5f5f5",
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 8,
        marginBottom: 4,
    },
    headerCell: {
        fontWeight: "700",
        fontSize: 12,
        color: "#333",
        textAlign: "center",
    },
    tableBody: {
        maxHeight: 200,
    },
    tableRow: {
        flexDirection: "row",
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    winnerRow: {
        backgroundColor: "#FFF9E6",
    },
    cell: {
        fontSize: 14,
        color: "#333",
        textAlign: "center",
    },
    rankCol: {
        width: 30,
    },
    nameCol: {
        flex: 1,
        textAlign: "left",
        paddingLeft: 8,
    },
    numCol: {
        width: 50,
    },
    scoreCell: {
        fontWeight: "700",
        color: "#4CAF50",
    },
    buttonRow: {
        flexDirection: "row",
        gap: 12,
    },
    button: {
        flex: 1,
        backgroundColor: "#4CAF50",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
    },
    exitButton: {
        backgroundColor: "#666",
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    exitText: {
        color: "#fff",
    },
});