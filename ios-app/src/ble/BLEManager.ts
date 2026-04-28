/**
 * BLE Manager — handles scanning, connecting, and subscribing to the WHOOP band.
 *
 * Uses react-native-ble-plx for CoreBluetooth access on iOS.
 * Manages connection lifecycle and exposes callbacks for HR/data/events.
 */

import { BleManager, Device, Characteristic, BleError, State } from "react-native-ble-plx";
import {
  HR_SERVICE_UUID,
  HR_MEASUREMENT_UUID,
  BATTERY_SERVICE_UUID,
  BATTERY_LEVEL_UUID,
  WHOOP_SERVICE_UUID,
  CMD_TO_STRAP_UUID,
  CMD_FROM_STRAP_UUID,
  EVENTS_FROM_STRAP_UUID,
  DATA_FROM_STRAP_UUID,
  base64ToBytes,
  bytesToBase64,
  parsePacket,
  PacketType,
  MetaType,
  parseHistoricalRecord,
  buildHelloHarvard,
  buildSetClock,
  buildEnterHighFreqSync,
  buildExitHighFreqSync,
  buildSendHistoricalData,
  buildHistoryAck,
  parseHelloHarvard,
  parseStrapEvent,
  type HistoricalRecord,
  type StrapEvent,
  type WhoopHelloInfo,
  type WhoopPacket,
} from "../protocol/WhoopProtocol";
import { parseHRMeasurement, type HRMeasurement } from "./HRParser";

export type ConnectionState = "idle" | "scanning" | "connecting" | "connected" | "disconnected";

export interface WhoopCallbacks {
  onConnectionChange: (state: ConnectionState, device?: Device) => void;
  onHR: (hr: HRMeasurement) => void;
  onBattery: (level: number) => void;
  onHistoricalRecord: (record: HistoricalRecord) => void;
  onHelloInfo: (info: WhoopHelloInfo) => void;
  onStrapEvent: (event: StrapEvent) => void;
  onSyncProgress: (received: number, batch: number) => void;
  onSyncComplete: (totalRecords: number) => void;
  onError: (msg: string) => void;
}

class WhoopBLEManager {
  private manager: BleManager;
  private device: Device | null = null;
  private callbacks: WhoopCallbacks | null = null;
  private connState: ConnectionState = "idle";
  private dataBuffer: number[] = [];
  private syncRecordCount = 0;
  private syncBatchCount = 0;

  constructor() {
    this.manager = new BleManager();
  }

  setCallbacks(cb: WhoopCallbacks) {
    this.callbacks = cb;
  }

  getState(): ConnectionState {
    return this.connState;
  }

  private setState(state: ConnectionState, dev?: Device) {
    this.connState = state;
    this.callbacks?.onConnectionChange(state, dev);
  }

  /**
   * Start scanning for WHOOP devices.
   * Looks for devices advertising the WHOOP proprietary service or
   * devices with "WHOOP" in the name.
   */
  async startScan() {
    this.setState("scanning");

    // Wait for BLE to be powered on
    const state = await this.manager.state();
    if (state !== State.PoweredOn) {
      await new Promise<void>((resolve) => {
        const sub = this.manager.onStateChange((s) => {
          if (s === State.PoweredOn) {
            sub.remove();
            resolve();
          }
        }, true);
      });
    }

    this.manager.startDeviceScan(
      [WHOOP_SERVICE_UUID, HR_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          this.callbacks?.onError(`Scan error: ${error.message}`);
          return;
        }
        if (device && device.name && device.name.toUpperCase().includes("WHOOP")) {
          this.manager.stopDeviceScan();
          this.connect(device);
        }
      }
    );

    // Auto-stop scan after 15 seconds if nothing found
    setTimeout(() => {
      if (this.connState === "scanning") {
        this.manager.stopDeviceScan();
        this.setState("idle");
        this.callbacks?.onError("No WHOOP found. Make sure band is worn and awake.");
      }
    }, 15000);
  }

  stopScan() {
    this.manager.stopDeviceScan();
    if (this.connState === "scanning") {
      this.setState("idle");
    }
  }

  /**
   * Connect to a discovered WHOOP device and subscribe to all characteristics.
   */
  async connect(device: Device) {
    this.setState("connecting", device);

    try {
      const connected = await device.connect({ autoConnect: true, timeout: 10000 });
      await connected.discoverAllServicesAndCharacteristics();
      this.device = connected;
      this.setState("connected", connected);

      // Monitor disconnection
      this.manager.onDeviceDisconnected(device.id, (error, dev) => {
        this.device = null;
        this.setState("disconnected");
      });

      // Subscribe to standard HR
      await this.subscribeHR();

      // Read battery
      await this.readBattery();

      // Subscribe to proprietary channels
      await this.subscribeProprietary();

    } catch (e: any) {
      this.callbacks?.onError(`Connection failed: ${e.message}`);
      this.setState("idle");
    }
  }

  /**
   * Subscribe to the standard BLE Heart Rate Measurement characteristic.
   */
  private async subscribeHR() {
    if (!this.device) return;

    this.device.monitorCharacteristicForService(
      HR_SERVICE_UUID,
      HR_MEASUREMENT_UUID,
      (error: BleError | null, char: Characteristic | null) => {
        if (error || !char?.value) return;
        const parsed = parseHRMeasurement(char.value);
        if (parsed) {
          this.callbacks?.onHR(parsed);
        }
      }
    );
  }

  /**
   * Read battery level from standard Battery Service.
   */
  private async readBattery() {
    if (!this.device) return;
    try {
      const char = await this.device.readCharacteristicForService(
        BATTERY_SERVICE_UUID,
        BATTERY_LEVEL_UUID
      );
      if (char?.value) {
        const bytes = base64ToBytes(char.value);
        if (bytes.length > 0) {
          this.callbacks?.onBattery(bytes[0]);
        }
      }
    } catch {
      // Battery service might not be available or readable
    }
  }

  /**
   * Subscribe to WHOOP proprietary characteristics for sync data.
   */
  private async subscribeProprietary() {
    if (!this.device) return;

    // CMD_FROM_STRAP — command responses
    try {
      this.device.monitorCharacteristicForService(
        WHOOP_SERVICE_UUID,
        CMD_FROM_STRAP_UUID,
        (error, char) => {
          if (error || !char?.value) return;
          const data = base64ToBytes(char.value);
          const pkt = parsePacket(data);
          if (pkt) {
            this.handleCmdResponse(pkt);
          }
        }
      );
    } catch {}

    // EVENTS_FROM_STRAP — device events
    try {
      this.device.monitorCharacteristicForService(
        WHOOP_SERVICE_UUID,
        EVENTS_FROM_STRAP_UUID,
        (error, char) => {
          if (error || !char?.value) return;
          const data = base64ToBytes(char.value);
          const pkt = parsePacket(data);
          if (!pkt) return;
          const event = parseStrapEvent(pkt.payload, pkt.cmd);
          this.callbacks?.onStrapEvent(event);
        }
      );
    } catch {}

    // DATA_FROM_STRAP — historical data stream
    try {
      this.device.monitorCharacteristicForService(
        WHOOP_SERVICE_UUID,
        DATA_FROM_STRAP_UUID,
        (error, char) => {
          if (error || !char?.value) return;
          const data = base64ToBytes(char.value);
          this.handleDataNotification(data);
        }
      );
    } catch {}
  }

  // --- Proprietary Protocol Handlers ---

  private handleCmdResponse(pkt: WhoopPacket) {
    // Command responses arrive with type COMMAND_RESPONSE
    // payload[1] is the result code: 0=fail, 1=success, 2=pending, 3=unsupported
    if (pkt.cmd === 35 && pkt.payload.length > 2) {
      const info = parseHelloHarvard(pkt.payload);
      if (info) {
        this.callbacks?.onHelloInfo(info);
      }
    }
  }

  /**
   * Handle data notifications — may be fragmented. Buffer and reassemble.
   */
  private handleDataNotification(raw: Uint8Array) {
    // Append to buffer
    for (const b of raw) this.dataBuffer.push(b);

    // Try to extract complete packets
    while (this.dataBuffer.length >= 8) {
      if (this.dataBuffer[0] !== 0xaa) {
        this.dataBuffer.shift();
        continue;
      }

      const length = this.dataBuffer[1] | (this.dataBuffer[2] << 8);
      const innerLen = length - 4;
      const totalSize = 4 + innerLen + 4;

      if (this.dataBuffer.length < totalSize) break;

      const pktBytes = new Uint8Array(this.dataBuffer.splice(0, totalSize));
      const pkt = parsePacket(pktBytes);
      if (!pkt) continue;

      if (pkt.type === PacketType.HISTORICAL_DATA) {
        const record = parseHistoricalRecord(pkt.payload);
        if (record) {
          this.syncRecordCount++;
          this.callbacks?.onHistoricalRecord(record);
          if (this.syncRecordCount % 10 === 0) {
            this.callbacks?.onSyncProgress(this.syncRecordCount, this.syncBatchCount);
          }
        }
      } else if (pkt.type === PacketType.METADATA) {
        if (pkt.cmd === MetaType.HISTORY_END) {
          this.syncBatchCount++;
          this.ackBatch(pkt.payload);
        } else if (pkt.cmd === MetaType.HISTORY_COMPLETE) {
          this.callbacks?.onSyncComplete(this.syncRecordCount);
          this.stopSync().catch(() => {});
        }
      }
    }
  }

  private async ackBatch(metaPayload: Uint8Array) {
    let trimValue = 0;
    if (metaPayload.length >= 14) {
      const view = new DataView(metaPayload.buffer, metaPayload.byteOffset);
      trimValue = view.getUint32(10, true);
    } else if (metaPayload.length >= 4) {
      const view = new DataView(metaPayload.buffer, metaPayload.byteOffset);
      trimValue = view.getUint32(0, true);
    }

    const pkt = buildHistoryAck(trimValue);
    await this.writeCommand(pkt);
  }

  /**
   * Write a command packet to CMD_TO_STRAP.
   */
  private async writeCommand(packet: Uint8Array) {
    if (!this.device) return;
    try {
      await this.device.writeCharacteristicWithResponseForService(
        WHOOP_SERVICE_UUID,
        CMD_TO_STRAP_UUID,
        bytesToBase64(packet)
      );
    } catch (e: any) {
      this.callbacks?.onError(`Write failed: ${e.message}`);
    }
  }

  /**
   * Run the full historical data sync sequence.
   */
  async startSync() {
    if (!this.device || this.connState !== "connected") {
      this.callbacks?.onError("Not connected");
      return;
    }

    this.syncRecordCount = 0;
    this.syncBatchCount = 0;
    this.dataBuffer = [];

    // 1. Hello handshake
    await this.writeCommand(buildHelloHarvard());
    await sleep(500);

    // 2. Set clock
    await this.writeCommand(buildSetClock());
    await sleep(500);

    // 3. Enter high-frequency sync
    await this.writeCommand(buildEnterHighFreqSync());
    await sleep(500);

    // 4. Request historical data
    await this.writeCommand(buildSendHistoricalData());
    // Data will stream in via handleDataNotification
  }

  async stopSync() {
    await this.writeCommand(buildExitHighFreqSync());
  }

  /**
   * Disconnect and clean up.
   */
  async disconnect() {
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch {}
      this.device = null;
    }
    this.setState("idle");
  }

  destroy() {
    this.manager.destroy();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Singleton
export const bleManager = new WhoopBLEManager();
