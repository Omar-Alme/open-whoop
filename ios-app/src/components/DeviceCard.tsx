import React from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { colors, radii, typography } from "../theme";

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
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Sync &amp; Apple Health</Text>
          <Text style={styles.sub}>
            Pulls historical data and mirrors supported metrics to HealthKit.
          </Text>
        </View>

        {battery !== null && (
          <View style={styles.batteryWrap}>
            <View style={styles.batteryBody}>
              <View
                style={[
                  styles.batteryFill,
                  {
                    width: `${battery}%`,
                    backgroundColor: battery > 20 ? colors.lime : colors.coral,
                  },
                ]}
              />
            </View>
            <Text style={styles.batteryText}>{battery}%</Text>
          </View>
        )}
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleLabelCol}>
          <Text style={styles.toggleLabel}>Apple Health Sync</Text>
          <Text style={styles.toggleSub}>
            HR, HRV, SpO₂, temp, respiratory, workouts, sleep
          </Text>
        </View>
        <Switch
          value={healthKitEnabled}
          onValueChange={onToggleHealthKit}
          trackColor={{ false: colors.ringTrack, true: colors.lime }}
          thumbColor="#fff"
          ios_backgroundColor={colors.ringTrack}
        />
      </View>

      <TouchableOpacity
        style={[styles.syncButton, !isConnected && styles.syncButtonDisabled]}
        onPress={onStartSync}
        disabled={!isConnected}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.syncButtonText,
            !isConnected && styles.syncButtonTextDisabled,
          ]}
        >
          {isConnected ? "Sync Historical Data" : "Connect band to sync"}
        </Text>
      </TouchableOpacity>

      {syncStatus && <Text style={styles.status}>{syncStatus}</Text>}
      {healthSyncStatus && (
        <Text style={[styles.status, styles.healthStatus]}>{healthSyncStatus}</Text>
      )}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  label: {
    color: colors.textPrimary,
    ...typography.subtitle,
    marginBottom: 2,
  },
  sub: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  batteryWrap: {
    alignItems: "center",
    marginLeft: 12,
  },
  batteryBody: {
    width: 44,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    overflow: "hidden",
    padding: 1,
  },
  batteryFill: {
    height: "100%",
    borderRadius: 1.5,
  },
  batteryText: {
    color: colors.textPrimary,
    ...typography.caption,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    marginBottom: 14,
  },
  toggleLabelCol: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    color: colors.textPrimary,
    ...typography.body,
    fontWeight: "700",
    marginBottom: 2,
  },
  toggleSub: {
    color: colors.textSecondary,
    ...typography.caption,
    lineHeight: 16,
  },
  syncButton: {
    backgroundColor: colors.lime,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  syncButtonDisabled: {
    backgroundColor: colors.cardRaised,
  },
  syncButtonText: {
    color: colors.limeText,
    ...typography.subtitle,
    fontWeight: "800",
  },
  syncButtonTextDisabled: {
    color: colors.textSecondary,
  },
  status: {
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 16,
  },
  healthStatus: {
    color: colors.lime,
    marginTop: 4,
  },
});
