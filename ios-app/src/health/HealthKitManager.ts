/**
 * HealthKit Manager — writes WHOOP-derived data to Apple Health.
 *
 * The current react-native-health bridge supports heart rate, body temperature,
 * and workouts directly. HRV, SpO2, respiratory rate, and sleep permissions are
 * requested so the app is ready for a bridge extension, but their write methods
 * are only attempted when present on the native module.
 */

import AppleHealthKit, {
  HealthActivity,
  type AppleHealthKit as AppleHealthKitModule,
  type HealthKitPermissions,
  type HealthValue,
} from "react-native-health";

import type { SleepSession } from "../algorithms/SleepDetector";
import type { SyncSummary, WorkoutSession } from "../algorithms/DerivedMetrics";

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [],
    write: [
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.OxygenSaturation,
      AppleHealthKit.Constants.Permissions.BodyTemperature,
      AppleHealthKit.Constants.Permissions.RespiratoryRate,
      AppleHealthKit.Constants.Permissions.Workout,
    ],
  },
};

type SaveCallback = (error: string | null, result?: HealthValue | string) => void;

type ExtendedHealthKitModule = AppleHealthKitModule & {
  saveHeartRateVariabilitySample?: (
    options: { value: number; startDate: string; endDate: string },
    callback: SaveCallback
  ) => void;
  saveOxygenSaturationSample?: (
    options: { value: number; startDate: string; endDate: string },
    callback: SaveCallback
  ) => void;
  saveRespiratoryRateSample?: (
    options: { value: number; startDate: string; endDate: string },
    callback: SaveCallback
  ) => void;
  saveSleep?: (
    options: { startDate: string; endDate: string; value: string },
    callback: SaveCallback
  ) => void;
};

export interface HealthSyncReport {
  heartRateSamples: number;
  bodyTemperatureSamples: number;
  workouts: number;
  optionalWrites: string[];
  skippedWrites: string[];
}

class HealthKitManager {
  private initialized = false;
  private enabled = true;
  private module = AppleHealthKit as ExtendedHealthKitModule;

  async initialize(): Promise<boolean> {
    return new Promise((resolve) => {
      this.module.initHealthKit(PERMISSIONS, (error: string) => {
        if (error) {
          console.log("HealthKit init error:", error);
          resolve(false);
          return;
        }

        this.initialized = true;
        resolve(true);
      });
    });
  }

  isReady(): boolean {
    return this.initialized && this.enabled;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  async writeHeartRate(bpm: number, date: Date = new Date()): Promise<boolean> {
    if (!this.isReady()) return false;

    return new Promise((resolve) => {
      this.module.saveHeartRateSample(
        {
          value: bpm,
          startDate: date.toISOString(),
          endDate: date.toISOString(),
        },
        (error) => {
          if (error) {
            console.log("HealthKit HR write error:", error);
            resolve(false);
            return;
          }
          resolve(true);
        }
      );
    });
  }

  async writeBodyTemperature(celsius: number, date: Date = new Date()): Promise<boolean> {
    if (!this.isReady()) return false;

    return new Promise((resolve) => {
      this.module.saveBodyTemperature(
        {
          value: celsius,
          startDate: date.toISOString(),
          endDate: date.toISOString(),
          unit: AppleHealthKit.Constants.Units.celsius,
        },
        (error) => resolve(!error)
      );
    });
  }

  async writeWorkout(session: WorkoutSession): Promise<boolean> {
    if (!this.isReady()) return false;

    return new Promise((resolve) => {
      this.module.saveWorkout(
        {
          type: HealthActivity.MixedCardio,
          startDate: new Date(session.startTs * 1000).toISOString(),
          endDate: new Date(session.endTs * 1000).toISOString(),
          energyBurned: session.estimatedCalories,
          energyBurnedUnit: AppleHealthKit.Constants.Units.kilocalorie as never,
        } as never,
        (error) => resolve(!error)
      );
    });
  }

  async writeHRV(rmssd: number, date: Date = new Date()): Promise<boolean> {
    if (!this.isReady() || !this.module.saveHeartRateVariabilitySample) return false;

    return new Promise((resolve) => {
      this.module.saveHeartRateVariabilitySample?.(
        {
          value: rmssd,
          startDate: date.toISOString(),
          endDate: date.toISOString(),
        },
        (error: string | null) => resolve(!error)
      );
    });
  }

  async writeSpO2(percentage: number, date: Date = new Date()): Promise<boolean> {
    if (!this.isReady() || !this.module.saveOxygenSaturationSample) return false;

    return new Promise((resolve) => {
      this.module.saveOxygenSaturationSample?.(
        {
          value: percentage / 100,
          startDate: date.toISOString(),
          endDate: date.toISOString(),
        },
        (error: string | null) => resolve(!error)
      );
    });
  }

  async writeRespiratoryRate(brpm: number, date: Date = new Date()): Promise<boolean> {
    if (!this.isReady() || !this.module.saveRespiratoryRateSample) return false;

    return new Promise((resolve) => {
      this.module.saveRespiratoryRateSample?.(
        {
          value: brpm,
          startDate: date.toISOString(),
          endDate: date.toISOString(),
        },
        (error: string | null) => resolve(!error)
      );
    });
  }

  async writeSleep(session: SleepSession): Promise<boolean> {
    if (!this.isReady() || !this.module.saveSleep) return false;

    return new Promise((resolve) => {
      this.module.saveSleep?.(
        {
          startDate: new Date(session.startTs * 1000).toISOString(),
          endDate: new Date(session.endTs * 1000).toISOString(),
          value: "ASLEEP",
        },
        (error: string | null) => resolve(!error)
      );
    });
  }

  async syncSummary(summary: SyncSummary): Promise<HealthSyncReport> {
    const report: HealthSyncReport = {
      heartRateSamples: 0,
      bodyTemperatureSamples: 0,
      workouts: 0,
      optionalWrites: [],
      skippedWrites: [],
    };

    if (!this.isReady()) return report;

    const heartRateSamples = buildHistoricalHeartRateSamples(summary);
    for (const sample of heartRateSamples) {
      if (await this.writeHeartRate(sample.bpm, sample.date)) {
        report.heartRateSamples += 1;
      }
    }

    if (
      summary.latestBodyMetrics.skinTempC !== null &&
      summary.periodEndTs &&
      (await this.writeBodyTemperature(
        summary.latestBodyMetrics.skinTempC,
        new Date(summary.periodEndTs * 1000)
      ))
    ) {
      report.bodyTemperatureSamples += 1;
    }

    for (const session of summary.workoutSessions) {
      if (await this.writeWorkout(session)) {
        report.workouts += 1;
      }
    }

    if (summary.rmssd !== null && summary.periodEndTs) {
      const rmssd = summary.rmssd;
      const periodEnd = new Date(summary.periodEndTs * 1000);
      await this.tryOptionalWrite(
        "HRV",
        () => this.writeHRV(rmssd, periodEnd),
        report
      );
    }

    if (summary.latestBodyMetrics.spo2Percent !== null && summary.periodEndTs) {
      const spo2Percent = summary.latestBodyMetrics.spo2Percent;
      const periodEnd = new Date(summary.periodEndTs * 1000);
      await this.tryOptionalWrite(
        "SpO2",
        () => this.writeSpO2(spo2Percent, periodEnd),
        report
      );
    }

    if (summary.latestBodyMetrics.respiratoryRate !== null && summary.periodEndTs) {
      const respiratoryRate = summary.latestBodyMetrics.respiratoryRate;
      const periodEnd = new Date(summary.periodEndTs * 1000);
      await this.tryOptionalWrite(
        "Respiratory Rate",
        () => this.writeRespiratoryRate(respiratoryRate, periodEnd),
        report
      );
    }

    if (summary.latestSleep) {
      const latestSleep = summary.latestSleep;
      await this.tryOptionalWrite(
        "Sleep Analysis",
        () => this.writeSleep(latestSleep),
        report
      );
    }

    return report;
  }

  private async tryOptionalWrite(
    label: string,
    writer: () => Promise<boolean>,
    report: HealthSyncReport
  ) {
    const didWrite = await writer();
    if (didWrite) {
      report.optionalWrites.push(label);
      return;
    }

    report.skippedWrites.push(label);
  }
}

function buildHistoricalHeartRateSamples(summary: SyncSummary) {
  if (summary.periodStartTs === null) return [];
  const periodStartTs = summary.periodStartTs;

  return summary.historicalChart.map((point) => ({
    bpm: point.bpm,
    date: new Date((periodStartTs + point.time * 60) * 1000),
  }));
}

export const healthKit = new HealthKitManager();
