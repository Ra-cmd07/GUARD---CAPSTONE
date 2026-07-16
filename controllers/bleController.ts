import { Request, Response } from 'express';
import pool from '../lib/db';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeMac(value: string): string {
  return value
    .toLowerCase()
    .replace(/:/g, '')
    .replace(/-/g, '')
    .trim();
}

async function fetchBleData(macAddress?: string) {
  const hasFilter = typeof macAddress === 'string' && macAddress.length > 0;
  const normalizedMac = hasFilter ? normalizeMac(macAddress!) : '';
  const whereClause = hasFilter
    ? `WHERE REPLACE(REPLACE(LOWER(mac_address), ':', ''), '-', '') = ?`
    : '';
  const params: any[] = hasFilter ? [normalizedMac] : [];

  const [allRows] = await pool.execute(
    `SELECT id, room_name, mac_address, distance, rssi, timestamp
     FROM BLEPROXY
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT 100`,
    params.length > 0 ? params : undefined
  ) as any[];

  const [uniqueRows] = await pool.execute(
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
  ) as any[];

  return { allRows, uniqueRows };
}

export async function getBleDevices(req: Request, res: Response): Promise<void> {
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
    res.status(500).json({ error: 'Unable to load BLE device data' });
  }
}

export async function uploadBleData(req: Request, res: Response): Promise<void> {
  try {
    const devices = req.body?.devices;
    const roomName = String(req.body?.room_name || req.body?.roomName || 'room1').trim();

    if (!Array.isArray(devices) || devices.length === 0) {
      res.status(400).json({ error: 'devices array is required' });
      return;
    }

    const insertedCount = { value: 0 };
    const rejectedCount = { value: 0 };

    const insertPromises = devices.map(async (device: any) => {
      const macAddress = String(device.mac_address || '').trim();
      const distance = Number(device.distance || 0);
      const rssi = Number(device.rssi || 0);
      const timestamp = String(device.timestamp || new Date().toISOString()).trim();

      if (!macAddress) {
        rejectedCount.value++;
        return;
      }

      try {
        // ✅ FIX: Normalize MAC for comparison (remove colons and dashes)
        const normalizedMac = normalizeMac(macAddress);

        // Check if MAC address is registered in students table
        const [students] = await pool.execute(
          `SELECT id FROM students 
           WHERE REPLACE(REPLACE(LOWER(mac_address), ':', ''), '-', '') = ?`,
          [normalizedMac]
        ) as any[];

        if ((students as any[]).length === 0) {
          console.warn(`MAC ${macAddress} not registered in students table`);
          rejectedCount.value++;
          return;
        }

        // Insert into BLEPROXY only if MAC is registered
        await pool.execute(
          `INSERT INTO BLEPROXY (room_name, mac_address, distance, rssi, timestamp)
           VALUES (?, ?, ?, ?, ?)`,
          [roomName, macAddress, distance, rssi, timestamp]
        );
        insertedCount.value++;
      } catch (err) {
        console.error(`Error processing MAC ${macAddress}:`, err);
        rejectedCount.value++;
      }
    });

    await Promise.all(insertPromises);
    res.status(201).json({
      message: 'BLE proxy data processed',
      roomName,
      inserted: insertedCount.value,
      rejected: rejectedCount.value,
    });
  } catch (err) {
    console.error('uploadBleData error:', err);
    res.status(500).json({ error: 'Unable to save BLE data' });
  }
}

// Track which kiosks are currently scanning for BLE tokens
// Key: kiosk_id, Value: { scanning: boolean, lastUpdate: timestamp }
const kioskScanStatus = new Map<number, { scanning: boolean; lastUpdate: number }>();

/**
 * Get BLE scan status for a kiosk
 * ESP32 polls this to know if it should scan
 */
export async function getScanStatus(req: Request, res: Response): Promise<void> {
  try {
    const kioskId = parseInt(req.query.kiosk_id as string) || 1;
    const now = Date.now();
    
    // Get status for this kiosk
    const status = kioskScanStatus.get(kioskId);
    
    // If no status or too old (>10 seconds), assume not scanning
    if (!status || (now - status.lastUpdate) > 10000) {
      res.json({ scanning: false, kiosk_id: kioskId });
      return;
    }
    
    res.json({ 
      scanning: status.scanning, 
      kiosk_id: kioskId,
      age_ms: now - status.lastUpdate
    });
  } catch (err) {
    console.error('[BLE Scan Status] Error:', err);
    res.status(500).json({ error: 'Failed to get scan status' });
  }
}

/**
 * Set BLE scan status for a kiosk
 * Kiosk calls this when BLE button is clicked or scanning stops
 */
export async function setScanStatus(req: Request, res: Response): Promise<void> {
  try {
    const { kiosk_id, scanning } = req.body;
    
    if (typeof kiosk_id !== 'number' || typeof scanning !== 'boolean') {
      res.status(400).json({ 
        error: 'Invalid request: kiosk_id (number) and scanning (boolean) required' 
      });
      return;
    }
    
    // Update status
    kioskScanStatus.set(kiosk_id, {
      scanning,
      lastUpdate: Date.now()
    });
    
    console.log(`[BLE Scan Status] Kiosk ${kiosk_id}: ${scanning ? 'STARTED' : 'STOPPED'} scanning`);
    
    res.json({ 
      success: true, 
      kiosk_id, 
      scanning,
      message: scanning ? 'BLE scanning enabled' : 'BLE scanning disabled'
    });
  } catch (err) {
    console.error('[BLE Scan Status] Error:', err);
    res.status(500).json({ error: 'Failed to set scan status' });
  }
}

/**
 * ESP32 BLE Token Attendance Detection
 * Receives BLE beacon detection from ESP32 and creates pending attendance
 */
export async function detectBleToken(req: Request, res: Response): Promise<void> {
  try {
    const {
      student_id,
      student_name,
      mac,
      rssi,
      distance,
      kiosk_id,
      gate_name
    } = req.body;

    // Validate required fields
    if (!student_id || !student_name || !mac) {
      res.status(400).json({ 
        error: 'Missing required fields: student_id, student_name, mac' 
      });
      return;
    }

    console.log(`[BLE Token] Detection from ESP32: ${student_name} (${mac}) at ${distance}m`);

    // Check if student exists
    const [students] = await pool.execute(
      `SELECT id, name, grade, section FROM students WHERE id = ?`,
      [student_id]
    ) as any[];

    if ((students as any[]).length === 0) {
      res.status(404).json({ error: 'Student not found in database' });
      return;
    }

    const student = students[0];

    // Check for recent pending detection (last 30 seconds) to prevent duplicates
    // Note: using detected_at (existing column) instead of created_at
    const [recentDetections] = await pool.execute(
      `SELECT id FROM ble_detections 
       WHERE student_id = ? 
       AND status = 'pending' 
       AND detected_at > DATE_SUB(NOW(), INTERVAL 30 SECOND)`,
      [student_id]
    ) as any[];

    if ((recentDetections as any[]).length > 0) {
      console.log(`[BLE Token] Duplicate detection for ${student_name} - ignoring`);
      res.json({ 
        success: true, 
        message: 'Detection already exists (within 30 seconds)',
        duplicate: true
      });
      return;
    }

    // Insert BLE detection record (matching existing table structure)
    // Table has: beacon_id, location_name instead of kiosk_id, gate_name
    const [result] = await pool.execute(
      `INSERT INTO ble_detections 
       (student_id, student_name, mac_address, rssi, beacon_id, location_name, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [student_id, student_name, mac, rssi || null, kiosk_id || 1, gate_name || 'Main Gate']
    ) as any;

    const detectionId = (result as any).insertId;

    console.log(`[BLE Token] ✅ Detection recorded: ID ${detectionId} for ${student_name}`);
    console.log(`[BLE Token] Status: PENDING (waiting for kiosk auto-approval)`);

    res.status(201).json({
      success: true,
      message: 'BLE detection recorded',
      id: detectionId,
      student_id,
      student_name,
      status: 'pending'
    });

  } catch (err) {
    console.error('[BLE Token] Error:', err);
    res.status(500).json({ error: 'Failed to process BLE detection' });
  }
}

export async function getBleDashboard(req: Request, res: Response): Promise<void> {
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
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📡 BLE Device Tracker Dashboard</h1>
            <p class="subtitle">Real-time monitoring of Bluetooth LE devices detected by ESP32</p>
        </header>

        <div class="section">
            <h2>Active Devices (Latest Detection)</h2>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
            ${uniqueRows.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>MAC Address</th>
                        <th>Latest Distance (m)</th>
                        <th>Latest RSSI (dBm)</th>
                        <th>Last Seen</th>
                    </tr>
                </thead>
                <tbody>
                    ${uniqueRows.map((row: any) => `
                        <tr>
                            <td class="mac">${escapeHtml(String(row.mac_address))}</td>
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
                        <th>Distance (m)</th>
                        <th>RSSI (dBm)</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    ${allRows.map((row: any) => `
                        <tr>
                            <td>${escapeHtml(String(row.id))}</td>
                            <td class="mac">${escapeHtml(String(row.mac_address))}</td>
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
