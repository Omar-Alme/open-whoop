/**
 * BLE Heart Rate Measurement (0x2A37) Parser
 *
 * Spec: Bluetooth GATT Heart Rate Service 1.0
 * https://www.bluetooth.com/specifications/specs/heart-rate-service-1-0/
 *
 * The characteristic value is a byte array with this structure:
 *
 *   Byte 0: Flags
 *     bit 0:   HR format (0 = uint8, 1 = uint16)
 *     bit 1-2: Sensor contact status
 *       00 = not supported
 *       01 = not supported
 *       10 = no contact detected
 *       11 = contact detected
 *     bit 3:   Energy expended present (1 = yes, uint16 follows HR)
 *     bit 4:   RR-Interval present (1 = yes, one or more uint16 follow)
 *     bits 5-7: reserved
 *
 *   Byte 1 (or 1-2): Heart rate value
 *   Optional: Energy expended (uint16 LE, cumulative kJ)
 *   Optional: One or more RR-Interval values (uint16 LE, units of 1/1024 sec)
 */

export interface HRMeasurement {
  /** Heart rate in BPM */
  bpm: number;

  /** Sensor contact status */
  sensorContact: "supported-contact" | "supported-no-contact" | "not-supported";

  /** RR-Intervals in milliseconds (for HRV computation) */
  rrIntervals: number[];

  /** Cumulative energy expended in kilojoules, if present */
  energyExpended: number | null;
}

/**
 * Parse a raw BLE Heart Rate Measurement characteristic value.
 * Input is a base64-encoded string (as provided by react-native-ble-plx).
 */
export function parseHRMeasurement(base64: string): HRMeasurement | null {
  const bytes = base64ToBytes(base64);
  if (bytes.length < 2) return null;

  const flags = bytes[0];

  // --- Bit 0: HR format ---
  const hrIs16Bit = (flags & 0x01) !== 0;

  // --- Bits 1-2: Sensor contact ---
  const contactBits = (flags >> 1) & 0x03;
  let sensorContact: HRMeasurement["sensorContact"];
  if (contactBits === 0x03) {
    sensorContact = "supported-contact";
  } else if (contactBits === 0x02) {
    sensorContact = "supported-no-contact";
  } else {
    sensorContact = "not-supported";
  }

  // --- Bit 3: Energy expended present ---
  const energyPresent = (flags & 0x08) !== 0;

  // --- Bit 4: RR-Interval present ---
  const rrPresent = (flags & 0x10) !== 0;

  let offset = 1;

  // --- Parse HR value ---
  let bpm: number;
  if (hrIs16Bit) {
    if (bytes.length < 3) return null;
    bpm = bytes[1] | (bytes[2] << 8); // uint16 LE
    offset = 3;
  } else {
    bpm = bytes[1]; // uint8
    offset = 2;
  }

  // --- Parse energy expended (if present) ---
  let energyExpended: number | null = null;
  if (energyPresent) {
    if (offset + 2 <= bytes.length) {
      energyExpended = bytes[offset] | (bytes[offset + 1] << 8);
      offset += 2;
    }
  }

  // --- Parse RR-Intervals (if present) ---
  // There can be multiple RR values packed into a single notification.
  // Each is uint16 LE in units of 1/1024 seconds. Convert to milliseconds.
  const rrIntervals: number[] = [];
  if (rrPresent) {
    while (offset + 1 < bytes.length) {
      const raw = bytes[offset] | (bytes[offset + 1] << 8);
      // Convert from 1/1024 sec to milliseconds: raw * 1000 / 1024
      const ms = Math.round((raw * 1000) / 1024);
      rrIntervals.push(ms);
      offset += 2;
    }
  }

  return { bpm, sensorContact, rrIntervals, energyExpended };
}

/**
 * Decode a base64 string to a Uint8Array.
 * react-native-ble-plx returns characteristic values as base64.
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compute RMSSD (Root Mean Square of Successive Differences) from RR intervals.
 * This is the standard HRV metric. Requires at least 2 intervals.
 *
 * @param rrMs Array of RR intervals in milliseconds
 * @returns RMSSD in milliseconds, or null if insufficient data
 */
export function computeRMSSD(rrMs: number[]): number | null {
  if (rrMs.length < 2) return null;

  let sumSquaredDiffs = 0;
  let count = 0;

  for (let i = 1; i < rrMs.length; i++) {
    const diff = rrMs[i] - rrMs[i - 1];
    sumSquaredDiffs += diff * diff;
    count++;
  }

  return Math.round(Math.sqrt(sumSquaredDiffs / count));
}
