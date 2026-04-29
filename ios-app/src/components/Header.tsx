import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, typography } from "../theme";
import type { ConnectionState } from "../ble/BLEManager";

interface Props {
  greeting: string;
  state: ConnectionState;
  battery: number | null;
}

const STATE_PILL: Record<ConnectionState, { label: string; tint: string; bg: string }> = {
  idle: { label: "Disconnected", tint: colors.textSecondary, bg: colors.pill },
  scanning: { label: "Scanning", tint: colors.amber, bg: "#3A2F0F" },
  connecting: { label: "Connecting", tint: colors.amber, bg: "#3A2F0F" },
  connected: { label: "Live", tint: colors.limeText, bg: colors.lime },
  disconnected: { label: "Disconnected", tint: colors.textSecondary, bg: colors.pill },
};

function getDateString(): string {
  return new Date()
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}

export default function Header({ greeting, state, battery }: Props) {
  const pill = STATE_PILL[state];
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.leftCol}>
          <Text style={styles.date}>{getDateString()}</Text>
          <Text style={styles.greeting}>{greeting}</Text>
        </View>
        <View style={styles.rightCol}>
          {battery !== null && (
            <View style={styles.batteryPill}>
              <View style={styles.batteryDot} />
              <Text style={styles.batteryText}>{battery}%</Text>
            </View>
          )}
          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            {state === "connected" && <View style={styles.liveDot} />}
            <Text style={[styles.pillText, { color: pill.tint }]}>{pill.label}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  date: {
    color: colors.textSecondary,
    ...typography.label,
    marginBottom: 4,
  },
  greeting: {
    color: colors.textPrimary,
    ...typography.title,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pillText: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.limeText,
    marginRight: 5,
  },
  batteryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.pill,
  },
  batteryText: {
    color: colors.textPrimary,
    ...typography.caption,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  batteryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
    marginRight: 5,
  },
});
