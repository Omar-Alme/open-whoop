"""
WHOOP 4.0 BLE Protocol — Corrected Implementation

Packet format (Gen4):
  [SOF=0xAA] [Length: u16 LE] [CRC8: u8] [Type: u8] [Seq: u8] [Cmd: u8] [Payload] [CRC32: u32 LE]

  - Length  = len(Type + Seq + Cmd + Payload) + 4   (the +4 is for the CRC32)
  - CRC8    = CRC-8/SMBUS over the 2 Length bytes only
  - CRC32   = standard zlib.crc32 over (Type + Seq + Cmd + Payload)

Reference: github.com/bWanShiTong/openwhoop, github.com/jogolden/whoomp
"""

import struct
import zlib

# --- BLE UUIDs ---

WHOOP_SERVICE_UUID        = "61080001-8d6d-82b8-614a-1c8cb0f8dcc6"
CMD_TO_STRAP_UUID         = "61080002-8d6d-82b8-614a-1c8cb0f8dcc6"
CMD_FROM_STRAP_UUID       = "61080003-8d6d-82b8-614a-1c8cb0f8dcc6"
EVENTS_FROM_STRAP_UUID    = "61080004-8d6d-82b8-614a-1c8cb0f8dcc6"
DATA_FROM_STRAP_UUID      = "61080005-8d6d-82b8-614a-1c8cb0f8dcc6"
MEMFAULT_UUID             = "61080007-8d6d-82b8-614a-1c8cb0f8dcc6"
HR_SERVICE_UUID           = "0000180d-0000-1000-8000-00805f9b34fb"
HR_MEASUREMENT_UUID       = "00002a37-0000-1000-8000-00805f9b34fb"

SOF = 0xAA


# --- Packet Type byte ---

class PacketType:
    COMMAND          = 0x23  # 35  — commands we send
    COMMAND_RESPONSE = 0x24  # 36  — responses to our commands
    REALTIME_DATA    = 0x28  # 40  — live sensor data
    HISTORICAL_DATA  = 0x2F  # 47  — historical records
    EVENT            = 0x30  # 48  — device events (wrist on/off, charging, etc.)
    METADATA         = 0x31  # 49  — sync control (history start/end/complete)
    CONSOLE_LOGS     = 0x32  # 50
    REALTIME_IMU     = 0x33  # 51
    HISTORICAL_IMU   = 0x34  # 52

    _NAMES = {
        0x23: "COMMAND",
        0x24: "CMD_RESPONSE",
        0x28: "REALTIME_DATA",
        0x2F: "HISTORICAL_DATA",
        0x30: "EVENT",
        0x31: "METADATA",
        0x32: "CONSOLE_LOGS",
        0x33: "REALTIME_IMU",
        0x34: "HISTORICAL_IMU",
    }

    @classmethod
    def name(cls, v: int) -> str:
        return cls._NAMES.get(v, f"TYPE_0x{v:02X}")


# --- Command Numbers (used when Type == COMMAND or COMMAND_RESPONSE) ---

class Cmd:
    TOGGLE_REALTIME_HR       = 3
    REPORT_VERSION_INFO      = 7
    SET_CLOCK                = 10
    GET_CLOCK                = 11
    TOGGLE_GENERIC_HR        = 14
    SEND_HISTORICAL_DATA     = 22   # triggers historical download
    HISTORICAL_DATA_RESULT   = 23   # ack a batch, request next
    GET_BATTERY_LEVEL        = 26
    GET_DATA_RANGE           = 34
    GET_HELLO_HARVARD        = 35
    GET_ADVERTISING_NAME     = 76
    ENTER_HIGH_FREQ_SYNC     = 96
    EXIT_HIGH_FREQ_SYNC      = 97
    GET_HELLO                = 145

    _NAMES = {
        3: "TOGGLE_REALTIME_HR",
        7: "REPORT_VERSION_INFO",
        10: "SET_CLOCK",
        11: "GET_CLOCK",
        14: "TOGGLE_GENERIC_HR",
        22: "SEND_HISTORICAL_DATA",
        23: "HISTORICAL_DATA_RESULT",
        26: "GET_BATTERY_LEVEL",
        34: "GET_DATA_RANGE",
        35: "GET_HELLO_HARVARD",
        76: "GET_ADVERTISING_NAME",
        96: "ENTER_HIGH_FREQ_SYNC",
        97: "EXIT_HIGH_FREQ_SYNC",
        145: "GET_HELLO",
    }

    @classmethod
    def name(cls, v: int) -> str:
        return cls._NAMES.get(v, f"CMD_{v}")


# --- Metadata subtypes (cmd byte when Type == METADATA) ---

class MetaType:
    HISTORY_START    = 1
    HISTORY_END      = 2
    HISTORY_COMPLETE = 3

    @classmethod
    def name(cls, v: int) -> str:
        return {1: "HISTORY_START", 2: "HISTORY_END", 3: "HISTORY_COMPLETE"}.get(v, f"META_{v}")


# --- Event numbers (cmd byte when Type == EVENT) ---

class EventNum:
    CHARGING_ON  = 7
    CHARGING_OFF = 8
    WRIST_ON     = 9
    WRIST_OFF    = 10
    DOUBLE_TAP   = 14

    @classmethod
    def name(cls, v: int) -> str:
        return {
            7: "CHARGING_ON", 8: "CHARGING_OFF",
            9: "WRIST_ON", 10: "WRIST_OFF", 14: "DOUBLE_TAP",
        }.get(v, f"EVENT_{v}")


# --- CRC helpers ---

def _crc8(data: bytes) -> int:
    """CRC-8/SMBUS  poly=0x07, init=0x00, no reflect."""
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) if (crc & 0x80) else (crc << 1)
            crc &= 0xFF
    return crc


def _crc32(data: bytes) -> int:
    """Standard CRC-32 (same as zlib.crc32)."""
    return zlib.crc32(data) & 0xFFFFFFFF


# --- Packet building ---

_seq_counter = 0

def _next_seq() -> int:
    global _seq_counter
    s = _seq_counter & 0xFF
    _seq_counter += 1
    return s


def build_packet(pkt_type: int, cmd: int, payload: bytes = b"", seq: int | None = None) -> bytes:
    """Build a complete WHOOP packet ready to write to CMD_TO_STRAP."""
    if seq is None:
        seq = _next_seq()
    inner = bytes([pkt_type, seq, cmd]) + payload
    length = len(inner) + 4          # +4 for CRC32
    length_bytes = struct.pack("<H", length)
    crc8_val = _crc8(length_bytes)
    crc32_val = _crc32(inner)
    return bytes([SOF]) + length_bytes + bytes([crc8_val]) + inner + struct.pack("<I", crc32_val)


def build_command(cmd: int, payload: bytes = b"", seq: int | None = None) -> bytes:
    """Convenience wrapper for Type=COMMAND packets."""
    return build_packet(PacketType.COMMAND, cmd, payload, seq)


# --- Packet parsing ---

class WhoopPacket:
    """A parsed WHOOP BLE packet."""

    def __init__(self, raw: bytes):
        self.raw       = raw
        self.valid     = False          # CRC32 passes
        self.crc8_ok   = False          # CRC8 header passes
        self.partial   = False          # packet is incomplete
        self.sof       = 0
        self.length    = 0
        self.pkt_type  = 0
        self.seq       = 0
        self.cmd       = 0
        self.payload   = b""
        self.crc32_val = 0
        self._parse()

    def _parse(self):
        raw = self.raw
        if len(raw) < 8:
            self.partial = True
            return

        self.sof    = raw[0]
        self.length = struct.unpack_from("<H", raw, 1)[0]
        crc8_byte   = raw[3]
        self.crc8_ok = (_crc8(raw[1:3]) == crc8_byte)

        inner_len = self.length - 4     # subtract CRC32
        total_expected = 4 + inner_len + 4

        if len(raw) < total_expected:
            self.partial = True
            # Still parse what we have
            inner = raw[4:4 + inner_len] if len(raw) >= 4 + inner_len else raw[4:]
        else:
            inner = raw[4:4 + inner_len]

        if len(inner) < 3:
            return

        self.pkt_type = inner[0]
        self.seq      = inner[1]
        self.cmd      = inner[2]
        self.payload  = inner[3:]

        if not self.partial:
            self.crc32_val = struct.unpack_from("<I", raw, 4 + inner_len)[0]
            self.valid = (_crc32(inner) == self.crc32_val)

    @property
    def type_name(self) -> str:
        return PacketType.name(self.pkt_type)

    @property
    def cmd_name(self) -> str:
        if self.pkt_type == PacketType.EVENT:
            return EventNum.name(self.cmd)
        if self.pkt_type == PacketType.METADATA:
            return MetaType.name(self.cmd)
        return Cmd.name(self.cmd)

    def is_type(self, pkt_type: int) -> bool:
        return self.pkt_type == pkt_type

    def is_cmd_response(self, cmd: int) -> bool:
        return self.pkt_type == PacketType.COMMAND_RESPONSE and self.cmd == cmd

    def response_ok(self) -> bool:
        """Returns True if this is a successful command response (result code == 1)."""
        return (
            self.pkt_type == PacketType.COMMAND_RESPONSE
            and len(self.payload) >= 2
            and self.payload[1] == 1
        )

    def __repr__(self):
        status = "OK" if self.valid else ("PARTIAL" if self.partial else "BAD_CRC")
        return (
            f"WhoopPacket({status} {self.type_name} seq={self.seq} "
            f"{self.cmd_name} payload={self.payload.hex()})"
        )


def parse_packet(data: bytes) -> WhoopPacket:
    return WhoopPacket(data)


# --- Historical data record parsing ---

def parse_historical_record(payload: bytes) -> dict | None:
    """
    Parse a historical data record from a HISTORICAL_DATA packet payload.
    Format depends on payload length:
      >= 77 bytes: V12 format with PPG, SpO2, temperature, accelerometer
      >= 22 bytes: V7  format with HR and RR intervals only
    """
    n = len(payload)
    if n < 14:
        return None

    rec = {"raw_len": n}

    try:
        rec["seq"]       = struct.unpack_from("<I", payload, 0)[0]
        rec["unix_ts"]   = struct.unpack_from("<I", payload, 4)[0]
        rec["subsec"]    = struct.unpack_from("<H", payload, 8)[0]
        rec["bpm"]       = payload[14] if n > 14 else 0
        rec["rr_count"]  = payload[15] if n > 15 else 0

        rr = []
        for i in range(min(rec["rr_count"], 4)):
            offset = 16 + i * 2
            if offset + 2 <= n:
                rr.append(struct.unpack_from("<H", payload, offset)[0])
        rec["rr_ms"] = rr

        if n >= 77:
            # V12: full sensor data
            rec["accel_x"]    = struct.unpack_from("<f", payload, 33)[0]
            rec["accel_y"]    = struct.unpack_from("<f", payload, 37)[0]
            rec["accel_z"]    = struct.unpack_from("<f", payload, 41)[0]
            rec["spo2_red"]   = struct.unpack_from("<H", payload, 61)[0]
            rec["spo2_ir"]    = struct.unpack_from("<H", payload, 63)[0]
            rec["skin_temp_c"]= struct.unpack_from("<H", payload, 65)[0] * 0.04
            rec["ppg_green"]  = struct.unpack_from("<H", payload, 26)[0] if n > 27 else None
            rec["resp_raw"]   = struct.unpack_from("<H", payload, 73)[0] if n > 74 else None

    except struct.error:
        pass

    return rec


# --- Standard BLE Heart Rate parsing ---

def parse_hr_measurement(data: bytes) -> dict | None:
    """Parse standard BLE 0x2A37 Heart Rate Measurement characteristic."""
    if not data or len(data) < 2:
        return None

    flags    = data[0]
    hr_16bit = bool(flags & 0x01)
    rr_pres  = bool(flags & 0x10)
    nrg_pres = bool(flags & 0x08)

    offset = 1
    if hr_16bit:
        if len(data) < 3:
            return None
        bpm = struct.unpack_from("<H", data, 1)[0]
        offset = 3
    else:
        bpm = data[1]
        offset = 2

    result = {"bpm": bpm, "rr_intervals_ms": []}

    if nrg_pres:
        offset += 2

    if rr_pres:
        while offset + 1 < len(data):
            rr_raw = struct.unpack_from("<H", data, offset)[0]
            result["rr_intervals_ms"].append(round(rr_raw * 1000 / 1024))
            offset += 2

    return result
