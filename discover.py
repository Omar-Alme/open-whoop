"""
Phase 2 — BLE Service & Characteristic Discovery
Connects to the WHOOP band and enumerates all GATT services/characteristics.
Highlights the known WHOOP proprietary characteristics.

Run: python discover.py <ADDRESS>
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from bleak import BleakClient, BleakError
from protocol import (
    WHOOP_SERVICE_UUID,
    CMD_TO_STRAP_UUID,
    CMD_FROM_STRAP_UUID,
    EVENTS_FROM_STRAP_UUID,
    DATA_FROM_STRAP_UUID,
    MEMFAULT_UUID,
    HR_SERVICE_UUID,
    HR_MEASUREMENT_UUID,
)

KNOWN_UUIDS = {
    WHOOP_SERVICE_UUID: "WHOOP Proprietary Service",
    CMD_TO_STRAP_UUID: "CMD_TO_STRAP (write commands)",
    CMD_FROM_STRAP_UUID: "CMD_FROM_STRAP (command responses)",
    EVENTS_FROM_STRAP_UUID: "EVENTS_FROM_STRAP (event notifications)",
    DATA_FROM_STRAP_UUID: "DATA_FROM_STRAP (sensor/history data)",
    MEMFAULT_UUID: "MEMFAULT (diagnostics)",
    HR_SERVICE_UUID: "Standard Heart Rate Service",
    HR_MEASUREMENT_UUID: "Heart Rate Measurement",
    "0000180a-0000-1000-8000-00805f9b34fb": "Device Information",
    "00001800-0000-1000-8000-00805f9b34fb": "Generic Access",
    "00001801-0000-1000-8000-00805f9b34fb": "Generic Attribute",
    "0000180f-0000-1000-8000-00805f9b34fb": "Battery Service",
    "00002a00-0000-1000-8000-00805f9b34fb": "Device Name",
    "00002a19-0000-1000-8000-00805f9b34fb": "Battery Level",
    "00002a29-0000-1000-8000-00805f9b34fb": "Manufacturer Name",
    "00002a24-0000-1000-8000-00805f9b34fb": "Model Number",
    "00002a25-0000-1000-8000-00805f9b34fb": "Serial Number",
    "00002a26-0000-1000-8000-00805f9b34fb": "Firmware Revision",
    "00002a27-0000-1000-8000-00805f9b34fb": "Hardware Revision",
}


def identify(uuid: str) -> str:
    return KNOWN_UUIDS.get(uuid.lower(), "")


async def discover(address: str):
    print(f"Connecting to {address}...")

    results = {
        "address": address,
        "timestamp": datetime.now().isoformat(),
        "services": [],
    }

    try:
        async with BleakClient(address, timeout=15.0) as client:
            print(f"Connected! MTU: {client.mtu_size}\n")

            for service in client.services:
                svc_id = identify(str(service.uuid))
                label = f" ({svc_id})" if svc_id else ""
                is_whoop = str(service.uuid).lower() == WHOOP_SERVICE_UUID.lower()
                tag = " *** WHOOP ***" if is_whoop else ""

                print(f"Service: {service.uuid}{label}{tag}")

                svc_record = {
                    "uuid": str(service.uuid),
                    "name": svc_id or "Unknown",
                    "characteristics": [],
                }

                for char in service.characteristics:
                    char_id = identify(str(char.uuid))
                    props = ", ".join(sorted(char.properties))
                    char_label = f" ({char_id})" if char_id else ""
                    notify = " <<NOTIFY>>" if ("notify" in char.properties or "indicate" in char.properties) else ""
                    write = " <<WRITE>>" if ("write" in char.properties or "write-without-response" in char.properties) else ""

                    print(f"  {char.uuid}{char_label}")
                    print(f"    Props: {props}{notify}{write}")

                    value_hex = None
                    value_str = None
                    if "read" in char.properties:
                        try:
                            raw = await client.read_gatt_char(char.uuid)
                            value_hex = raw.hex()
                            try:
                                value_str = raw.decode("utf-8").strip()
                            except Exception:
                                pass
                            display = value_str if value_str else value_hex
                            print(f"    Value: {display}")
                        except Exception as e:
                            print(f"    Value: (read failed: {e})")

                    svc_record["characteristics"].append({
                        "uuid": str(char.uuid),
                        "name": char_id or "Unknown",
                        "properties": list(char.properties),
                        "value_hex": value_hex,
                        "value_str": value_str,
                    })

                results["services"].append(svc_record)
                print()

    except BleakError as e:
        print(f"BLE error: {e}")
        sys.exit(1)

    # Save
    out_path = Path("data/discovery.json")
    out_path.parent.mkdir(exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2))
    print(f"Saved to {out_path}")

    # Summary
    print("\n=== KEY CHARACTERISTICS ===")
    print(f"  CMD_TO_STRAP (write):    {CMD_TO_STRAP_UUID}")
    print(f"  CMD_FROM_STRAP (notify): {CMD_FROM_STRAP_UUID}")
    print(f"  EVENTS (notify):         {EVENTS_FROM_STRAP_UUID}")
    print(f"  DATA (notify):           {DATA_FROM_STRAP_UUID}")
    print(f"  HR Measurement:          {HR_MEASUREMENT_UUID}")

    return results


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python discover.py <ADDRESS>")
        print("Run scan.py first to find your WHOOP's address.")
        sys.exit(1)

    asyncio.run(discover(sys.argv[1]))
