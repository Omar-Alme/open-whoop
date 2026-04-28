"""
Phase 1 — BLE Scanner
Finds nearby BLE devices and identifies the WHOOP band.
Run: python scan.py
"""

import asyncio
from bleak import BleakScanner
from protocol import WHOOP_SERVICE_UUID


async def scan(duration: float = 10.0):
    print(f"Scanning for BLE devices ({duration}s)...\n")
    devices = await BleakScanner.discover(timeout=duration, return_adv=True)

    whoop_devices = []
    other_devices = []

    for addr, (device, adv) in devices.items():
        name = device.name or adv.local_name or ""
        rssi = adv.rssi
        service_uuids = adv.service_uuids or []

        entry = {"address": addr, "name": name, "rssi": rssi, "uuids": service_uuids}

        # Match by name OR by the proprietary service UUID
        is_whoop = (
            "WHOOP" in name.upper()
            or WHOOP_SERVICE_UUID.lower() in [u.lower() for u in service_uuids]
        )

        if is_whoop:
            whoop_devices.append(entry)
        else:
            other_devices.append(entry)

    if whoop_devices:
        print("=== WHOOP DEVICE(S) FOUND ===")
        for d in whoop_devices:
            print(f"  Name:    {d['name']}")
            print(f"  Address: {d['address']}")
            print(f"  RSSI:    {d['rssi']} dBm")
            if d["uuids"]:
                print(f"  UUIDs:   {', '.join(d['uuids'])}")
            print()
    else:
        print("No WHOOP device found.")
        print("Tips:")
        print("  - Make sure the band is worn and awake")
        print("  - Open the WHOOP app on your phone briefly to wake it")
        print("  - Disconnect the band from the WHOOP app first")
        print("    (Settings > Device > Disconnect)")
        print()

    print(f"--- All {len(devices)} BLE devices found ---")
    for d in sorted(other_devices, key=lambda x: x["rssi"], reverse=True):
        name = d["name"] if d["name"] else "(unnamed)"
        print(f"  {d['address']}  RSSI {d['rssi']:>4} dBm  {name}")

    return whoop_devices


if __name__ == "__main__":
    found = asyncio.run(scan())
    if found:
        addr = found[0]["address"]
        print(f"\nNext steps:")
        print(f"  python discover.py {addr}")
        print(f"  python reader.py {addr}")
