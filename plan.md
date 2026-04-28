# WHOOP BLE Reverse Engineering — Master Plan

> **Goal:** Extract sleep, heart rate, and workout data directly from the WHOOP 4.0 band over Bluetooth — no subscription required. Display everything in a native iOS app and sync to Apple Health.
> **Setup:** Windows PC + iPhone (Apple Developer account)

---

## What We've Already Accomplished

- Connected to WHOOP 4.0 (`WHOOP 4C1417130`, address `D5:D4:33:CE:70:10`) from Windows
- Streaming live heart rate (1Hz, with RR intervals) from standard BLE HR Service
- Successfully ran full historical data sync — pulled **1,574 records** across 34 batches
- Reverse-engineered the correct packet format and CRC
- Confirmed no application-layer auth required (BLE GATT pairing only)

---

## System Architecture

```
WHOOP 4.0 Band
      |
      | BLE (proprietary protocol + standard HR Service)
      |
Python Reader (Windows PC)  <-- must be physically near band (BLE range ~10m)
      |
      | HTTP API (local WiFi) or Cloudflare Tunnel (anywhere)
      |
Expo iOS App (iPhone)
      |
      | HealthKit
      |
Apple Health
```

---

## Known Protocol (WHOOP 4.0)

### BLE Services & Characteristics

| Characteristic | UUID | Direction | Purpose |
|---|---|---|---|
| WHOOP Service | `61080001-8d6d-82b8-614a-1c8cb0f8dcc6` | — | Proprietary service root |
| CMD_TO_STRAP | `61080002-...` | Write | Send commands to band |
| CMD_FROM_STRAP | `61080003-...` | Notify | Command responses |
| EVENTS_FROM_STRAP | `61080004-...` | Notify | Device events |
| DATA_FROM_STRAP | `61080005-...` | Notify | Historical sensor data |
| MEMFAULT | `61080007-...` | Notify | Firmware diagnostics |
| HR Service | `0000180D-...` | — | Standard BLE HR |
| HR Measurement | `00002A37-...` | Notify | Live BPM + RR intervals |
| Battery Level | `00002A19-...` | Read/Notify | Battery % |

### Packet Format

```
[SOF=0xAA] [Length: u16 LE] [CRC8: u8] [Type: u8] [Seq: u8] [Cmd: u8] [Payload] [CRC32: u32 LE]

Length  = len(Type + Seq + Cmd + Payload) + 4
CRC8    = CRC-8/SMBUS (poly=0x07) over the 2 Length bytes
CRC32   = standard zlib.crc32 over (Type + Seq + Cmd + Payload)
```

### Packet Types

| Value | Name | Direction |
|---|---|---|
| 0x23 | COMMAND | PC -> Band |
| 0x24 | COMMAND_RESPONSE | Band -> PC |
| 0x28 | REALTIME_DATA | Band -> PC |
| 0x2F | HISTORICAL_DATA | Band -> PC |
| 0x30 | EVENT | Band -> PC |
| 0x31 | METADATA | Band -> PC |

### Sync Handshake Sequence

```
1. BLE pair (unlocks write access to CMD_TO_STRAP)
2. Subscribe: CMD_FROM_STRAP, EVENTS_FROM_STRAP, DATA_FROM_STRAP
3. Send GET_HELLO_HARVARD    (cmd=35, payload=[0x00])
4. Send SET_CLOCK            (cmd=10, payload=[unix_ts u32 LE + 6 zero bytes])
5. Send ENTER_HIGH_FREQ_SYNC (cmd=96)
6. Send SEND_HISTORICAL_DATA (cmd=22, payload=[0x00])
7. Receive HISTORICAL_DATA   (type=0x2F) packets — parse sensor records
8. On METADATA HISTORY_END   (type=0x31, cmd=2): send HISTORICAL_DATA_RESULT with trim
9. On METADATA HISTORY_COMPLETE (type=0x31, cmd=3): done
10. Send EXIT_HIGH_FREQ_SYNC (cmd=97)
```

### Historical Data Record Layout (per packet payload)

Confirmed across gowhoop, openwhoop, and whoomp:

```
Bytes 0-3:   Sequence counter (u32 LE)
Bytes 4-7:   Unix timestamp in seconds (u32 LE)
Bytes 8-9:   Subseconds (u16 LE)
Bytes 10-13: Flags / unknown
Byte  14:    Heart Rate BPM (u8)
Byte  15:    RR interval count (u8, 0-4 valid intervals follow)
Bytes 16-17: RR interval 1 (u16 LE, milliseconds)
Bytes 18-19: RR interval 2 (u16 LE, milliseconds)
Bytes 20-21: RR interval 3 (u16 LE, milliseconds)
Bytes 22-23: RR interval 4 (u16 LE, milliseconds)

-- V12 format (77+ byte payloads) adds: --
Bytes 33-36: Accel X (f32 LE, units of g)
Bytes 37-40: Accel Y (f32 LE, units of g)
Bytes 41-44: Accel Z (f32 LE, units of g)
Bytes 61-62: SpO2 red channel ADC (u16 LE)
Bytes 63-64: SpO2 IR channel ADC  (u16 LE)
Bytes 65-66: Skin temperature raw (u16 LE) -> multiply by 0.04 for Celsius
Bytes 26-27: PPG green channel (u16 LE)
Bytes 73-74: Respiratory rate raw (u16 LE)
```

### What Data We Can Extract

| Metric | Source | Status |
|---|---|---|
| Live Heart Rate (BPM) | 0x2A37 standard | Working |
| RR Intervals (HRV raw) | 0x2A37 standard | Working |
| Battery % | 0x2A19 standard | Working (59%) |
| Historical HR + RR | DATA_FROM_STRAP sync | Working (1,574 records) |
| Accelerometer (3-axis) | Historical records bytes 33-44 | Parsing implemented |
| SpO2 (raw ADC) | Historical records bytes 61-64 | Parsing implemented |
| Skin temperature | Historical records bytes 65-66 | Parsing implemented |
| Sleep detection | Derived from accel + HR stillness | To implement |
| HRV (RMSSD) | Derived from RR intervals | To implement |
| Strain | Derived from HR + time in zones | To implement |

### Known Limitations

| Limitation | Detail |
|---|---|
| No GPS | WHOOP has no GPS — distance/pace not possible from band alone |
| Server-side scores | Recovery, Strain, HRV scores are WHOOP's proprietary ML — we compute our own |
| Sleep staging | REM/light/deep staging requires ML model — we detect sleep/awake only |
| WHOOP 5.0 | Dual-band Bluetooth, protocol likely changed — untested |
| PC must be home | BLE range ~10m, so PC must be near band to sync |

---

## Reference Projects

| Repo | Language | What it adds |
|---|---|---|
| [bWanShiTong/openwhoop](https://github.com/bWanShiTong/openwhoop) | Rust | Most complete — sleep, HRV, SpO2, strain, full sync |
| [jogolden/whoomp](https://github.com/jogolden/whoomp) | Python | Python reference, packet parser |
| [cs-balazs/gowhoop](https://github.com/cs-balazs/gowhoop) | Go | Confirms byte offsets (HR@14, accel@33-44), ClickHouse/Grafana storage |
| [bWanShiTong/reverse-engineering-whoop-post](https://github.com/bWanShiTong/reverse-engineering-whoop-post) | Docs | Protocol documentation, CRC details |

---

## Phase Plan

### Phase 1-4 — COMPLETE
BLE connection, service discovery, protocol reverse engineering, packet format confirmed.

---

### Phase 5 — Python Backend (In Progress)

**Files built:**
- `protocol.py` — packet format, CRC, all command/type enums, parsers
- `scan.py` — find WHOOP by name + service UUID
- `discover.py` — enumerate all GATT services
- `sync.py` — full historical data sync with batch ack loop
- `reader.py` — live HR streaming
- `store.py` — SQLite storage + CSV/JSON export

**Still to build:**
- [ ] Sleep detection algorithm (gravity stillness, 15-min rolling window, 70% threshold)
- [ ] HRV computation (RMSSD over rolling 300-RR window)
- [ ] Strain calculation (Edwards TRIMP method)
- [ ] SpO2 calculation (ratio-of-ratios from raw ADC)
- [ ] Skin temperature conversion
- [ ] FastAPI HTTP server to expose data to iOS app

---

### Phase 6 — iOS App (Next)

**Goal:** A "kitchen sink" live dashboard showing every metric the WHOOP can send, plus HealthKit sync.

**Stack:**
- **Expo** (React Native) — cross-platform, buildable from Windows
- **react-native-ble-plx** — BLE connectivity (standard HR Service only, no proprietary protocol)
- **react-native-health** — HealthKit read/write
- **victory-native** — real-time charts
- **EAS Build** — cloud iOS compilation (no Mac needed)
- **TestFlight** — distribution via Apple Developer account

**Why standard BLE only in the app:**
The iOS app uses only the standard Heart Rate Service (0x180D) for live data — CoreBluetooth on iOS handles this natively. Historical data sync is handled by the Python backend (Windows PC), which exposes a REST API the app reads from.

**Dashboard cards to build:**

1. **Connection Card** — BLE state, device name, UUID, RSSI
2. **Heart Rate Card** — large live BPM with animated pulse ring
3. **Live Chart Card** — 60-second rolling BPM line chart (victory-native)
4. **HRV Card** — last 5 RR intervals (ms), sensor contact status, RMSSD
5. **Body Metrics Card** — SpO2 %, skin temp, respiratory rate (from last sync)
6. **Sleep Card** — last sleep session summary (from PC sync)
7. **Device Card** — battery %, HealthKit toggle, last sync time

**Data the app writes to Apple Health:**
- Heart Rate samples (every reading)
- Heart Rate Variability (RMSSD)
- Blood Oxygen (SpO2)
- Respiratory Rate
- Sleep Analysis (asleep/awake windows)
- Workout sessions (HR-based, no GPS distance)

**Build & deploy flow (Windows):**
```
1. npm install (Windows)
2. eas build --platform ios  (cloud build, ~10 min)
3. TestFlight -> iPhone
```

**BLE note:** The WHOOP does not auto-broadcast HR — it only streams when a BLE client is actively subscribed. The app maintains a persistent connection while open.

---

### Phase 7 — Cloud Bridge (Optional, later)

Make data available when PC and iPhone are on different networks:

```
Python reader -> Cloudflare Tunnel -> public HTTPS URL -> iOS app
```

One command: `cloudflared tunnel --url http://localhost:8000`

No cloud database needed — just tunnels the local FastAPI server.

---

## Project File Structure

```
whoop-reverse-engineer/
├── plan.md                  <- you are here
├── protocol.py              # Packet format, CRC, enums, parsers
├── scan.py                  # Find WHOOP by BLE scan
├── discover.py              # Enumerate GATT services
├── sync.py                  # Full historical data sync
├── reader.py                # Live HR streaming
├── store.py                 # SQLite storage + CSV/JSON export
├── requirements.txt         # bleak
├── data/
│   ├── raw_logs/            # JSONL capture files from sync sessions
│   └── sessions/            # Parsed JSON records, exported CSVs
└── ios-app/                 # Expo project (Phase 6)
    ├── app/
    │   ├── index.tsx         # Dashboard entry point
    │   ├── ble/
    │   │   ├── BLEManager.ts # CoreBluetooth wrapper
    │   │   └── HRParser.ts   # 0x2A37 bitmasking parser
    │   ├── health/
    │   │   └── HealthKit.ts  # HealthKit write manager
    │   └── components/
    │       ├── HRCard.tsx
    │       ├── ChartCard.tsx
    │       ├── HRVCard.tsx
    │       └── DeviceCard.tsx
    ├── app.json
    └── eas.json
```
