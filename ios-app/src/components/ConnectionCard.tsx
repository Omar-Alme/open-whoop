import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import type { ConnectionState } from "../ble/BLEManager";

interface Props {
  state: ConnectionState;
  deviceName: string | null;
  rssi: number | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

const STATE_LABELS: Record<ConnectionState, string> = {
  idle: "Not Connected",
  scanning: "Scanning...",
  connecting: "Connecting...",
  connected: "Connected",
  disconnected: "Disconnected",
};

const STATE_COLORS: Record<ConnectionState, string> = {
  idle: "#666",
  scanning: "#F5A623",
  connecting: "#F5A623",
  connected: "#4CD964",
  disconnected: "#FF3B30",
};

export default function ConnectionCard({ state, deviceName, rssi, onConnect, onDisconnect }: Props) {
  const isLoading = state === "scanning" || state === "connecting";
  const isConnected = state === "connected";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: STATE_COLORS[state] }]} />
        <Text style={styles.title}>{STATE_LABELS[state]}</Text>
        {isLoading && <ActivityIndicator size="small" color="#F5A623" style={{ marginLeft: 8 }} />}
      </View>

      {deviceName && (
        <Text style={styles.detail}>{deviceName}</Text>
      )}
      {rssi !== null && isConnected && (
        <Text style={styles.detail}>Signal: {rssi} dBm</Text>
      )}

      <TouchableOpacity
        style={[styles.button, isConnected ? styles.buttonDisconnect : styles.buttonConnect]}
        onPress={isConnected ? onDisconnect : onConnect}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isConnected ? "Disconnect" : isLoading ? "..." : "Connect"}
        </Text>
      </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  detail: {
    color: "#8E8E93",
    fontSize: 13,
    marginBottom: 2,
  },
  button: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonConnect: {
    backgroundColor: "#0A84FF",
  },
  buttonDisconnect: {
    backgroundColor: "#FF3B30",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
