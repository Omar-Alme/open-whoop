import React, { useMemo, useState } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { colors, radii, typography } from "../theme";

interface Sample {
  time: number;
  bpm: number;
}

interface Props {
  liveData: Sample[];
  historicalData: Sample[];
  restingHR?: number | null;
  peakHR?: number | null;
  rmssd?: number | null;
}

type Range = "1H" | "1D" | "1W";
const RANGES: Range[] = ["1H", "1D", "1W"];

const CHART_WIDTH = Dimensions.get("window").width - 64;
const CHART_HEIGHT = 130;

export default function HeartRateChart({
  liveData,
  historicalData,
  restingHR,
  peakHR,
  rmssd,
}: Props) {
  const [range, setRange] = useState<Range>("1H");

  const data = useMemo(() => {
    if (range === "1H") return liveData;
    return historicalData;
  }, [range, liveData, historicalData]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const bpms = data.map((d) => d.bpm);
    return {
      min: Math.min(...bpms),
      max: Math.max(...bpms),
      avg: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
    };
  }, [data]);

  const path = useMemo(() => buildPath(data, CHART_WIDTH, CHART_HEIGHT), [data]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBubble}>
            <View style={styles.heartDot} />
          </View>
          <View>
            <Text style={styles.label}>Heart Rate</Text>
            <Text style={styles.subValue}>
              {stats ? `${stats.avg}` : "--"} <Text style={styles.subUnit}>bpm avg</Text>
            </Text>
          </View>
        </View>

        <View style={styles.toggleRow}>
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRange(r)}
              style={[styles.toggle, range === r && styles.toggleActive]}
            >
              <Text
                style={[
                  styles.toggleText,
                  range === r && styles.toggleTextActive,
                ]}
              >
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.chartWrap}>
        {data.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {range === "1H" ? "Waiting for live HR…" : "Sync historical data"}
            </Text>
          </View>
        ) : (
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.coral} stopOpacity="0.45" />
                <Stop offset="1" stopColor={colors.coral} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d={path.fill} fill="url(#hrFill)" />
            <Path
              d={path.stroke}
              fill="none"
              stroke={colors.coral}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {path.lastPoint && (
              <>
                <Circle
                  cx={path.lastPoint.x}
                  cy={path.lastPoint.y}
                  r={6}
                  fill={colors.coral}
                  fillOpacity={0.25}
                />
                <Circle
                  cx={path.lastPoint.x}
                  cy={path.lastPoint.y}
                  r={3}
                  fill={colors.coral}
                />
              </>
            )}
          </Svg>
        )}
      </View>

      <View style={styles.statRow}>
        <Stat label="Resting" value={restingHR !== null && restingHR !== undefined ? `${restingHR}` : "--"} />
        <Stat label="Peak" value={peakHR !== null && peakHR !== undefined ? `${peakHR}` : stats ? `${stats.max}` : "--"} />
        <Stat label="Variability" value={rmssd !== null && rmssd !== undefined ? `${rmssd}ms` : "--"} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function buildPath(data: Sample[], width: number, height: number) {
  if (data.length === 0) return { stroke: "", fill: "", lastPoint: null };

  const bpms = data.map((d) => d.bpm);
  const min = Math.max(30, Math.min(...bpms) - 5);
  const max = Math.max(...bpms) + 5;
  const range = max - min || 1;
  const padX = 6;

  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * (width - padX * 2);
    const y = height - 8 - ((d.bpm - min) / range) * (height - 16);
    return { x, y };
  });

  let stroke = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    stroke += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const fill =
    stroke +
    ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return { stroke, fill, lastPoint: points[points.length - 1] };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 18,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3A1A1F",
    alignItems: "center",
    justifyContent: "center",
  },
  heartDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.coral,
  },
  label: {
    color: colors.textSecondary,
    ...typography.label,
    fontSize: 10,
    marginBottom: 2,
  },
  subValue: {
    color: colors.textPrimary,
    ...typography.subtitle,
    fontVariant: ["tabular-nums"],
  },
  subUnit: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: radii.pill,
    padding: 3,
  },
  toggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  toggleActive: {
    backgroundColor: colors.cardRaised,
  },
  toggleText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: colors.textPrimary,
  },
  chartWrap: {
    height: CHART_HEIGHT,
    marginBottom: 14,
  },
  empty: {
    height: CHART_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    borderRadius: radii.md,
  },
  emptyText: {
    color: colors.textSecondary,
    ...typography.body,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: colors.textPrimary,
    ...typography.subtitle,
    fontVariant: ["tabular-nums"],
    marginBottom: 2,
  },
  statLabel: {
    color: colors.textSecondary,
    ...typography.label,
    fontSize: 10,
  },
});
