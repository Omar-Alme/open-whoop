import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, radii, typography } from "../theme";

interface Props {
  bpm: number | null;
  rmssd: number | null;
  sensorContact: string;
  rrIntervals: number[];
}

export default function HighlightPair({ bpm, rmssd, sensorContact, rrIntervals }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (bpm && bpm > 0) {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 90, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [bpm]);

  const onWrist = sensorContact === "supported-contact";

  const recent = rrIntervals.slice(-7);
  const rrMin = recent.length > 0 ? Math.min(...recent) : 0;
  const rrMax = recent.length > 0 ? Math.max(...recent) : 1;
  const rrRange = Math.max(rrMax - rrMin, 1);

  return (
    <View style={styles.row}>
      {/* Live HR — lime green hero tile */}
      <Animated.View style={[styles.hrCard, { transform: [{ scale: pulse }] }]}>
        <View style={styles.hrTopRow}>
          <Text style={styles.hrLabel}>LIVE HR</Text>
          <View style={styles.hrIcon}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Circle cx={12} cy={12} r={5} fill={colors.limeText} />
            </Svg>
          </View>
        </View>
        <View style={styles.hrValueRow}>
          <Text style={styles.hrValue}>{bpm ?? "--"}</Text>
          <Text style={styles.hrUnit}>bpm</Text>
        </View>
        <View style={styles.hrFootRow}>
          <View
            style={[
              styles.contactDot,
              { backgroundColor: onWrist ? colors.limeText : "#5A4F0A" },
            ]}
          />
          <Text style={styles.hrFootText}>
            {onWrist ? "On wrist" : sensorContact === "supported-no-contact" ? "Searching" : "Connecting"}
          </Text>
        </View>
      </Animated.View>

      {/* HRV tile */}
      <View style={styles.hrvCard}>
        <Text style={styles.hrvLabel}>HRV</Text>
        <View style={styles.hrvValueRow}>
          <Text style={styles.hrvValue}>{rmssd ?? "--"}</Text>
          <Text style={styles.hrvUnit}>ms</Text>
        </View>
        <Text style={styles.hrvSub}>RMSSD live</Text>

        <View style={styles.rrBars}>
          {recent.length === 0 ? (
            <Text style={styles.rrEmpty}>No RR yet</Text>
          ) : (
            recent.map((rr, i) => {
              const heightPct = ((rr - rrMin) / rrRange) * 0.85 + 0.15;
              return (
                <View
                  key={i}
                  style={[
                    styles.rrBar,
                    {
                      height: `${heightPct * 100}%`,
                      opacity: 0.45 + (i / recent.length) * 0.55,
                    },
                  ]}
                />
              );
            })
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  hrCard: {
    flex: 1.4,
    backgroundColor: colors.lime,
    borderRadius: radii.xl,
    padding: 18,
    height: 170,
    justifyContent: "space-between",
  },
  hrTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hrLabel: {
    color: colors.limeText,
    ...typography.label,
    fontWeight: "800",
  },
  hrIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  hrValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  hrValue: {
    color: colors.limeText,
    fontSize: 64,
    fontWeight: "800",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  hrUnit: {
    color: colors.limeText,
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 4,
    opacity: 0.7,
  },
  hrFootRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  hrFootText: {
    color: colors.limeText,
    ...typography.caption,
    fontWeight: "700",
    opacity: 0.85,
  },
  hrvCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 16,
    height: 170,
    justifyContent: "space-between",
  },
  hrvLabel: {
    color: colors.purple,
    ...typography.label,
  },
  hrvValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
  },
  hrvValue: {
    color: colors.textPrimary,
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  hrvUnit: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  hrvSub: {
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: -2,
  },
  rrBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 28,
  },
  rrBar: {
    flex: 1,
    backgroundColor: colors.purple,
    borderRadius: 2,
  },
  rrEmpty: {
    color: colors.textMuted,
    ...typography.caption,
  },
});
