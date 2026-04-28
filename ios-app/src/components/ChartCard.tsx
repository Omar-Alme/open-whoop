import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

interface Props {
  /** Array of { time: seconds-ago, bpm: number } for the last 60 seconds */
  data: { time: number; bpm: number }[];
  title?: string;
  emptyLabel?: string;
  accentColor?: string;
  rangeSuffix?: string;
}

const CHART_WIDTH = Dimensions.get("window").width - 64;
const CHART_HEIGHT = 120;

/**
 * Simple rolling HR chart drawn with plain Views.
 * No external chart library needed — just colored bars/dots.
 * Shows the last 60 seconds of BPM data.
 */
export default function ChartCard({
  data,
  title = "Heart Rate - 60s",
  emptyLabel = "Waiting for data...",
  accentColor = "#FF375F",
  rangeSuffix = "bpm",
}: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={[styles.label, { color: accentColor }]}>{title}</Text>
        <View style={[styles.chartArea, styles.empty]}>
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      </View>
    );
  }

  // Find min/max for scaling
  const bpms = data.map((d) => d.bpm);
  const minBpm = Math.max(30, Math.min(...bpms) - 5);
  const maxBpm = Math.max(...bpms) + 5;
  const range = maxBpm - minBpm || 1;

  // Plot as a series of connected dots
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((d.bpm - minBpm) / range) * CHART_HEIGHT;
    return { x, y, bpm: d.bpm };
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: accentColor }]}>{title}</Text>
        <Text style={styles.rangeText}>
          {Math.min(...bpms)}-{Math.max(...bpms)} {rangeSuffix}
        </Text>
      </View>

      <View style={[styles.chartArea, { height: CHART_HEIGHT }]}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <View
            key={frac}
            style={[styles.gridLine, { top: frac * CHART_HEIGHT }]}
          />
        ))}

        {/* Data points */}
        {points.map((p, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: p.x - 2,
                top: p.y - 2,
                backgroundColor: accentColor,
              },
            ]}
          />
        ))}

        {/* Line segments connecting dots */}
        {points.length > 1 &&
          points.slice(1).map((p, i) => {
            const prev = points[i];
            const dx = p.x - prev.x;
            const dy = p.y - prev.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={`line-${i}`}
                style={[
                  styles.line,
                  {
                    left: prev.x,
                    top: prev.y,
                    width: length,
                    backgroundColor: accentColor,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}

        {/* Y-axis labels */}
        <Text style={[styles.axisLabel, { top: 0 }]}>{maxBpm}</Text>
        <Text style={[styles.axisLabel, { bottom: 0 }]}>{minBpm}</Text>
      </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    color: "#FF375F",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  rangeText: {
    color: "#8E8E93",
    fontSize: 12,
  },
  chartArea: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 8,
  },
  empty: {
    height: CHART_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
  },
  emptyText: {
    color: "#8E8E93",
    fontSize: 13,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3A3A3C",
  },
  dot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  line: {
    position: "absolute",
    height: 1.5,
  },
  axisLabel: {
    position: "absolute",
    right: 4,
    color: "#8E8E93",
    fontSize: 10,
  },
});
