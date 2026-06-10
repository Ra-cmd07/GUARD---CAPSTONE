// ============================================================================
// FIXED BLE CONTROLLER - Production Ready Version
// ============================================================================
// Key Changes:
// 1. ✅ Restored student validation
// 2. ✅ Added MAC address format validation
// 3. ✅ Improved timestamp validation
// 4. ✅ Better error handling & reporting
// 5. ✅ Consistent XSS escaping
// ============================================================================

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBleDevices = getBleDevices;
exports.uploadBleData = uploadBleData;
exports.getBleDashboard = getBleDashboard;
const db_1 = __importDefault(require("../lib/db"));

// ─── VALIDATION CONSTANTS ──────────────────────────────────────────────
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
const VALID_ROOMS = ['room1', 'room2', 'room3', 'room4', 'lab_a', 'lab_b'];
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ERRORS_IN_RESPONSE = 5;

// ─── UTILITY FUNCTIONS ─────────────────────────────────────────────────

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeMac(value) {
    return value
        .toLowerCase()
        .replace(/:/g, '')
        .replace(/-/g, '')
        .trim();
}

/**
 * Validate MAC address format
 * @param mac - MAC address to validate
 * @returns true if valid format
 */
function isValidMacFormat(mac) {
    return MAC_ADDRESS_REGEX.test(mac);
}

/**
 * Validate timestamp is within acceptable range
 * @param timestamp - ISO timestamp string
 * @returns object with valid boolean and error message if invalid
 */
function validateTimestamp(timestamp) {
    try {
        const deviceTime = new Date(timestamp);
        const now = new Date();
        const timeDiff = Math.abs(now.getTime() - deviceTime.getTime());

        // Reject timestamps older than tolerance
        if (timeDiff > TIMESTAMP_TOLERANCE_MS) {
            return {
                valid: false,
                error: `Timestamp too old/future: ${timeDiff}ms difference`,
                useServerTime: true
            };
        }

        return { valid: true };
    } catch (err) {
        return {
            valid: false,
            error: 'Invalid timestamp format',
            useServerTime: true
        };
    }
}

/**
 * Validate room name is in allowed list
 * @param room - Room name to validate
 * @returns true if valid
 */
function isValidRoom(room) {
    return VALID_ROOMS.includes(room.toLowerCase());
}

/**
 * Check if device MAC is registered to a student
 * @param macAddress - Normalized MAC address
 * @returns Promise<boolean> true if student found
 */
async function isRegisteredDevice(macAddress) {
    try {
        const [results] = await db_1.default.execute(
            `SELECT id FROM Students 
             WHERE LOWER(REPLACE(REPLACE(ble_device_mac, ':', ''), '-', '')) = ? 
             AND status = 'active'
             LIMIT 1`,
            [normalizeMac(macAddress)]
        );
        
        return Array.isArray(results) && results.length > 0;
    } catch (err) {
        console.error(`❌ Database error checking student registration:`, err);
        // Fail secure - reject if we can't verify
        return false;
    }
}

// ─── MAIN FUNCTIONS ────────────────────────────────────────────────────

async function fetchBleData(macAddress) {
    const hasFilter = typeof macAddress === 'string' && macAddress.length > 0;
    const normalizedMac = hasFilter ? normalizeMac(macAddress) : '';
    const whereClause = hasFilter
        ? `WHERE REPLACE(REPLACE(LOWER(mac_address), ':', ''), '-', '') = ?`
        : '';
    const params = hasFilter ? [normalizedMac] : [];

    const [allRows] = await db_1.default.execute(
        `SELECT id, room_name, mac_address, distance, rssi, timestamp
         FROM BLEPROXY
         ${whereClause}
         ORDER BY timestamp DESC
         LIMIT 100`,
        params.length > 0 ? params : undefined
    );

    const [uniqueRows] = await db_1.default.execute(
        `SELECT d.room_name,
                d.mac_address,
                d.distance AS latest_distance,
                d.rssi AS latest_rssi,
                d.timestamp AS last_seen
         FROM BLEPROXY d
         JOIN (
           SELECT mac_address, MAX(timestamp) AS last_seen
           FROM BLEPROXY
           ${whereClause}
           GROUP BY mac_address
         ) m ON d.mac_address = m.mac_address AND d.timestamp = m.last_seen
         ORDER BY d.timestamp DESC`,
        params.length > 0 ? params : undefined
    );

    return { allRows, uniqueRows };
}

/**
 * Get BLE devices with optional MAC filter
 */
async function getBleDevices(req, res) {
    try {
        const macFilter = typeof req.query.mac === 'string'
            ? req.query.mac.trim()
            : undefined;

        const { allRows, uniqueRows } = await fetchBleData(macFilter);

        res.json({
            filterMac: macFilter || null,
            totalRecords: allRows.length,
            uniqueDevices: uniqueRows.length,
            records: allRows,
            latestDevices: uniqueRows,
        });
    } catch (err) {
        console.error('getBleDevices error:', err);
        res.status(500).json({ 
            error: 'Unable to load BLE device data',
            message: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}

/**
 * ✅ FIXED VERSION - Upload BLE data with full validation
 * 
 * Changes:
 * - ✅ Validates MAC address format
 * - ✅ Checks student registration
 * - ✅ Validates room name
 * - ✅ Validates timestamp freshness
 * - ✅ Better error reporting
 */
async function uploadBleData(req, res) {
    try {
        const devices = req.body?.devices;
        const roomName = String(req.body?.room_name || req.body?.roomName || 'room1').trim();

        // ─── VALIDATION 1: Check input structure ───────────────────────
        if (!Array.isArray(devices) || devices.length === 0) {
            return res.status(400).json({ 
                error: 'Invalid request',
                details: 'devices array is required and must not be empty'
            });
        }

        // ─── VALIDATION 2: Check room name ──────────────────────────────
        if (!isValidRoom(roomName)) {
            return res.status(400).json({
                error: 'Invalid room name',
                provided: roomName,
                validRooms: VALID_ROOMS
            });
        }

        const insertedCount = { value: 0 };
        const rejectedCount = { value: 0 };
        const warnings = [];
        const errors = [];

        // ─── PROCESS DEVICES ───────────────────────────────────────────
        const insertPromises = devices.map(async (device) => {
            const macAddress = String(device.mac_address || '').trim().toUpperCase();
            const distance = device.distance !== undefined ? Number(device.distance) : null;
            const rssi = device.rssi !== undefined ? Number(device.rssi) : null;
            let timestamp = device.timestamp || new Date().toISOString();

            // ─── Check 1: MAC Format ──────────────────────────────────
            if (!isValidMacFormat(macAddress)) {
                console.warn(`❌ Invalid MAC format: ${device.mac_address}`);
                rejectedCount.value++;
                if (errors.length < MAX_ERRORS_IN_RESPONSE) {
                    errors.push({
                        type: 'invalid_mac_format',
                        value: device.mac_address,
                        expected: 'XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX'
                    });
                }
                return;
            }

            // ─── Check 2: Timestamp Validation ───────────────────────
            const tsValidation = validateTimestamp(timestamp);
            if (!tsValidation.valid) {
                console.warn(`⚠️  Timestamp issue: ${tsValidation.error}`);
                if (tsValidation.useServerTime) {
                    timestamp = new Date().toISOString();
                    warnings.push({
                        device: macAddress,
                        issue: 'timestamp_corrected',
                        detail: tsValidation.error
                    });
                } else {
                    rejectedCount.value++;
                    if (errors.length < MAX_ERRORS_IN_RESPONSE) {
                        errors.push({
                            type: 'invalid_timestamp',
                            device: macAddress,
                            detail: tsValidation.error
                        });
                    }
                    return;
                }
            }

            // ─── Check 3: Student Registration ──────────────────────
            const isRegistered = await isRegisteredDevice(macAddress);
            if (!isRegistered) {
                console.warn(`⚠️  Unregistered device: ${macAddress}`);
                rejectedCount.value++;
                if (errors.length < MAX_ERRORS_IN_RESPONSE) {
                    errors.push({
                        type: 'device_not_registered',
                        mac: macAddress,
                        detail: 'Device not linked to any active student'
                    });
                }
                return;
            }

            // ─── Insert into Database ───────────────────────────────
            try {
                await db_1.default.execute(
                    `INSERT INTO BLEPROXY (room_name, mac_address, distance, rssi, timestamp)
                     VALUES (?, ?, ?, ?, ?)`,
                    [roomName, macAddress, distance, rssi, timestamp]
                );

                insertedCount.value++;
                console.log(`✅ Inserted BLE device: ${macAddress} in ${roomName}`);

            } catch (dbErr) {
                console.error(`❌ Database insert error for MAC ${macAddress}:`, dbErr);
                rejectedCount.value++;
                if (errors.length < MAX_ERRORS_IN_RESPONSE) {
                    errors.push({
                        type: 'database_error',
                        mac: macAddress,
                        detail: dbErr instanceof Error ? dbErr.message : 'Unknown error'
                    });
                }
            }
        });

        await Promise.all(insertPromises);

        // ─── BUILD RESPONSE ────────────────────────────────────────────
        const response = {
            status: 'success',
            message: 'BLE proxy data processed',
            summary: {
                room: roomName,
                total_devices: devices.length,
                inserted: insertedCount.value,
                rejected: rejectedCount.value,
                success_rate: ((insertedCount.value / devices.length) * 100).toFixed(1) + '%'
            },
            timestamp: new Date().toISOString()
        };

        if (warnings.length > 0) {
            response.warnings = warnings.slice(0, MAX_ERRORS_IN_RESPONSE);
        }

        if (errors.length > 0) {
            response.errors = errors;
        }

        const httpStatus = insertedCount.value > 0 ? 201 : 400;
        res.status(httpStatus).json(response);

    } catch (err) {
        console.error('uploadBleData error:', err);
        res.status(500).json({
            status: 'error',
            error: 'Unable to save BLE data',
            message: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Display BLE tracker dashboard with optional MAC filter
 */
async function getBleDashboard(req, res) {
    try {
        const macFilter = typeof req.query.mac === 'string'
            ? req.query.mac.trim()
            : undefined;

        const { allRows, uniqueRows } = await fetchBleData(macFilter);
        const uniqueCount = uniqueRows.length;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BLE Device Tracker Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        header {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            font-size: 14px;
        }
        .section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .section h2 {
            color: #333;
            margin-bottom: 20px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        thead {
            background: #667eea;
            color: white;
        }
        th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
        }
        tbody tr:hover {
            background: #f8f9ff;
        }
        .mac {
            font-family: 'Courier New', monospace;
            font-weight: 600;
            color: #667eea;
        }
        .distance {
            font-weight: 600;
            color: #27ae60;
        }
        .rssi {
            font-weight: 600;
            color: #e74c3c;
        }
        .timestamp {
            color: #999;
            font-size: 13px;
        }
        .empty {
            text-align: center;
            padding: 40px;
            color: #999;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .stat-card h3 {
            margin-bottom: 10px;
            opacity: 0.9;
            font-size: 14px;
        }
        .stat-card .value {
            font-size: 32px;
            font-weight: bold;
        }
        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .refresh-btn:hover {
            background: #5568d3;
        }
        .alert {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
            color: #856404;
        }
        .alert.error {
            background: #f8d7da;
            border-left-color: #dc3545;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📡 BLE Device Tracker Dashboard</h1>
            <p class="subtitle">Real-time monitoring of Bluetooth LE devices detected by ESP32</p>
        </header>

        ${macFilter ? `
            <div class="section alert">
                Filtering by MAC: <code>${escapeHtml(macFilter)}</code>
                <a href="/api/ble/dashboard" style="margin-left: 20px;">Clear filter</a>
            </div>
        ` : ''}

        <div class="section">
            <h2>Active Devices (Latest Detection)</h2>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
            ${uniqueRows.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>MAC Address</th>
                        <th>Room</th>
                        <th>Latest Distance (m)</th>
                        <th>Latest RSSI (dBm)</th>
                        <th>Last Seen</th>
                    </tr>
                </thead>
                <tbody>
                    ${uniqueRows.map((row) => `
                        <tr>
                            <td class="mac">${escapeHtml(String(row.mac_address))}</td>
                            <td>${escapeHtml(String(row.room_name))}</td>
                            <td class="distance">${Number(row.latest_distance).toFixed(2)}</td>
                            <td class="rssi">${escapeHtml(String(row.latest_rssi))}</td>
                            <td class="timestamp">${escapeHtml(String(row.last_seen))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : `<p class="empty">No devices found yet. Waiting for ESP32 to send data...</p>`}
        </div>

        <div class="section">
            <h2>All Records (Last 100)</h2>
            <div class="stats">
                <div class="stat-card">
                    <h3>Total Records</h3>
                    <div class="value">${allRows.length}</div>
                </div>
                <div class="stat-card">
                    <h3>Unique Devices</h3>
                    <div class="value">${uniqueCount}</div>
                </div>
            </div>
            ${allRows.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>MAC Address</th>
                        <th>Room</th>
                        <th>Distance (m)</th>
                        <th>RSSI (dBm)</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    ${allRows.map((row) => `
                        <tr>
                            <td>${escapeHtml(String(row.id))}</td>
                            <td class="mac">${escapeHtml(String(row.mac_address))}</td>
                            <td>${escapeHtml(String(row.room_name))}</td>
                            <td class="distance">${Number(row.distance).toFixed(2)}</td>
                            <td class="rssi">${escapeHtml(String(row.rssi))}</td>
                            <td class="timestamp">${escapeHtml(String(row.timestamp))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : `<p class="empty">No records found yet.</p>`}
        </div>
    </div>
</body>
</html>`;

        res.type('html').send(html);

    } catch (err) {
        console.error('getBleDashboard error:', err);
        res.status(500).send('Unable to load BLE tracker dashboard');
    }
}