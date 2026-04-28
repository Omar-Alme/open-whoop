/**
 * WHOOP 4.0 Proprietary BLE Protocol
 *
 * Implements the packet format, CRC, and sync command sequence
 * for direct communication with the WHOOP band.
 *
 * Packet format:
 *   [SOF=0xAA] [Length: u16 LE] [CRC8] [Type] [Seq] [Cmd] [Payload] [CRC32: u32 LE]
 */

// --- BLE UUIDs ---
export const WHOOP_SERVICE_UUID = "61080001-8d6d-82b8-614a-1c8cb0f8dcc6";
export const CMD_TO_STRAP_UUID = "61080002-8d6d-82b8-614a-1c8cb0f8dcc6";
export const CMD_FROM_STRAP_UUID = "61080003-8d6d-82b8-614a-1c8cb0f8dcc6";
export const EVENTS_FROM_STRAP_UUID = "61080004-8d6d-82b8-614a-1c8cb0f8dcc6";
export const DATA_FROM_STRAP_UUID = "61080005-8d6d-82b8-614a-1c8cb0f8dcc6";
export const MEMFAULT_UUID = "61080007-8d6d-82b8-614a-1c8cb0f8dcc6";
export const HR_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
export const HR_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb";
export const BATTERY_SERVICE_UUID = "0000180f-0000-1000-8000-00805f9b34fb";
export const BATTERY_LEVEL_UUID = "00002a19-0000-1000-8000-00805f9b34fb";

const SOF = 0xaa;

// --- Packet Types ---
export enum PacketType {
  COMMAND = 0x23,
  COMMAND_RESPONSE = 0x24,
  REALTIME_DATA = 0x28,
  HISTORICAL_DATA = 0x2f,
  EVENT = 0x30,
  METADATA = 0x31,
}

// --- Command Numbers ---
export enum Cmd {
  TOGGLE_REALTIME_HR = 3,
  SET_CLOCK = 10,
  GET_CLOCK = 11,
  TOGGLE_GENERIC_HR = 14,
  SEND_HISTORICAL_DATA = 22,
  HISTORICAL_DATA_RESULT = 23,
  GET_BATTERY_LEVEL = 26,
  GET_DATA_RANGE = 34,
  GET_HELLO_HARVARD = 35,
  GET_ADVERTISING_NAME = 76,
  ENTER_HIGH_FREQ_SYNC = 96,
  EXIT_HIGH_FREQ_SYNC = 97,
}

// --- Metadata subtypes ---
export enum MetaType {
  HISTORY_START = 1,
  HISTORY_END = 2,
  HISTORY_COMPLETE = 3,
}

// --- CRC-8/SMBUS (poly=0x07, init=0x00) ---
function crc8(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

// --- Standard CRC-32 (ISO 3309) ---
let _crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (_crc32Table) return _crc32Table;
  _crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    _crc32Table[i] = crc >>> 0;
  }
  return _crc32Table;
}

function crc32(data: Uint8Array): number {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (~crc) >>> 0;
}

// --- Sequence counter ---
let _seq = 0;
function nextSeq(): number {
  return (_seq++) & 0xff;
}

// --- Packet Building ---

export function buildCommand(cmd: Cmd, payload: Uint8Array = new Uint8Array()): Uint8Array {
  const seq = nextSeq();
  const inner = new Uint8Array(3 + payload.length);
  inner[0] = PacketType.COMMAND;
  inner[1] = seq;
  inner[2] = cmd;
  inner.set(payload, 3);

  const length = inner.length + 4; // +4 for CRC32
  const lengthBytes = new Uint8Array([length & 0xff, (length >> 8) & 0xff]);
  const crc8Val = crc8(lengthBytes);
  const crc32Val = crc32(inner);

  const packet = new Uint8Array(1 + 2 + 1 + inner.length + 4);
  packet[0] = SOF;
  packet[1] = lengthBytes[0];
  packet[2] = lengthBytes[1];
  packet[3] = crc8Val;
  packet.set(inner, 4);

  // CRC32 LE
  const crcOffset = 4 + inner.length;
  packet[crcOffset] = crc32Val & 0xff;
  packet[crcOffset + 1] = (crc32Val >> 8) & 0xff;
  packet[crcOffset + 2] = (crc32Val >> 16) & 0xff;
  packet[crcOffset + 3] = (crc32Val >> 24) & 0xff;

  return packet;
}

// --- Packet Parsing ---

export interface WhoopPacket {
  valid: boolean;
  partial: boolean;
  type: PacketType;
  seq: number;
  cmd: number;
  payload: Uint8Array;
  totalSize: number;
}

export function parsePacket(data: Uint8Array): WhoopPacket | null {
  if (data.length < 8) return null;
  if (data[0] !== SOF) return null;

  const length = data[1] | (data[2] << 8);
  const innerLen = length - 4;
  const totalSize = 4 + innerLen + 4;

  if (data.length < totalSize) {
    // Partial packet
    if (data.length < 7) return null;
    return {
      valid: false,
      partial: true,
      type: data[4] as PacketType,
      seq: data[5],
      cmd: data[6],
      payload: data.slice(7, Math.min(data.length, 4 + innerLen)),
      totalSize,
    };
  }

  const inner = data.slice(4, 4 + innerLen);
  const expectedCrc = data[4 + innerLen]
    | (data[4 + innerLen + 1] << 8)
    | (data[4 + innerLen + 2] << 16)
    | ((data[4 + innerLen + 3] << 24) >>> 0);

  const actualCrc = crc32(inner);

  return {
    valid: (actualCrc >>> 0) === (expectedCrc >>> 0),
    partial: false,
    type: inner[0] as PacketType,
    seq: inner[1],
    cmd: inner[2],
    payload: inner.slice(3),
    totalSize,
  };
}

// --- Historical Record Parsing ---

export interface HistoricalRecord {
  seq: number;
  unixTs: number;
  subsec?: number;
  bpm: number;
  rrCount: number;
  rrMs: number[];
  ppgGreen?: number;
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  spo2Red?: number;
  spo2Ir?: number;
  skinTempC?: number;
  respRateRaw?: number;
  respRateBrpm?: number;
}

export interface WhoopHelloInfo {
  advertisingName?: string;
  hardwareId?: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
  protocolVersion?: string;
  rawStrings: string[];
  rawInts: number[];
}

export interface StrapEvent {
  code: number;
  label: string;
  payloadHex: string;
  recordedAt: number;
}

export function parseHistoricalRecord(payload: Uint8Array): HistoricalRecord | null {
  if (payload.length < 16) return null;

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const seq = view.getUint32(0, true);
  const unixTs = view.getUint32(4, true);
  const subsec = payload.length >= 10 ? view.getUint16(8, true) : undefined;
  const bpm = payload[14];
  const rrCount = payload[15];

  const rrMs: number[] = [];
  for (let i = 0; i < Math.min(rrCount, 4); i++) {
    const offset = 16 + i * 2;
    if (offset + 2 <= payload.length) {
      rrMs.push(view.getUint16(offset, true));
    }
  }

  const record: HistoricalRecord = { seq, unixTs, subsec, bpm, rrCount, rrMs };

  // V12 format — extended sensor data
  if (payload.length >= 77) {
    record.ppgGreen = view.getUint16(26, true);
    record.accelX = view.getFloat32(33, true);
    record.accelY = view.getFloat32(37, true);
    record.accelZ = view.getFloat32(41, true);
    record.spo2Red = view.getUint16(61, true);
    record.spo2Ir = view.getUint16(63, true);
    record.skinTempC = view.getUint16(65, true) * 0.04;
    record.respRateRaw = view.getUint16(73, true);
    record.respRateBrpm = estimateRespiratoryRate(record.respRateRaw);
  }

  return record;
}

export function parseHelloHarvard(payload: Uint8Array): WhoopHelloInfo | null {
  if (payload.length === 0) return null;

  const usablePayload =
    payload.length >= 2 && payload[1] <= 3 ? payload.slice(2) : payload;
  const rawStrings = extractAsciiStrings(usablePayload);
  const firstString = rawStrings[0];
  const secondString = rawStrings[1];
  const afterStringsOffset = findTrailingNumericOffset(usablePayload);
  const rawInts: number[] = [];

  if (afterStringsOffset >= 0) {
    const view = new DataView(
      usablePayload.buffer,
      usablePayload.byteOffset,
      usablePayload.byteLength
    );
    for (let offset = afterStringsOffset; offset + 4 <= usablePayload.length; offset += 4) {
      rawInts.push(view.getUint32(offset, true));
    }
  }

  const versionTuple = rawInts.filter((value) => value > 0 && value < 10_000);
  const firmwareVersion =
    versionTuple.length >= 4 ? versionTuple.slice(0, 4).join(".") : undefined;
  const hardwareRevision =
    versionTuple.length >= 6 ? `${versionTuple[4]}.${versionTuple[5]}` : undefined;
  const protocolVersion =
    versionTuple.length >= 8 ? versionTuple.slice(6, 8).join(".") : undefined;

  return {
    advertisingName: firstString,
    hardwareId: secondString,
    firmwareVersion,
    hardwareRevision,
    protocolVersion,
    rawStrings,
    rawInts,
  };
}

export function parseStrapEvent(payload: Uint8Array, cmd: number): StrapEvent {
  return {
    code: cmd,
    label: strapEventLabel(cmd, payload),
    payloadHex: bytesToHex(payload),
    recordedAt: Date.now(),
  };
}

// --- Sync Command Helpers ---

export function buildHelloHarvard(): Uint8Array {
  return buildCommand(Cmd.GET_HELLO_HARVARD, new Uint8Array([0x00]));
}

export function buildSetClock(): Uint8Array {
  const now = Math.floor(Date.now() / 1000);
  const payload = new Uint8Array(10);
  const view = new DataView(payload.buffer);
  view.setUint32(0, now, true);
  // Bytes 4-9 are zero (already initialized)
  return buildCommand(Cmd.SET_CLOCK, payload);
}

export function buildEnterHighFreqSync(): Uint8Array {
  return buildCommand(Cmd.ENTER_HIGH_FREQ_SYNC);
}

export function buildExitHighFreqSync(): Uint8Array {
  return buildCommand(Cmd.EXIT_HIGH_FREQ_SYNC);
}

export function buildSendHistoricalData(): Uint8Array {
  return buildCommand(Cmd.SEND_HISTORICAL_DATA, new Uint8Array([0x00]));
}

export function buildHistoryAck(trimValue: number): Uint8Array {
  const payload = new Uint8Array(9);
  const view = new DataView(payload.buffer);
  payload[0] = 0x01;
  view.setUint32(1, trimValue, true);
  // Bytes 5-8 are zero
  return buildCommand(Cmd.HISTORICAL_DATA_RESULT, payload);
}

// --- Utility ---

function estimateRespiratoryRate(raw: number | undefined): number | undefined {
  if (!raw) return undefined;

  let value = raw;
  if (raw > 1000) {
    value = raw / 100;
  } else if (raw > 100) {
    value = raw / 10;
  }

  if (value < 4 || value > 45) return undefined;
  return Math.round(value * 10) / 10;
}

function extractAsciiStrings(bytes: Uint8Array): string[] {
  const strings: string[] = [];
  let current = "";

  for (const byte of bytes) {
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
      continue;
    }

    if (current.length >= 4) {
      strings.push(current);
    }
    current = "";
  }

  if (current.length >= 4) {
    strings.push(current);
  }

  return strings;
}

function findTrailingNumericOffset(bytes: Uint8Array): number {
  let lastPrintable = -1;

  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] >= 32 && bytes[i] <= 126) {
      lastPrintable = i;
    }
  }

  if (lastPrintable < 0) return 0;

  let offset = lastPrintable + 1;
  while (offset < bytes.length && bytes[offset] === 0) {
    offset++;
  }

  return offset <= bytes.length - 4 ? offset : -1;
}

function strapEventLabel(cmd: number, payload: Uint8Array): string {
  const key = `${cmd}:${payload[0] ?? -1}`;
  const knownEvents: Record<string, string> = {
    "1:1": "Wrist On",
    "1:0": "Wrist Off",
    "2:1": "Charging Started",
    "2:0": "Charging Stopped",
  };

  return knownEvents[key] ?? `Event ${cmd}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
