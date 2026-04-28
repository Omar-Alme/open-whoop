"""
WHOOP 4.0 — Historical Data Sync

Connects, runs the proper handshake sequence, and downloads all stored
historical records (HR, RR intervals, SpO2, temperature, accelerometer).

Sync command sequence (from OpenWhoop / whoomp source):
  1. GetHelloHarvard  (cmd=35, payload=[0x00])
  2. SetClock         (cmd=10, payload=[unix_ts u32 LE + 6 zero bytes])
  3. EnterHighFreqSync (cmd=96)
  4. SendHistoricalData (cmd=22, payload=[0x00])
  5. Loop: receive HISTORICAL_DATA packets on DATA_FROM_STRAP
  6. On METADATA HISTORY_END: send HistoricalDataResult with trim value
  7. On METADATA HISTORY_COMPLETE: done

Run: python sync.py <ADDRESS>
     python sync.py D5:D4:33:CE:70:10
"""

import asyncio
import json
import struct
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from bleak import BleakClient, BleakError

from protocol import (
    CMD_TO_STRAP_UUID, CMD_FROM_STRAP_UUID,
    EVENTS_FROM_STRAP_UUID, DATA_FROM_STRAP_UUID,
    HR_MEASUREMENT_UUID,
    PacketType, Cmd, MetaType, EventNum,
    build_command, parse_packet, parse_historical_record, parse_hr_measurement,
)


class WhoopSync:
    def __init__(self, address: str):
        self.address  = address
        self.client   = None
        self._buf     = bytearray()          # reassembly buffer for fragmented packets
        self._records: list[dict] = []
        self._done    = asyncio.Event()
        self._batch   = 0
        self._log_path = Path("data/raw_logs") / f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_sync.jsonl"
        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        self._log_file = None

    # ------------------------------------------------------------------ logging

    def _log(self, entry: dict):
        entry["ts"] = datetime.now().isoformat()
        if self._log_file:
            print(json.dumps(entry), file=self._log_file, flush=True)

    def _info(self, msg: str):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

    # ------------------------------------------------------------------ handlers

    def _handle_data(self, sender, raw: bytearray):
        """Receive DATA_FROM_STRAP notifications — may be fragmented."""
        self._buf.extend(raw)
        self._try_consume()

    def _try_consume(self):
        """Pull complete packets out of the reassembly buffer."""
        while len(self._buf) >= 4:
            if self._buf[0] != 0xAA:
                self._buf = self._buf[1:]
                continue

            if len(self._buf) < 4:
                break

            length = struct.unpack_from("<H", self._buf, 1)[0]
            total  = 4 + (length - 4) + 4   # SOF+len+crc8 + inner + crc32

            if len(self._buf) < total:
                break   # wait for more fragments

            raw_pkt = bytes(self._buf[:total])
            self._buf = self._buf[total:]
            self._dispatch(raw_pkt)

    def _dispatch(self, raw: bytes):
        pkt = parse_packet(raw)

        if pkt.pkt_type == PacketType.HISTORICAL_DATA:
            rec = parse_historical_record(pkt.payload)
            if rec:
                rec["seq_pkt"] = pkt.seq
                self._records.append(rec)
                if len(self._records) % 10 == 0:
                    self._info(f"  {len(self._records)} records received...")
            self._log({"type": "historical_data", "valid": pkt.valid,
                        "payload": pkt.payload.hex()})

        elif pkt.pkt_type == PacketType.METADATA:
            self._info(f"  Metadata: {MetaType.name(pkt.cmd)}")
            self._log({"type": "metadata", "cmd": pkt.cmd,
                        "payload": pkt.payload.hex()})

            if pkt.cmd == MetaType.HISTORY_END:
                asyncio.ensure_future(self._ack_batch(pkt.payload))

            elif pkt.cmd == MetaType.HISTORY_COMPLETE:
                self._info(f"  Sync complete — {len(self._records)} total records.")
                self._done.set()

        else:
            self._log({"type": "data_other", "pkt_type": pkt.pkt_type,
                        "raw": raw.hex()})

    def _handle_cmd_response(self, sender, raw: bytearray):
        pkt = parse_packet(bytes(raw))
        self._info(f"  CMD_RESP: {pkt.cmd_name} ok={pkt.response_ok()} "
                   f"payload={pkt.payload.hex()}")
        self._log({"type": "cmd_response", "cmd": pkt.cmd_name,
                    "ok": pkt.response_ok(), "raw": raw.hex()})

    def _handle_event(self, sender, raw: bytearray):
        pkt = parse_packet(bytes(raw))
        self._info(f"  EVENT: {pkt.cmd_name} seq={pkt.seq} payload={pkt.payload.hex()}")
        self._log({"type": "event", "event": pkt.cmd_name,
                    "seq": pkt.seq, "raw": raw.hex()})

    def _handle_hr(self, sender, raw: bytearray):
        parsed = parse_hr_measurement(bytes(raw))
        if parsed:
            bpm = parsed["bpm"]
            rr  = parsed["rr_intervals_ms"]
            rr_str = f"  RR:{rr}" if rr else ""
            self._info(f"  HR: {bpm} bpm{rr_str}")
            self._log({"type": "hr", "bpm": bpm, "rr_ms": rr})

    # ------------------------------------------------------------------ commands

    async def _send(self, cmd: int, payload: bytes = b""):
        pkt = build_command(cmd, payload)
        self._info(f"  >>> {Cmd.name(cmd)}: {pkt.hex()}")
        await self.client.write_gatt_char(CMD_TO_STRAP_UUID, pkt)
        await asyncio.sleep(0.5)

    async def _ack_batch(self, meta_payload: bytes):
        """Parse trim value from HISTORY_END metadata and send HistoricalDataResult."""
        self._batch += 1
        try:
            if len(meta_payload) >= 14:
                trim = struct.unpack_from("<I", meta_payload, 10)[0]
            elif len(meta_payload) >= 4:
                trim = struct.unpack_from("<I", meta_payload, 0)[0]
            else:
                trim = 0
        except struct.error:
            trim = 0

        self._info(f"  Ack batch #{self._batch} (trim=0x{trim:08X})")
        response_payload = struct.pack("<BII", 1, trim, 0)
        await self._send(Cmd.HISTORICAL_DATA_RESULT, response_payload)

    # ------------------------------------------------------------------ main flow

    async def run(self, timeout: float = 120.0):
        self._info(f"Connecting to {self.address}...")

        with self._log_path.open("w") as f:
            self._log_file = f

            try:
                async with BleakClient(self.address, timeout=15.0) as client:
                    self.client = client
                    self._info(f"Connected. MTU: {client.mtu_size}")

                    # Pair to unlock write access
                    await client.pair()
                    self._info("Paired.")

                    # Subscribe to all channels
                    # HR via service iteration (Windows UUID cache workaround)
                    for svc in client.services:
                        for char in svc.characteristics:
                            if "2a37" in str(char.uuid).lower():
                                await client.start_notify(char, self._handle_hr)
                                self._info("Subscribed: HR")

                    await client.start_notify(CMD_FROM_STRAP_UUID,    self._handle_cmd_response)
                    await client.start_notify(EVENTS_FROM_STRAP_UUID, self._handle_event)
                    await client.start_notify(DATA_FROM_STRAP_UUID,   self._handle_data)
                    self._info("All channels subscribed.\n")

                    # --- Handshake sequence ---
                    self._info("--- Starting sync handshake ---")

                    # 1. Hello
                    await self._send(Cmd.GET_HELLO_HARVARD, b"\x00")

                    # 2. Set clock (sync time to device)
                    unix_ts = int(time.time())
                    clock_payload = struct.pack("<I", unix_ts) + b"\x00" * 6
                    await self._send(Cmd.SET_CLOCK, clock_payload)

                    # 3. Enter high-frequency sync mode
                    await self._send(Cmd.ENTER_HIGH_FREQ_SYNC)

                    # 4. Trigger historical data download
                    self._info("--- Requesting historical data ---")
                    await self._send(Cmd.SEND_HISTORICAL_DATA, b"\x00")

                    # 5. Wait for sync to complete
                    self._info(f"Waiting for data (timeout={timeout}s)...\n")
                    try:
                        await asyncio.wait_for(self._done.wait(), timeout=timeout)
                    except asyncio.TimeoutError:
                        self._info(f"Timeout — got {len(self._records)} records so far.")

                    # 6. Exit high-frequency sync
                    await self._send(Cmd.EXIT_HIGH_FREQ_SYNC)

            except BleakError as e:
                self._info(f"BLE error: {e}")
                return []

        self._info(f"\nLog saved: {self._log_path}")
        return self._records

    # ------------------------------------------------------------------ summary

    def print_summary(self):
        recs = self._records
        if not recs:
            self._info("No historical records received.")
            return

        print(f"\n{'='*50}")
        print(f"SYNC SUMMARY — {len(recs)} records")
        print(f"{'='*50}")

        hr_vals = [r["bpm"] for r in recs if r.get("bpm", 0) > 0]
        if hr_vals:
            print(f"Heart Rate:  {min(hr_vals)}-{max(hr_vals)} bpm  "
                  f"(avg {sum(hr_vals)//len(hr_vals)} bpm)")

        rr_flat = [rr for r in recs for rr in r.get("rr_ms", [])]
        if rr_flat:
            print(f"RR intervals: {len(rr_flat)} total")

        ts_vals = [r["unix_ts"] for r in recs if r.get("unix_ts", 0) > 1_000_000_000]
        if ts_vals:
            t_start = datetime.fromtimestamp(min(ts_vals), tz=timezone.utc)
            t_end   = datetime.fromtimestamp(max(ts_vals), tz=timezone.utc)
            print(f"Time range:  {t_start.strftime('%Y-%m-%d %H:%M')} to "
                  f"{t_end.strftime('%Y-%m-%d %H:%M')} UTC")

        has_accel = sum(1 for r in recs if "accel_x" in r)
        if has_accel:
            print(f"Accel data:  {has_accel} records")

        has_spo2 = sum(1 for r in recs if "spo2_red" in r)
        if has_spo2:
            print(f"SpO2 data:   {has_spo2} records")

        has_temp = sum(1 for r in recs if r.get("skin_temp_c", 0) > 10)
        if has_temp:
            temps = [r["skin_temp_c"] for r in recs if r.get("skin_temp_c", 0) > 10]
            print(f"Skin temp:   {min(temps):.1f}-{max(temps):.1f}°C")

        # Save parsed records
        out = Path("data/sessions") / f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_records.json"
        out.parent.mkdir(exist_ok=True)
        out.write_text(json.dumps(recs, indent=2, default=str))
        print(f"\nRecords saved: {out}")


async def main(address: str):
    syncer = WhoopSync(address)
    await syncer.run(timeout=120.0)
    syncer.print_summary()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python sync.py <ADDRESS>")
        print("  e.g. python sync.py D5:D4:33:CE:70:10")
        sys.exit(1)

    asyncio.run(main(sys.argv[1]))
