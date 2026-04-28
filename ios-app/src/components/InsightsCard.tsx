import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  totalRecords: number;
  avgHR: number | null;
  restingHR: number | null;
  rmssd: number | null;
  stressIndex: number | null;
  strainScore: number | null;
  trimp: number | null;
  workoutCount: number;
  latestWorkout: {
    durationMinutes: number;
    avgHR: number;
    peakHR: number;
  } | null;
  firmware: string;
  deviceId: string | null;
  lastEventLabel: string | null;
}

export default function InsightsCard({
  totalRecords,
  avgHR,
  restingHR,
  rmssd,
  stressIndex,
  strainScore,
  trimp,
  workoutCount,
  latestWorkout,
  firmware,
  deviceId,
  lastEventLabel,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Sync Insights</Text>

      <MetricRow label="Synced Records" value={`${totalRecords}`} />
      <MetricRow label="Average HR" value={avgHR !== null ? `${avgHR} bpm` : "--"} />
      <MetricRow label="Resting HR" value={restingHR !== null ? `${restingHR} bpm` : "--"} />
      <MetricRow label="RMSSD" value={rmssd !== null ? `${rmssd} ms` : "--"} />
      <MetricRow label="Stress Index" value={stressIndex !== null ? `${stressIndex}` : "--"} />
      <MetricRow label="Strain" value={strainScore !== null ? `${strainScore} / 21` : "--"} />
      <MetricRow label="TRIMP" value={trimp !== null ? `${trimp}` : "--"} />
      <MetricRow label="Workouts" value={`${workoutCount}`} />
      <MetricRow
        label="Latest Workout"
        value={
          latestWorkout
            ? `${latestWorkout.durationMinutes.toFixed(0)} min • ${latestWorkout.avgHR}/${latestWorkout.peakHR} bpm`
            : "--"
        }
      />
      <MetricRow label="Firmware" value={firmware} />
      <MetricRow label="Device ID" value={deviceId ?? "--"} />
      <MetricRow label="Last Strap Event" value={lastEventLabel ?? "--"} isLast />
    </View>
  );
}

function MetricRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, isLast && styles.lastRow]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    color: "#FF9F0A",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
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
  rowLabel: {
    color: "#8E8E93",
    fontSize: 14,
    maxWidth: "45%",
  },
  rowValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    maxWidth: "55%",
  },
});
