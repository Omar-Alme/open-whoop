import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, typography } from "../theme";

interface SleepSummary {
  startTs: number;
  endTs: number;
  durationMinutes: number;
  avgHR: number;
}

interface Props {
  latestSleep: SleepSummary | null;
  totalSessions: number;
}

const SLEEP_GOAL_MIN = 480;

export default function SleepCard({ latestSleep, totalSessions }: Props) {
  if (!latestSleep) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Sleep</Text>
        <Text style={styles.empty}>
          No sleep window detected yet. Wear the band overnight, then sync.
        </Text>
      </View>
    );
  }

  const score = Math.min(
    Math.round((latestSleep.durationMinutes / SLEEP_GOAL_MIN) * 100),
    100
  );
  const hours = Math.floor(latestSleep.durationMinutes / 60);
  const minutes = latestSleep.durationMinutes % 60;
  const start = new Date(latestSleep.startTs * 1000);
  const end = new Date(latestSleep.endTs * 1000);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.label}>Sleep</Text>
          <View style={styles.durationRow}>
            <Text style={styles.duration}>{hours}h</Text>
            <Text style={styles.durationMin}>{minutes}m</Text>
          </View>
          <Text style={styles.range}>
            {fmtTime(start)} – {fmtTime(end)}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.score}>{score}</Text>
          <View style={styles.scoreBar}>
            <View
              style={[
                styles.scoreFill,
                { width: `${score}%`, backgroundColor: scoreColor(score) },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.footRow}>
        <Foot label="Avg HR" value={`${latestSleep.avgHR}`} unit="bpm" />
        <Foot label="Sessions" value={`${totalSessions}`} unit="" />
        <Foot
          label="Goal"
          value={`${Math.round((latestSleep.durationMinutes / SLEEP_GOAL_MIN) * 100)}`}
          unit="%"
        />
      </View>
    </View>
  );
}

function Foot({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.foot}>
      <View style={styles.footValueRow}>
        <Text style={styles.footValue}>{value}</Text>
        {unit && <Text style={styles.footUnit}> {unit}</Text>}
      </View>
      <Text style={styles.footLabel}>{label}</Text>
    </View>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return colors.lime;
  if (score >= 60) return colors.cyan;
  if (score >= 40) return colors.amber;
  return colors.coral;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 18,
    marginBottom: 12,
  },
  label: {
    color: colors.purple,
    ...typography.label,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  left: {
    flex: 1.2,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  duration: {
    color: colors.textPrimary,
    fontSize: 44,
    fontWeight: "700",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  durationMin: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginLeft: 4,
    fontVariant: ["tabular-nums"],
  },
  range: {
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: 2,
  },
  right: {
    flex: 1,
    alignItems: "flex-end",
  },
  scoreLabel: {
    color: colors.textSecondary,
    ...typography.label,
    fontSize: 10,
  },
  score: {
    color: colors.purple,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    lineHeight: 44,
  },
  scoreBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ringTrack,
    marginTop: 4,
    overflow: "hidden",
  },
  scoreFill: {
    height: "100%",
    borderRadius: 2,
  },
  empty: {
    color: colors.textSecondary,
    ...typography.body,
    lineHeight: 20,
  },
  footRow: {
    flexDirection: "row",
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  foot: {
    flex: 1,
    alignItems: "center",
  },
  footValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  footValue: {
    color: colors.textPrimary,
    ...typography.subtitle,
    fontVariant: ["tabular-nums"],
  },
  footUnit: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  footLabel: {
    color: colors.textSecondary,
    ...typography.label,
    fontSize: 10,
    marginTop: 2,
  },
});
