import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

interface Props {
  bpm: number | null;
  sensorContact: string;
}

export default function HRCard({ bpm, sensorContact }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation — scales up and down with each new BPM reading
  useEffect(() => {
    if (bpm && bpm > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [bpm]);

  const contactLabel =
    sensorContact === "supported-contact"
      ? "On Wrist"
      : sensorContact === "supported-no-contact"
      ? "Searching..."
      : "Unknown";

  const contactColor =
    sensorContact === "supported-contact" ? "#4CD964" : "#FF9500";

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Heart Rate</Text>

      <Animated.View style={[styles.bpmContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.bpm}>{bpm ?? "--"}</Text>
        <Text style={styles.unit}>BPM</Text>
      </Animated.View>

      <View style={styles.contactRow}>
        <View style={[styles.contactDot, { backgroundColor: contactColor }]} />
        <Text style={[styles.contactText, { color: contactColor }]}>
          {contactLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: "center",
  },
  label: {
    color: "#FF375F",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  bpmContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  bpm: {
    color: "#fff",
    fontSize: 72,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  unit: {
    color: "#8E8E93",
    fontSize: 20,
    fontWeight: "500",
    marginLeft: 6,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  contactText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
