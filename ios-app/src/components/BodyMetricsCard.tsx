import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  spo2Percent: number | null;
  skinTempC: number | null;
  respiratoryRate: number | null;
  ppgGreen: number | null;
  accelMagnitude: number | null;
}

export default function BodyMetricsCard({
  spo2Percent,
  skinTempC,
  respiratoryRate,
  ppgGreen,
  accelMagnitude,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Historical Body Metrics</Text>

      <MetricRow label="SpO2" value={spo2Percent !== null ? `${spo2Percent}%` : "--"} />
      <MetricRow
        label="Skin Temp"
        value={skinTempC !== null ? `${skinTempC.toFixed(1)} °C` : "--"}
      />
      <MetricRow
        label="Resp Rate"
        value={respiratoryRate !== null ? `${respiratoryRate} br/min` : "--"}
      />
      <MetricRow label="PPG Green" value={ppgGreen !== null ? `${ppgGreen}` : "--"} />
      <MetricRow
        label="Accel Magnitude"
        value={accelMagnitude !== null ? `${accelMagnitude} g` : "--"}
        isLast
      />
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
    color: "#32D74B",
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
  },
  rowValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
