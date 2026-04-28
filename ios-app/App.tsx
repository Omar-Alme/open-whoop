/**
 * OpenWhoop — Live Dashboard
 *
 * Connects directly to WHOOP 4.0 over BLE, displays live data plus the
 * proprietary historical sync surface, and mirrors supported metrics to
 * Apple Health.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { bleManager, type ConnectionState } from "./src/ble/BLEManager";
import { computeRMSSD, type HRMeasurement } from "./src/ble/HRParser";
import {
  formatFirmwareInfo,
  formatTimestamp,
  summarizeHistoricalSync,
  type SyncSummary,
} from "./src/algorithms/DerivedMetrics";
import { healthKit, type HealthSyncReport } from "./src/health/HealthKitManager";
import type {
  HistoricalRecord,
  StrapEvent,
  WhoopHelloInfo,
} from "./src/protocol/WhoopProtocol";

import BodyMetricsCard from "./src/components/BodyMetricsCard";
import ChartCard from "./src/components/ChartCard";
import ConnectionCard from "./src/components/ConnectionCard";
import DeviceCard from "./src/components/DeviceCard";
import HRCard from "./src/components/HRCard";
import HRVCard from "./src/components/HRVCard";
import InsightsCard from "./src/components/InsightsCard";
import SleepCard from "./src/components/SleepCard";

const MAX_CHART_POINTS = 60;
const MAX_RR_DISPLAY = 20;
const RMSSD_WINDOW = 30;

export default function App() {
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const [currentBpm, setCurrentBpm] = useState<number | null>(null);
  const [sensorContact, setSensorContact] = useState<string>("not-supported");
  const [energyExpended, setEnergyExpended] = useState<number | null>(null);
  const [chartData, setChartData] = useState<{ time: number; bpm: number }[]>([]);

  const [rrIntervals, setRrIntervals] = useState<number[]>([]);
  const [rmssd, setRmssd] = useState<number | null>(null);

  const [battery, setBattery] = useState<number | null>(null);
  const [healthKitEnabled, setHealthKitEnabled] = useState(true);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [healthSyncStatus, setHealthSyncStatus] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [helloInfo, setHelloInfo] = useState<WhoopHelloInfo | null>(null);
  const [strapEvents, setStrapEvents] = useState<StrapEvent[]>([]);

  const chartRef = useRef<{ time: number; bpm: number }[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const allRrRef = useRef<number[]>([]);
  const historicalRecordsRef = useRef<HistoricalRecord[]>([]);
  const healthKitEnabledRef = useRef<boolean>(true);
  const helloInfoRef = useRef<WhoopHelloInfo | null>(null);
  const strapEventsRef = useRef<StrapEvent[]>([]);
  const lastLiveHrvWriteRef = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS === "ios") {
      healthKit.initialize().then((ok) => {
        if (!ok) {
          console.log("HealthKit permissions not granted");
        }
      });
    }
  }, []);

  useEffect(() => {
    healthKitEnabledRef.current = healthKitEnabled;
  }, [healthKitEnabled]);

  useEffect(() => {
    helloInfoRef.current = helloInfo;
  }, [helloInfo]);

  useEffect(() => {
    strapEventsRef.current = strapEvents;
  }, [strapEvents]);

  useEffect(() => {
    bleManager.setCallbacks({
      onConnectionChange: (state, device) => {
        setConnState(state);
        if (device?.name) {
          setDeviceName(device.name);
        }

        if (state === "connected") {
          resetLiveSession();
        }
      },

      onHR: (hr: HRMeasurement) => {
        setCurrentBpm(hr.bpm);
        setSensorContact(hr.sensorContact);
        if (hr.energyExpended !== null) {
          setEnergyExpended(hr.energyExpended);
        }

        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        chartRef.current.push({ time: elapsed, bpm: hr.bpm });
        if (chartRef.current.length > MAX_CHART_POINTS) {
          chartRef.current = chartRef.current.slice(-MAX_CHART_POINTS);
        }
        setChartData([...chartRef.current]);

        if (hr.rrIntervals.length > 0) {
          allRrRef.current.push(...hr.rrIntervals);
          if (allRrRef.current.length > 300) {
            allRrRef.current = allRrRef.current.slice(-300);
          }

          setRrIntervals(allRrRef.current.slice(-MAX_RR_DISPLAY));

          if (allRrRef.current.length >= RMSSD_WINDOW) {
            const window = allRrRef.current.slice(-RMSSD_WINDOW);
            const nextRmssd = computeRMSSD(window);
            setRmssd(nextRmssd);

            if (
              nextRmssd !== null &&
              Platform.OS === "ios" &&
              healthKitEnabledRef.current &&
              lastLiveHrvWriteRef.current !== nextRmssd
            ) {
              lastLiveHrvWriteRef.current = nextRmssd;
              healthKit.writeHRV(nextRmssd).catch(() => {});
            }
          }
        }

        if (healthKitEnabledRef.current && Platform.OS === "ios") {
          healthKit.writeHeartRate(hr.bpm).catch(() => {});
        }
      },

      onBattery: (level: number) => {
        setBattery(level);
      },

      onHistoricalRecord: (record: HistoricalRecord) => {
        historicalRecordsRef.current.push(record);
      },

      onHelloInfo: (info: WhoopHelloInfo) => {
        setHelloInfo(info);
      },

      onStrapEvent: (event: StrapEvent) => {
        setStrapEvents((current) => [...current.slice(-9), event]);
      },

      onSyncProgress: (received: number, batch: number) => {
        setSyncStatus(`Syncing historical records… ${received} records, batch ${batch}`);
      },

      onSyncComplete: async (total: number) => {
        const summary = summarizeHistoricalSync(
          historicalRecordsRef.current,
          helloInfoRef.current,
          strapEventsRef.current
        );

        setSyncSummary(summary);
        setSyncStatus(
          `Sync complete: ${total} records from ${formatTimestamp(summary.periodStartTs)} to ${formatTimestamp(summary.periodEndTs)}`
        );

        if (Platform.OS === "ios" && healthKitEnabledRef.current) {
          setHealthSyncStatus("Writing supported sync data to Apple Health…");
          const report = await healthKit.syncSummary(summary);
          setHealthSyncStatus(formatHealthSyncReport(report));
        }
      },

      onError: (msg: string) => {
        console.log("BLE Error:", msg);
        if (Platform.OS === "ios") {
          Alert.alert("Bluetooth", msg);
        }
      },
    });
  }, []);

  useEffect(() => {
    return () => {
      bleManager.destroy();
    };
  }, []);

  const handleConnect = useCallback(() => {
    bleManager.startScan();
  }, []);

  const handleDisconnect = useCallback(() => {
    bleManager.disconnect();
  }, []);

  const handleToggleHealthKit = useCallback((enabled: boolean) => {
    setHealthKitEnabled(enabled);
    healthKit.setEnabled(enabled);
    if (!enabled) {
      setHealthSyncStatus("Apple Health sync is off.");
    } else if (syncSummary) {
      setHealthSyncStatus("Apple Health sync is on and ready for the next sync.");
    } else {
      setHealthSyncStatus(null);
    }
  }, [syncSummary]);

  const handleStartSync = useCallback(() => {
    historicalRecordsRef.current = [];
    setSyncSummary(null);
    setHealthSyncStatus(null);
    setSyncStatus("Starting WHOOP historical sync…");
    bleManager.startSync();
  }, []);

  const latestWorkout = syncSummary?.workoutSessions.at(-1) ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.appTitle}>OpenWhoop</Text>
        <Text style={styles.appSubtitle}>WHOOP 4.0 Dashboard + Historical Sync</Text>

        <ConnectionCard
          state={connState}
          deviceName={deviceName}
          rssi={null}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />

        <HRCard bpm={currentBpm} sensorContact={sensorContact} />

        <ChartCard data={chartData} />

        <HRVCard
          rrIntervals={rrIntervals}
          rmssd={rmssd}
          sensorContact={sensorContact}
          energyExpended={energyExpended}
        />

        <DeviceCard
          battery={battery}
          healthKitEnabled={healthKitEnabled}
          onToggleHealthKit={handleToggleHealthKit}
          syncStatus={syncStatus}
          healthSyncStatus={healthSyncStatus}
          onStartSync={handleStartSync}
          isConnected={connState === "connected"}
        />

        {syncSummary && (
          <>
            <ChartCard
              data={syncSummary.historicalChart}
              title="Historical Heart Rate"
              emptyLabel="No synced heart-rate records yet."
              accentColor="#64D2FF"
            />

            <BodyMetricsCard
              spo2Percent={syncSummary.latestBodyMetrics.spo2Percent}
              skinTempC={syncSummary.latestBodyMetrics.skinTempC}
              respiratoryRate={syncSummary.latestBodyMetrics.respiratoryRate}
              ppgGreen={syncSummary.latestBodyMetrics.ppgGreen}
              accelMagnitude={syncSummary.latestBodyMetrics.accelMagnitude}
            />

            <SleepCard
              latestSleep={syncSummary.latestSleep}
              totalSessions={syncSummary.sleepSessions.length}
            />

            <InsightsCard
              totalRecords={syncSummary.totalRecords}
              avgHR={syncSummary.avgHR}
              restingHR={syncSummary.restingHR}
              rmssd={syncSummary.rmssd}
              stressIndex={syncSummary.stressIndex}
              strainScore={syncSummary.strainScore}
              trimp={syncSummary.trimp}
              workoutCount={syncSummary.workoutSessions.length}
              latestWorkout={latestWorkout}
              firmware={formatFirmwareInfo(syncSummary.helloInfo)}
              deviceId={syncSummary.helloInfo?.hardwareId ?? null}
              lastEventLabel={syncSummary.lastStrapEvent?.label ?? null}
            />
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {syncSummary
              ? `Latest sync window: ${formatTimestamp(syncSummary.periodStartTs)} → ${formatTimestamp(syncSummary.periodEndTs)}`
              : "No subscription required. Built with reverse engineering."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  function resetLiveSession() {
    startTimeRef.current = Date.now();
    chartRef.current = [];
    allRrRef.current = [];
    historicalRecordsRef.current = [];
    lastLiveHrvWriteRef.current = null;

    setChartData([]);
    setCurrentBpm(null);
    setSensorContact("not-supported");
    setEnergyExpended(null);
    setRrIntervals([]);
    setRmssd(null);
    setSyncStatus(null);
    setHealthSyncStatus(null);
    setSyncSummary(null);
    setHelloInfo(null);
    setStrapEvents([]);
  }
}

function formatHealthSyncReport(report: HealthSyncReport): string {
  const supported = [
    report.heartRateSamples > 0 ? `${report.heartRateSamples} HR` : null,
    report.bodyTemperatureSamples > 0 ? `${report.bodyTemperatureSamples} temp` : null,
    report.workouts > 0 ? `${report.workouts} workouts` : null,
  ].filter(Boolean);

  const optional = report.optionalWrites.length > 0 ? `Optional: ${report.optionalWrites.join(", ")}` : null;
  const skipped = report.skippedWrites.length > 0 ? `Pending native bridge: ${report.skippedWrites.join(", ")}` : null;

  return [supported.length > 0 ? `Apple Health synced ${supported.join(", ")}.` : "No HealthKit samples were written.", optional, skipped]
    .filter(Boolean)
    .join(" ");
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scroll: {
    padding: 16,
    paddingTop: 8,
  },
  appTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 2,
  },
  appSubtitle: {
    color: "#8E8E93",
    fontSize: 14,
    marginBottom: 16,
  },
  footer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  footerText: {
    color: "#3A3A3C",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
