import React from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity } from "react-native";

interface Props {
  battery: number | null;
  healthKitEnabled: boolean;
  onToggleHealthKit: (enabled: boolean) => void;
  syncStatus: string | null;
  healthSyncStatus: string | null;
  onStartSync: () => void;
  isConnected: boolean;
}

export default function DeviceCard({
  battery,
  healthKitEnabled,
  onToggleHealthKit,
  syncStatus,
  healthSyncStatus,
  onStartSync,
  isConnected,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Device</Text>

      {/* Battery */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Battery</Text>
        <View style={styles.batteryContainer}>
          {battery !== null && (
            <View style={styles.batteryBar}>
              <View
                style={[
                  styles.batteryFill,
                  {
                    width: `${battery}%`,
                    backgroundColor: battery > 20 ? "#4CD964" : "#FF3B30",
                  },
                ]}
              />
            </View>
          )}
          <Text style={styles.rowValue}>
            {battery !== null ? `${battery}%` : "--"}
          </Text>
        </View>
      </View>

      {/* HealthKit toggle */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Apple Health</Text>
        <Switch
          value={healthKitEnabled}
          onValueChange={onToggleHealthKit}
          trackColor={{ false: "#3A3A3C", true: "#4CD964" }}
          thumbColor="#fff"
        />
      </View>

      {/* Sync button */}
      <TouchableOpacity
        style={[styles.syncButton, !isConnected && styles.syncButtonDisabled]}
        onPress={onStartSync}
        disabled={!isConnected}
      >
        <Text style={styles.syncButtonText}>Sync Historical Data</Text>
      </TouchableOpacity>

      {syncStatus && (
        <Text style={styles.syncStatus}>{syncStatus}</Text>
      )}

      {healthSyncStatus && (
        <Text style={styles.healthStatus}>{healthSyncStatus}</Text>
      )}
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
    color: "#FFD60A",
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3A3A3C",
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
    marginLeft: 8,
  },
  batteryContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  batteryBar: {
    width: 40,
    height: 14,
    borderRadius: 3,
    backgroundColor: "#3A3A3C",
    overflow: "hidden",
  },
  batteryFill: {
    height: "100%",
    borderRadius: 3,
  },
  syncButton: {
    marginTop: 14,
    backgroundColor: "#0A84FF",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  syncButtonDisabled: {
    backgroundColor: "#3A3A3C",
  },
  syncButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  syncStatus: {
    color: "#8E8E93",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  healthStatus: {
    color: "#4CD964",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
  },
});
