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
