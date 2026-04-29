import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { colors, radii, typography } from "../theme";

interface RingMetric {
  label: string;
  value: number | null;
  goal: number;
  color: string;
  unit?: string;
  display: string | null;
}

interface Props {
  strain: number | null;
  rmssd: number | null;
  sleepMinutes: number | null;
  headline?: string;
}

const SIZE = 180;
const STROKE = 14;
const GAP = 6;
const CENTER = SIZE / 2;

export default function HeroCard({ strain, rmssd, sleepMinutes, headline }: Props) {
  const rings: RingMetric[] = [
    {
      label: "Strain",
      value: strain,
      goal: 21,
      color: colors.coral,
      unit: "/ 21",
      display: strain !== null ? strain.toFixed(1) : null,
    },
    {
      label: "Recovery",
      value: rmssd,
      goal: 80,
      color: colors.lime,
      unit: "ms RMSSD",
      display: rmssd !== null ? `${rmssd}` : null,
    },
    {
      label: "Sleep",
      value: sleepMinutes !== null ? sleepMinutes / 60 : null,
      goal: 8,
      color: colors.cyan,
      unit: "h",
      display:
        sleepMinutes !== null
          ? `${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m`
          : null,
    },
  ];

  const computedHeadline = headline ?? deriveHeadline(strain, rmssd, sleepMinutes);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Today's Recovery</Text>
      <Text style={styles.headline}>{computedHeadline}</Text>

      <View style={styles.ringRow}>
        <View style={styles.ringWrap}>
          <Svg width={SIZE} height={SIZE}>
            <G rotation={-90} originX={CENTER} originY={CENTER}>
              {rings.map((ring, i) => {
                const r = CENTER - STROKE / 2 - i * (STROKE + GAP);
                const circumference = 2 * Math.PI * r;
                const progress =
                  ring.value !== null
                    ? Math.min(Math.max(ring.value / ring.goal, 0), 1)
                    : 0;
                const dash = circumference * progress;
                return (
                  <React.Fragment key={ring.label}>
                    <Circle
                      cx={CENTER}
                      cy={CENTER}
                      r={r}
                      stroke={colors.ringTrack}
                      strokeWidth={STROKE}
                      fill="none"
                      strokeLinecap="round"
                    />
                    <Circle
                      cx={CENTER}
                      cy={CENTER}
                      r={r}
                      stroke={ring.color}
                      strokeWidth={STROKE}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${circumference - dash}`}
                    />
                  </React.Fragment>
                );
              })}
            </G>
          </Svg>
        </View>

        <View style={styles.legendCol}>
          {rings.map((ring) => (
            <View key={ring.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: ring.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legendLabel}>{ring.label}</Text>
                <View style={styles.legendValueRow}>
                  <Text style={[styles.legendValue, { color: ring.color }]}>
                    {ring.display ?? "--"}
                  </Text>
                  {ring.unit && (
                    <Text style={styles.legendUnit}> {ring.unit}</Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function deriveHeadline(
  strain: number | null,
  rmssd: number | null,
  sleepMin: number | null
): string {
  if (strain === null && rmssd === null && sleepMin === null) {
    return "Sync to see today";
  }
  if (rmssd !== null && rmssd >= 60) return "Recovered";
  if (rmssd !== null && rmssd < 25) return "Take it easy";
  if (strain !== null && strain >= 14) return "High day";
  if (sleepMin !== null && sleepMin >= 420) return "Well rested";
  return "Tracking";
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 20,
    marginBottom: 12,
  },
  label: {
    color: colors.textSecondary,
    ...typography.label,
    marginBottom: 6,
  },
  headline: {
    color: colors.textPrimary,
    ...typography.title,
    marginBottom: 16,
  },
  ringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  ringWrap: {
    width: SIZE,
    height: SIZE,
  },
  legendCol: {
    flex: 1,
    gap: 14,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendLabel: {
    color: colors.textSecondary,
    ...typography.label,
    fontSize: 10,
    marginBottom: 2,
  },
  legendValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  legendValue: {
    ...typography.metricSm,
    fontVariant: ["tabular-nums"],
  },
  legendUnit: {
    color: colors.textSecondary,
    ...typography.caption,
    marginLeft: 2,
  },
});
