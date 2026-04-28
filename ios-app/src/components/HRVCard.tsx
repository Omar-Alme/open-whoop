import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface Props {
  /** Last N raw RR intervals in ms */
  rrIntervals: number[];
  /** Computed RMSSD value in ms */
  rmssd: number | null;
  /** Sensor contact status */
  sensorContact: string;
  /** Energy expended in kJ, if available */
  energyExpended: number | null;
}

export default function HRVCard({ rrIntervals, rmssd, sensorContact, energyExpended }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>HRV / Data Quality</Text>

      {/* RMSSD */}
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>RMSSD</Text>
        <Text style={styles.metricValue}>
          {rmssd !== null ? `${rmssd} ms` : "--"}
        </Text>
      </View>

      {/* Sensor contact */}
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>Sensor</Text>
        <Text
          style={[
            styles.metricValue,
            {
              color:
                sensorContact === "supported-contact"
                  ? "#4CD964"
                  : sensorContact === "supported-no-contact"
                  ? "#FF9500"
                  : "#8E8E93",
            },
          ]}
        >
          {sensorContact === "supported-contact"
            ? "On Wrist"
            : sensorContact === "supported-no-contact"
            ? "No Contact"
            : "Unknown"}
        </Text>
      </View>

      {/* Energy expended */}
      {energyExpended !== null && (
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Energy</Text>
          <Text style={styles.metricValue}>{energyExpended} kJ</Text>
        </View>
      )}

      {/* RR intervals */}
      <Text style={styles.subLabel}>Recent RR Intervals (ms)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rrScroll}>
        {rrIntervals.length === 0 ? (
          <Text style={styles.rrEmpty}>Waiting for RR data...</Text>
        ) : (
          rrIntervals.map((rr, i) => (
            <View key={i} style={styles.rrPill}>
              <Text style={styles.rrText}>{rr}</Text>
            </View>
          ))
        )}
      </ScrollView>
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
    color: "#5AC8FA",
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
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3A3A3C",
  },
  metricLabel: {
    color: "#8E8E93",
    fontSize: 14,
  },
  metricValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  subLabel: {
    color: "#8E8E93",
    fontSize: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  rrScroll: {
    flexDirection: "row",
  },
  rrPill: {
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  rrText: {
    color: "#5AC8FA",
    fontSize: 14,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  rrEmpty: {
    color: "#8E8E93",
    fontSize: 13,
  },
});
