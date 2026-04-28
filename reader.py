"""
Phase 5 — Live WHOOP Reader
Streams real-time heart rate. For historical data use sync.py.

Run: python reader.py <ADDRESS>
"""

import asyncio
import json
import signal
import sys
from datetime import datetime
from pathlib import Path

from bleak import BleakClient, BleakError

from protocol import (
    CMD_FROM_STRAP_UUID, EVENTS_FROM_STRAP_UUID,
    DATA_FROM_STRAP_UUID,
    PacketType, EventNum,
    parse_packet, parse_hr_measurement,
)


class WhoopReader:
    def __init__(self, address: str):
        self.address  = address
        self.running  = True
        self._log_path = Path("data/raw_logs") / f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_live.jsonl"
        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        self._hr_count = 0

    def _log(self, f, entry: dict):
        entry["ts"] = datetime.now().isoformat()
        print(json.dumps(entry), file=f, flush=True)

    def _on_hr(self, f):
        def handler(sender, data: bytearray):
            parsed = parse_hr_measurement(bytes(data))
            if parsed:
                self._hr_count += 1
                bpm = parsed["bpm"]
                rr  = parsed["rr_intervals_ms"]
                ts  = datetime.now().strftime("%H:%M:%S")
                rr_str = f"  RR:{rr}ms" if rr else ""
                print(f"[{ts}] HR: {bpm} bpm{rr_str}", flush=True)
                self._log(f, {"type": "hr", "bpm": bpm, "rr_ms": rr})
        return handler

    def _on_event(self, f):
        def handler(sender, data: bytearray):
            pkt = parse_packet(bytes(data))
            ts  = datetime.now().strftime("%H:%M:%S")
            if pkt.pkt_type == PacketType.EVENT:
                print(f"[{ts}] Event: {pkt.cmd_name}", flush=True)
            self._log(f, {"type": "event", "event": pkt.cmd_name, "raw": data.hex()})
        return handler

    def _on_cmd(self, f):
        def handler(sender, data: bytearray):
            pkt = parse_packet(bytes(data))
            self._log(f, {"type": "cmd_response", "cmd": pkt.cmd_name, "raw": data.hex()})
        return handler

    def _on_data(self, f):
        def handler(sender, data: bytearray):
            self._log(f, {"type": "data", "raw": data.hex()})
        return handler

    async def run(self):
        print(f"Connecting to {self.address}...")
        print(f"Log: {self._log_path}\n")

        with self._log_path.open("w") as f:
            try:
                async with BleakClient(self.address, timeout=15.0) as client:
                    print(f"Connected. MTU: {client.mtu_size}")
                    await client.pair()

                    # HR via iteration (Windows UUID cache workaround)
                    for svc in client.services:
                        for char in svc.characteristics:
                            if "2a37" in str(char.uuid).lower():
                                await client.start_notify(char, self._on_hr(f))
                                print("Subscribed: Heart Rate")

                    await client.start_notify(CMD_FROM_STRAP_UUID,    self._on_cmd(f))
                    await client.start_notify(EVENTS_FROM_STRAP_UUID, self._on_event(f))
                    await client.start_notify(DATA_FROM_STRAP_UUID,   self._on_data(f))

                    print("Streaming live HR. Ctrl+C to stop.\n")

                    while self.running:
                        await asyncio.sleep(0.1)

            except BleakError as e:
                print(f"BLE error: {e}")

        print(f"\n{self._hr_count} HR readings logged to {self._log_path}")


async def main(address: str):
    reader = WhoopReader(address)

    def _stop(*_):
        print("\nStopping...")
        reader.running = False

    try:
        asyncio.get_running_loop().add_signal_handler(signal.SIGINT, _stop)
    except NotImplementedError:
        signal.signal(signal.SIGINT, _stop)

    await reader.run()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python reader.py <ADDRESS>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
