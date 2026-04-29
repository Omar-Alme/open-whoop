import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, typography } from "../theme";

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
  const tiles: { label: string; value: string; unit: string; tint: string }[] = [
    {
      label: "SpO₂",
      value: spo2Percent !== null ? `${spo2Percent}` : "--",
      unit: "%",
      tint: colors.cyan,
    },
    {
      label: "Skin Temp",
      value: skinTempC !== null ? skinTempC.toFixed(1) : "--",
      unit: "°C",
      tint: colors.amber,
    },
    {
      label: "Resp Rate",
      value: respiratoryRate !== null ? `${respiratoryRate}` : "--",
      unit: "br/m",
      tint: colors.purple,
    },
    {
      label: "PPG",
      value: ppgGreen !== null ? `${ppgGreen}` : "--",
      unit: "raw",
      tint: colors.green,
    },
    {
      label: "Accel",
      value: accelMagnitude !== null ? accelMagnitude.toFixed(2) : "--",
      unit: "g",
      tint: colors.coral,
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Body Sensors</Text>
        <Text style={styles.sub}>Latest sample</Text>
      </View>

      <View style={styles.grid}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <View style={[styles.tileBar, { backgroundColor: tile.tint }]} />
            <Text style={styles.tileLabel}>{tile.label}</Text>
            <View style={styles.tileValueRow}>
              <Text style={[styles.tileValue, { color: tile.tint }]}>{tile.value}</Text>
              <Text style={styles.tileUnit}>{tile.unit}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 18,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  label: {
    color: colors.textPrimary,
    ...typography.subtitle,
  },
  sub: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tile: {
    flexBasis: "31.5%",
    flexGrow: 1,
    backgroundColor: colors.cardRaised,
    borderRadius: radii.md,
    padding: 12,
    overflow: "hidden",
    position: "relative",
  },
  tileBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radii.md,
    borderBottomLeftRadius: radii.md,
  },
  tileLabel: {
    color: colors.textSecondary,
    ...typography.label,
    fontSize: 9,
    marginBottom: 6,
  },
  tileValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  tileValue: {
    ...typography.subtitle,
    fontVariant: ["tabular-nums"],
  },
  tileUnit: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 3,
  },
});
