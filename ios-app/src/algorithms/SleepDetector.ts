/**
 * Sleep Detection Algorithm
 *
 * Derived from openwhoop (github.com/bWanShiTong/openwhoop)
 *
 * Method: gravity-vector stillness analysis
 *   - Compute magnitude of accelerometer delta between consecutive records
 *   - If delta < STILL_THRESHOLD → sample is "still"
 *   - Over a rolling WINDOW_MINUTES window, if >= STILL_FRACTION are still → sleep
 *   - Merge short transitions, require minimum sleep duration
 */

import type { HistoricalRecord } from "../protocol/WhoopProtocol";

const STILL_THRESHOLD = 0.01;    // max g-force delta to be "still"
const WINDOW_MINUTES = 15;       // rolling window in minutes
const STILL_FRACTION = 0.70;     // fraction of window that must be still
const MIN_SLEEP_MINUTES = 60;    // minimum valid sleep session
const MAX_GAP_MINUTES = 20;      // gap that breaks a sleep run
const RECORDS_PER_MINUTE = 1;    // approximately 1 record per minute

export interface SleepSession {
  startTs: number;   // unix timestamp
  endTs: number;     // unix timestamp
  durationMinutes: number;
  avgHR: number;
}

export function detectSleep(records: HistoricalRecord[]): SleepSession[] {
  // Filter to records that have accelerometer data
  const withAccel = records.filter(
    (r) => r.accelX !== undefined && r.accelY !== undefined && r.accelZ !== undefined
  );

  if (withAccel.length < WINDOW_MINUTES * 2) return [];

  // Sort by timestamp
  withAccel.sort((a, b) => a.unixTs - b.unixTs);

  // Step 1: compute "still" flag per record
  const stillFlags: boolean[] = [false]; // first has no previous
  for (let i = 1; i < withAccel.length; i++) {
    const prev = withAccel[i - 1];
    const curr = withAccel[i];
    const dx = (curr.accelX ?? 0) - (prev.accelX ?? 0);
    const dy = (curr.accelY ?? 0) - (prev.accelY ?? 0);
    const dz = (curr.accelZ ?? 0) - (prev.accelZ ?? 0);
    const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
    stillFlags.push(delta < STILL_THRESHOLD);
  }

  // Step 2: rolling window classification
  const windowSize = WINDOW_MINUTES * RECORDS_PER_MINUTE;
  const isSleeping: boolean[] = new Array(withAccel.length).fill(false);

  for (let i = windowSize; i < withAccel.length; i++) {
    const windowFlags = stillFlags.slice(i - windowSize, i);
    const stillCount = windowFlags.filter(Boolean).length;
    isSleeping[i] = stillCount / windowSize >= STILL_FRACTION;
  }

  // Step 3: find contiguous sleep runs
  const sessions: SleepSession[] = [];
  let sessionStart: number | null = null;
  let lastSleepIdx: number | null = null;

  for (let i = 0; i < withAccel.length; i++) {
    const rec = withAccel[i];
    const sleeping = isSleeping[i];

    if (sleeping) {
      if (sessionStart === null) {
        sessionStart = i;
      }
      lastSleepIdx = i;
    } else if (sessionStart !== null && lastSleepIdx !== null) {
      // Check if gap is too large — end session
      const gapMinutes = (rec.unixTs - withAccel[lastSleepIdx].unixTs) / 60;
      if (gapMinutes > MAX_GAP_MINUTES) {
        const start = withAccel[sessionStart];
        const end = withAccel[lastSleepIdx];
        const durationMinutes = (end.unixTs - start.unixTs) / 60;

        if (durationMinutes >= MIN_SLEEP_MINUTES) {
          const hrVals = withAccel
            .slice(sessionStart, lastSleepIdx + 1)
            .filter((r) => r.bpm > 20 && r.bpm < 200)
            .map((r) => r.bpm);
          const avgHR = hrVals.length > 0
            ? Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length)
            : 0;

          sessions.push({
            startTs: start.unixTs,
            endTs: end.unixTs,
            durationMinutes: Math.round(durationMinutes),
            avgHR,
          });
        }

        sessionStart = null;
        lastSleepIdx = null;
      }
    }
  }

  // Close final session if still open
  if (sessionStart !== null && lastSleepIdx !== null) {
    const start = withAccel[sessionStart];
    const end = withAccel[lastSleepIdx];
    const durationMinutes = (end.unixTs - start.unixTs) / 60;
    if (durationMinutes >= MIN_SLEEP_MINUTES) {
      const hrVals = withAccel
        .slice(sessionStart, lastSleepIdx + 1)
        .filter((r) => r.bpm > 20 && r.bpm < 200)
        .map((r) => r.bpm);
      const avgHR = hrVals.length > 0
        ? Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length)
        : 0;
      sessions.push({
        startTs: start.unixTs,
        endTs: end.unixTs,
        durationMinutes: Math.round(durationMinutes),
        avgHR,
      });
    }
  }

  return sessions;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
