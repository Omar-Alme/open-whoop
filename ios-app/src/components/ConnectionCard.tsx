import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { ConnectionState } from "../ble/BLEManager";
import { colors, radii, typography } from "../theme";

interface Props {
  state: ConnectionState;
  deviceName: string | null;
  rssi: number | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function ConnectionCard({
  state,
  deviceName,
  onConnect,
  onDisconnect,
}: Props) {
  const isLoading = state === "scanning" || state === "connecting";
  const isConnected = state === "connected";

  if (isConnected) {
    return (
      <View style={[styles.card, styles.cardConnected]}>
        <View style={styles.row}>
          <View style={styles.dotConnected} />
          <View style={{ flex: 1 }}>
            <Text style={styles.titleConnected}>Connected</Text>
            <Text style={styles.subConnected}>{deviceName ?? "WHOOP"}</Text>
          </View>
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={onDisconnect}
            activeOpacity={0.85}
          >
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {isLoading ? (state === "scanning" ? "Scanning…" : "Connecting…") : "Connect your WHOOP"}
          </Text>
          <Text style={styles.sub}>
            {isLoading
              ? "Make sure the band is on your wrist."
              : "Wear the band, then tap connect."}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.lime} />
        ) : (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={onConnect}
            activeOpacity={0.85}
          >
            <Text style={styles.connectText}>Connect</Text>
          </TouchableOpacity>
        )}
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
  cardConnected: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(200,255,61,0.15)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  dotConnected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.lime,
    marginRight: 12,
    shadowColor: colors.lime,
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  titleConnected: {
    color: colors.textPrimary,
    ...typography.subtitle,
  },
  subConnected: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  title: {
    color: colors.textPrimary,
    ...typography.subtitle,
    marginBottom: 2,
  },
  sub: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  connectButton: {
    backgroundColor: colors.lime,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  connectText: {
    color: colors.limeText,
    fontWeight: "800",
    fontSize: 14,
  },
  disconnectButton: {
    backgroundColor: colors.cardRaised,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  disconnectText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 13,
  },
});
