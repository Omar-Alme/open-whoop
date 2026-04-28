import { detectSleep, type SleepSession } from "./SleepDetector";
import type { HistoricalRecord, StrapEvent, WhoopHelloInfo } from "../protocol/WhoopProtocol";
import { computeRMSSD } from "../ble/HRParser";

const DEFAULT_MAX_HR = 190;
const DEFAULT_RESTING_HR = 60;
const MAX_RECORD_GAP_SECONDS = 5 * 60;
const MIN_WORKOUT_MINUTES = 10;
const WORKOUT_THRESHOLD_PCT = 0.6;

export interface WorkoutSession {
  startTs: number;
  endTs: number;
  durationMinutes: number;
  avgHR: number;
  peakHR: number;
  trimp: number;
  estimatedCalories: number;
}

export interface BodyMetricsSnapshot {
  spo2Percent: number | null;
  skinTempC: number | null;
  respiratoryRate: number | null;
  ppgGreen: number | null;
  accelMagnitude: number | null;
}

export interface SyncSummary {
  totalRecords: number;
  periodStartTs: number | null;
  periodEndTs: number | null;
  avgHR: number | null;
  restingHR: number | null;
  latestBodyMetrics: BodyMetricsSnapshot;
  sleepSessions: SleepSession[];
  latestSleep: SleepSession | null;
  strainScore: number | null;
  trimp: number | null;
  stressIndex: number | null;
  rmssd: number | null;
  workoutSessions: WorkoutSession[];
  historicalChart: { time: number; bpm: number }[];
  helloInfo: WhoopHelloInfo | null;
  lastStrapEvent: StrapEvent | null;
}

export function summarizeHistoricalSync(
  records: HistoricalRecord[],
  helloInfo: WhoopHelloInfo | null,
  strapEvents: StrapEvent[]
): SyncSummary {
  const dedupedRecords = dedupeAndSortRecords(records);
  const validHr = dedupedRecords.map((record) => record.bpm).filter(isValidHeartRate);
  const latestRecord = dedupedRecords.at(-1) ?? null;
  const sleepSessions = detectSleep(dedupedRecords);
  const workoutSessions = detectWorkoutSessions(dedupedRecords);
  const rrPool = dedupedRecords.flatMap((record) => record.rrMs).filter(isValidRr);

  return {
    totalRecords: dedupedRecords.length,
    periodStartTs: dedupedRecords[0]?.unixTs ?? null,
    periodEndTs: latestRecord?.unixTs ?? null,
    avgHR: validHr.length > 0 ? Math.round(mean(validHr)) : null,
    restingHR: validHr.length > 0 ? Math.min(...validHr) : null,
    latestBodyMetrics: buildLatestBodyMetrics(dedupedRecords),
    sleepSessions,
    latestSleep: sleepSessions.at(-1) ?? null,
    strainScore: computeStrainScore(dedupedRecords),
    trimp: roundTo(computeTrimp(dedupedRecords), 1),
    stressIndex: computeStressIndex(rrPool),
    rmssd: rrPool.length >= 2 ? computeRMSSD(rrPool) : null,
    workoutSessions,
    historicalChart: buildHistoricalChart(dedupedRecords),
    helloInfo,
    lastStrapEvent: strapEvents.at(-1) ?? null,
  };
}

export function buildHealthKitPayload(summary: SyncSummary) {
  return {
    bodyTemperature:
      summary.latestBodyMetrics.skinTempC !== null && summary.periodEndTs
        ? {
            value: summary.latestBodyMetrics.skinTempC,
            date: new Date(summary.periodEndTs * 1000),
          }
        : null,
    heartRateSamples: summary.historicalChart
      .filter((sample) => isValidHeartRate(sample.bpm))
      .map((sample, index) => ({
        bpm: sample.bpm,
        date: new Date((summary.periodStartTs ?? 0) * 1000 + index * 60_000),
      })),
    workouts: summary.workoutSessions,
  };
}

export function formatTimestamp(unixTs: number | null): string {
  if (!unixTs) return "--";
  return new Date(unixTs * 1000).toLocaleString();
}

export function formatFirmwareInfo(info: WhoopHelloInfo | null): string {
  if (!info) return "--";
  const parts = [info.firmwareVersion, info.hardwareRevision, info.protocolVersion].filter(Boolean);
  return parts.length > 0 ? parts.join(" • ") : "--";
}

function dedupeAndSortRecords(records: HistoricalRecord[]): HistoricalRecord[] {
  const map = new Map<number, HistoricalRecord>();
  for (const record of records) {
    map.set(record.seq, record);
  }
  return Array.from(map.values()).sort((a, b) => a.unixTs - b.unixTs);
}

function buildLatestBodyMetrics(records: HistoricalRecord[]): BodyMetricsSnapshot {
  const latestWithBodyMetrics = [...records]
    .reverse()
    .find(
      (record) =>
        record.skinTempC !== undefined ||
        record.spo2Red !== undefined ||
        record.respRateBrpm !== undefined ||
        record.ppgGreen !== undefined
    );

  return {
    spo2Percent: estimateSpo2(records),
    skinTempC: latestWithBodyMetrics?.skinTempC ?? null,
    respiratoryRate: latestWithBodyMetrics?.respRateBrpm ?? null,
    ppgGreen: latestWithBodyMetrics?.ppgGreen ?? null,
    accelMagnitude:
      latestWithBodyMetrics?.accelX !== undefined &&
      latestWithBodyMetrics?.accelY !== undefined &&
      latestWithBodyMetrics?.accelZ !== undefined
        ? roundTo(
            Math.sqrt(
              latestWithBodyMetrics.accelX ** 2 +
                latestWithBodyMetrics.accelY ** 2 +
                latestWithBodyMetrics.accelZ ** 2
            ),
            3
          )
        : null,
  };
}

function estimateSpo2(records: HistoricalRecord[]): number | null {
  const candidates = records.filter(
    (record) =>
      record.spo2Red !== undefined &&
      record.spo2Ir !== undefined &&
      record.spo2Red > 0 &&
      record.spo2Ir > 0
  );

  if (candidates.length < 4) return null;

  const window = candidates.slice(-12);
  const reds = window.map((record) => record.spo2Red as number);
  const irs = window.map((record) => record.spo2Ir as number);
  const redDc = mean(reds);
  const irDc = mean(irs);
  const redAc = stddev(reds);
  const irAc = stddev(irs);

  if (redDc <= 0 || irDc <= 0 || redAc <= 0 || irAc <= 0) return null;

  const ratio = (redAc / redDc) / (irAc / irDc);
  const spo2 = 110 - 25 * ratio;
  return clamp(roundTo(spo2, 1), 80, 100);
}

function computeStressIndex(rrMs: number[]): number | null {
  const filtered = rrMs.filter(isValidRr);
  if (filtered.length < 20) return null;

  const bucketSize = 50;
  const histogram = new Map<number, number>();
  for (const rr of filtered) {
    const bucket = Math.round(rr / bucketSize) * bucketSize;
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
  }

  let modeBucket = 0;
  let modeCount = 0;
  for (const [bucket, count] of histogram) {
    if (count > modeCount) {
      modeBucket = bucket;
      modeCount = count;
    }
  }

  const amo = (modeCount / filtered.length) * 100;
  const moSeconds = modeBucket / 1000;
  const mxdmnSeconds = (Math.max(...filtered) - Math.min(...filtered)) / 1000;

  if (moSeconds <= 0 || mxdmnSeconds <= 0) return null;

  const index = amo / (2 * moSeconds * mxdmnSeconds);
  return roundTo(index, 1);
}

function computeTrimp(
  records: HistoricalRecord[],
  maxHr = DEFAULT_MAX_HR,
  restingHr = DEFAULT_RESTING_HR
): number {
  const sorted = records.filter((record) => isValidHeartRate(record.bpm)).sort((a, b) => a.unixTs - b.unixTs);
  if (sorted.length < 2) return 0;

  let trimp = 0;
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const dtSeconds = next ? next.unixTs - current.unixTs : 60;
    const durationMinutes = clamp(dtSeconds, 30, MAX_RECORD_GAP_SECONDS) / 60;
    const hrReserve = (current.bpm - restingHr) / Math.max(maxHr - restingHr, 1);
    const zone = clamp(Math.floor((current.bpm / maxHr) * 10), 0, 10);
    const zoneWeight =
      zone >= 9 ? 5 : zone >= 8 ? 4 : zone >= 7 ? 3 : zone >= 6 ? 2 : zone >= 5 ? 1 : 0;

    if (hrReserve > 0 && zoneWeight > 0) {
      trimp += durationMinutes * zoneWeight;
    }
  }

  return trimp;
}

function computeStrainScore(records: HistoricalRecord[]): number | null {
  const trimp = computeTrimp(records);
  if (trimp <= 0) return null;

  const strain = 21 * (1 - Math.exp(-trimp / 55));
  return roundTo(clamp(strain, 0, 21), 1);
}

function detectWorkoutSessions(records: HistoricalRecord[]): WorkoutSession[] {
  const sorted = records.filter((record) => isValidHeartRate(record.bpm)).sort((a, b) => a.unixTs - b.unixTs);
  const minWorkoutHr = DEFAULT_MAX_HR * WORKOUT_THRESHOLD_PCT;
  const workouts: WorkoutSession[] = [];

  let startIndex: number | null = null;
  let lastIndex: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i];
    const isWorkoutHeartRate = record.bpm >= minWorkoutHr;

    if (isWorkoutHeartRate) {
      if (startIndex === null) {
        startIndex = i;
      }
      lastIndex = i;
      continue;
    }

    if (startIndex !== null && lastIndex !== null) {
      const gapSeconds = record.unixTs - sorted[lastIndex].unixTs;
      if (gapSeconds > MAX_RECORD_GAP_SECONDS) {
        pushWorkoutIfValid(sorted, workouts, startIndex, lastIndex);
        startIndex = null;
        lastIndex = null;
      }
    }
  }

  if (startIndex !== null && lastIndex !== null) {
    pushWorkoutIfValid(sorted, workouts, startIndex, lastIndex);
  }

  return workouts;
}

function pushWorkoutIfValid(
  sorted: HistoricalRecord[],
  workouts: WorkoutSession[],
  startIndex: number,
  endIndex: number
) {
  const segment = sorted.slice(startIndex, endIndex + 1);
  if (segment.length === 0) return;

  const startTs = segment[0].unixTs;
  const endTs = segment.at(-1)?.unixTs ?? startTs;
  const durationMinutes = (endTs - startTs) / 60;
  if (durationMinutes < MIN_WORKOUT_MINUTES) return;

  const heartRates = segment.map((record) => record.bpm);
  const trimp = computeTrimp(segment);
  workouts.push({
    startTs,
    endTs,
    durationMinutes: roundTo(durationMinutes, 1),
    avgHR: Math.round(mean(heartRates)),
    peakHR: Math.max(...heartRates),
    trimp: roundTo(trimp, 1),
    estimatedCalories: Math.round(
      segment.reduce((sum, record) => sum + Math.max(record.bpm - DEFAULT_RESTING_HR, 0) * 0.08, 0)
    ),
  });
}

function buildHistoricalChart(records: HistoricalRecord[]): { time: number; bpm: number }[] {
  const sorted = records.filter((record) => isValidHeartRate(record.bpm)).sort((a, b) => a.unixTs - b.unixTs);
  if (sorted.length === 0) return [];

  const sampleStride = Math.max(1, Math.floor(sorted.length / 120));
  const startTs = sorted[0].unixTs;

  return sorted
    .filter((_, index) => index % sampleStride === 0)
    .map((record) => ({
      time: Math.round((record.unixTs - startTs) / 60),
      bpm: record.bpm,
    }));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number {
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isValidHeartRate(bpm: number): boolean {
  return bpm >= 25 && bpm <= 220;
}

function isValidRr(rrMs: number): boolean {
  return rrMs >= 300 && rrMs <= 2000;
}
