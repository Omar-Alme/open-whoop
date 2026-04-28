import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  latestSleep: {
    startTs: number;
    endTs: number;
    durationMinutes: number;
    avgHR: number;
  } | null;
  totalSessions: number;
}

export default function SleepCard({ latestSleep, totalSessions }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Sleep Detection</Text>

      {latestSleep ? (
        <>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Last Session</Text>
            <Text style={styles.metricValue}>{formatDateRange(latestSleep.startTs, latestSleep.endTs)}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>{formatDuration(latestSleep.durationMinutes)}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Average HR</Text>
            <Text style={styles.metricValue}>{latestSleep.avgHR} bpm</Text>
          </View>
          <View style={[styles.metricRow, styles.lastRow]}>
            <Text style={styles.metricLabel}>Detected Sessions</Text>
            <Text style={styles.metricValue}>{totalSessions}</Text>
          </View>
        </>
      ) : (
        <Text style={styles.emptyText}>
          No qualifying sleep window found in the current sync yet.
        </Text>
      )}
    </View>
  );
}

function formatDateRange(startTs: number, endTs: number) {
  const start = new Date(startTs * 1000);
  const end = new Date(endTs * 1000);
  return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    color: "#BF5AF2",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3A3A3C",
  },
  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  metricLabel: {
    color: "#8E8E93",
    fontSize: 14,
  },
  metricValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    maxWidth: "60%",
  },
  emptyText: {
    color: "#8E8E93",
    fontSize: 13,
    lineHeight: 18,
  },
});
