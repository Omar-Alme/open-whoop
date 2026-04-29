import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, typography } from "../theme";

interface Workout {
  durationMinutes: number;
  avgHR: number;
  peakHR: number;
}

interface Props {
  totalRecords: number;
  avgHR: number | null;
  restingHR: number | null;
  rmssd: number | null;
  stressIndex: number | null;
  strainScore: number | null;
  trimp: number | null;
  workoutCount: number;
  latestWorkout: Workout | null;
  firmware: string;
  deviceId: string | null;
  lastEventLabel: string | null;
}

const STRAIN_GOAL = 21;

export default function InsightsCard({
  totalRecords,
  avgHR,
  restingHR,
  rmssd,
  stressIndex,
  strainScore,
  trimp,
  workoutCount,
  latestWorkout,
  firmware,
  deviceId,
  lastEventLabel,
}: Props) {
  const strainPct =
    strainScore !== null ? Math.min((strainScore / STRAIN_GOAL) * 100, 100) : 0;

  return (
    <>
      {/* Strain hero block */}
      <View style={styles.card}>
        <View style={styles.strainRow}>
          <View>
            <Text style={styles.label}>Strain</Text>
            <View style={styles.strainValueRow}>
              <Text style={styles.strainValue}>
                {strainScore !== null ? strainScore.toFixed(1) : "--"}
              </Text>
              <Text style={styles.strainGoal}>/ {STRAIN_GOAL}</Text>
            </View>
            <Text style={styles.sub}>
              TRIMP {trimp !== null ? trimp : "--"} · Edwards method
            </Text>
          </View>

          <View style={styles.strainPills}>
            <Pill label="Stress" value={stressIndex !== null ? `${stressIndex}` : "--"} />
            <Pill
              label="Workouts"
              value={`${workoutCount}`}
              accent={workoutCount > 0 ? colors.lime : undefined}
            />
          </View>
        </View>

        <View style={styles.strainBar}>
          <View style={[styles.strainFill, { width: `${strainPct}%` }]} />
        </View>
        <View style={styles.strainTicks}>
          {[0, 5, 10, 15, 21].map((tick) => (
            <Text key={tick} style={styles.tick}>
              {tick}
            </Text>
          ))}
        </View>
      </View>

      {/* Workout & summary tiles */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Latest Workout</Text>
        {latestWorkout ? (
          <View style={styles.workoutRow}>
            <Stat
              big
              label="Duration"
              value={`${latestWorkout.durationMinutes.toFixed(0)}`}
              unit="min"
            />
            <Stat label="Avg HR" value={`${latestWorkout.avgHR}`} unit="bpm" />
            <Stat label="Peak HR" value={`${latestWorkout.peakHR}`} unit="bpm" />
          </View>
        ) : (
          <Text style={styles.empty}>
            No qualifying workout in this sync window.
          </Text>
        )}
      </View>

      {/* Recovery tiles */}
      <View style={styles.tileRow}>
        <View style={styles.smallCard}>
          <Text style={styles.cardLabelSm}>Avg HR</Text>
          <Text style={styles.smallValue}>{avgHR ?? "--"}</Text>
          <Text style={styles.smallUnit}>bpm · {totalRecords} samples</Text>
        </View>
        <View style={styles.smallCard}>
          <Text style={styles.cardLabelSm}>Resting</Text>
          <Text style={[styles.smallValue, { color: colors.lime }]}>
            {restingHR ?? "--"}
          </Text>
          <Text style={styles.smallUnit}>bpm · 24h low</Text>
        </View>
      </View>

      <View style={styles.tileRow}>
        <View style={styles.smallCard}>
          <Text style={styles.cardLabelSm}>RMSSD</Text>
          <Text style={[styles.smallValue, { color: colors.purple }]}>
            {rmssd ?? "--"}
          </Text>
          <Text style={styles.smallUnit}>ms · sync window</Text>
        </View>
        <View style={styles.smallCard}>
          <Text style={styles.cardLabelSm}>Stress</Text>
          <Text style={[styles.smallValue, { color: colors.amber }]}>
            {stressIndex ?? "--"}
          </Text>
          <Text style={styles.smallUnit}>Baevsky index</Text>
        </View>
      </View>

      {/* Device card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Device</Text>
        <View style={styles.deviceRow}>
          <Text style={styles.deviceLabel}>Firmware</Text>
          <Text style={styles.deviceValue}>{firmware}</Text>
        </View>
        <View style={styles.deviceRow}>
          <Text style={styles.deviceLabel}>Hardware ID</Text>
          <Text style={styles.deviceValue} numberOfLines={1}>
            {deviceId ?? "--"}
          </Text>
        </View>
        <View style={[styles.deviceRow, styles.lastDeviceRow]}>
          <Text style={styles.deviceLabel}>Last event</Text>
          <Text style={styles.deviceValue}>{lastEventLabel ?? "--"}</Text>
        </View>
      </View>
    </>
  );
}

function Pill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, accent && { color: accent }]}>{value}</Text>
    </View>
  );
}

function Stat({
  label,
  value,
  unit,
  big = false,
}: {
  label: string;
  value: string;
  unit: string;
  big?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, big && styles.statValueBig]}>{value}</Text>
        <Text style={styles.statUnit}> {unit}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
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
  label: {
    color: colors.coral,
    ...typography.label,
    marginBottom: 4,
  },
  cardLabel: {
    color: colors.textPrimary,
    ...typography.subtitle,
    marginBottom: 12,
  },
  cardLabelSm: {
    color: colors.textSecondary,
    ...typography.label,
    fontSize: 10,
    marginBottom: 8,
  },
  sub: {
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: 4,
  },
  strainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  strainValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  strainValue: {
    color: colors.textPrimary,
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  strainGoal: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 4,
  },
  strainPills: {
    flex: 1,
    alignItems: "flex-end",
    gap: 6,
    marginTop: 18,
  },
  pill: {
    backgroundColor: colors.cardRaised,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 110,
    justifyContent: "space-between",
  },
  pillLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "600",
  },
  pillValue: {
    color: colors.textPrimary,
    ...typography.caption,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  strainBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.ringTrack,
    overflow: "hidden",
  },
  strainFill: {
    height: "100%",
    backgroundColor: colors.coral,
    borderRadius: 3,
  },
  strainTicks: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  tick: {
    color: colors.textMuted,
    ...typography.caption,
    fontSize: 10,
  },
  workoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    flex: 1,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  statValueBig: {
    fontSize: 30,
    letterSpacing: -1,
  },
  statUnit: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  statLabel: {
    color: colors.textSecondary,
    ...typography.label,
    fontSize: 10,
    marginTop: 2,
  },
  empty: {
    color: colors.textSecondary,
    ...typography.body,
  },
  tileRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  smallCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 16,
  },
  smallValue: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
    marginBottom: 2,
  },
  smallUnit: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  deviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  lastDeviceRow: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  deviceLabel: {
    color: colors.textSecondary,
    ...typography.body,
  },
  deviceValue: {
    color: colors.textPrimary,
    ...typography.body,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    maxWidth: "55%",
  },
});
