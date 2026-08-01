import { Request, Response } from 'express';
import pool from '../lib/db';
import { AuthRequest } from '../middleware/authMiddleware';

// ─── GET /api/fingerprint/locations ──────────────────────────────────
// List all calibrated locations
export async function getLocations(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(
      `SELECT fl.id, fl.label, fl.description, fl.created_at,
              COUNT(fs.id) AS sample_count
       FROM fingerprint_locations fl
       LEFT JOIN fingerprint_samples fs ON fs.location_id = fl.id
       GROUP BY fl.id
       ORDER BY fl.label`
    ) as any[];
    res.json(rows);
  } catch (err) {
    console.error('getLocations error:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
}

// ─── POST /api/fingerprint/locations ─────────────────────────────────
// Create or upsert a location label (admin only)
export async function createLocation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { label, description } = req.body;
    if (!label?.trim()) {
      res.status(400).json({ error: 'label is required' });
      return;
    }

    const [result] = await pool.query(
      `INSERT INTO fingerprint_locations (label, description, created_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [label.trim(), description || null, req.user!.id]
    ) as any[];

    // Get the id (insertId or existing)
    let locationId = (result as any).insertId;
    if (!locationId) {
      const [existing] = await pool.query(
        `SELECT id FROM fingerprint_locations WHERE label = ?`, [label.trim()]
      ) as any[];
      locationId = (existing as any[])[0]?.id;
    }

    res.status(201).json({ id: locationId, label: label.trim(), message: 'Location saved' });
  } catch (err) {
    console.error('createLocation error:', err);
    res.status(500).json({ error: 'Failed to create location' });
  }
}

// ─── POST /api/fingerprint/capture ───────────────────────────────────
// Admin triggers a capture: reads last N seconds of BLEPROXY data
// and saves them as fingerprint samples for the given location.
// The admin stands at the reference point, taps Capture in the app,
// and the ESP32 anchors' recent readings are stored as the fingerprint.
export async function captureFingerprint(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { location_id, seconds = 10 } = req.body;

    if (!location_id) {
      res.status(400).json({ error: 'location_id is required' });
      return;
    }

    // Verify location exists
    const [locRows] = await pool.query(
      `SELECT id, label FROM fingerprint_locations WHERE id = ?`, [location_id]
    ) as any[];
    if (!(locRows as any[]).length) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    // Pull the most recent BLEPROXY readings within the capture window
    const [bleRows] = await pool.query(
      `SELECT room_name AS anchor_id,
              AVG(rssi)     AS rssi,
              AVG(distance) AS distance
       FROM BLEPROXY
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? SECOND)
       GROUP BY room_name`,
      [seconds]
    ) as any[];

    if (!(bleRows as any[]).length) {
      res.status(422).json({
        error: 'No BLE anchor readings found in the last window. Make sure anchors are active.',
      });
      return;
    }

    // Insert one sample row per anchor
    const insertValues = (bleRows as any[]).map((r: any) => [
      location_id, r.anchor_id, r.rssi, r.distance,
    ]);

    for (const vals of insertValues) {
      await pool.query(
        `INSERT INTO fingerprint_samples (location_id, anchor_id, rssi, distance)
         VALUES (?, ?, ?, ?)`,
        vals
      );
    }

    console.log(`[Fingerprint] Captured ${insertValues.length} anchor readings for location ${(locRows as any[])[0].label}`);

    res.status(201).json({
      message: 'Fingerprint captured',
      location: (locRows as any[])[0].label,
      anchors_captured: insertValues.length,
      readings: bleRows,
    });
  } catch (err) {
    console.error('captureFingerprint error:', err);
    res.status(500).json({ error: 'Failed to capture fingerprint' });
  }
}

// ─── DELETE /api/fingerprint/locations/:id ────────────────────────────
// Delete a location and all its samples (admin only)
export async function deleteLocation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM fingerprint_locations WHERE id = ?', [id]);
    res.json({ success: true, message: 'Location and samples deleted' });
  } catch (err) {
    console.error('deleteLocation error:', err);
    res.status(500).json({ error: 'Failed to delete location' });
  }
}

// ─── GET /api/fingerprint/locations/:id/samples ───────────────────────
// View samples for a location (for review/debugging)
export async function getLocationSamples(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT anchor_id, rssi, distance, captured_at
       FROM fingerprint_samples
       WHERE location_id = ?
       ORDER BY captured_at DESC
       LIMIT 200`,
      [id]
    ) as any[];
    res.json(rows);
  } catch (err) {
    console.error('getLocationSamples error:', err);
    res.status(500).json({ error: 'Failed to fetch samples' });
  }
}

// ─── POST /api/fingerprint/predict ───────────────────────────────────
// Given current BLEPROXY readings, predict which location the person is in.
// Uses k-NN with Euclidean distance on RSSI vectors.
export async function predictLocation(req: Request, res: Response): Promise<void> {
  try {
    const secondsWindow = Number(req.query.seconds) || 10;

    // Get current live readings averaged per anchor
    const [liveRows] = await pool.query(
      `SELECT room_name AS anchor_id, AVG(rssi) AS rssi
       FROM BLEPROXY
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? SECOND)
       GROUP BY room_name`,
      [secondsWindow]
    ) as any[];

    if (!(liveRows as any[]).length) {
      res.status(422).json({ error: 'No live BLE readings available for prediction' });
      return;
    }

    // Build live RSSI vector keyed by anchor_id
    const liveVector: Record<string, number> = {};
    for (const r of liveRows as any[]) {
      liveVector[r.anchor_id] = r.rssi;
    }

    // Load all fingerprint samples averaged per location+anchor
    const [fpRows] = await pool.query(
      `SELECT fs.location_id, fl.label, fs.anchor_id, AVG(fs.rssi) AS rssi
       FROM fingerprint_samples fs
       JOIN fingerprint_locations fl ON fl.id = fs.location_id
       GROUP BY fs.location_id, fs.anchor_id`
    ) as any[];

    if (!(fpRows as any[]).length) {
      res.status(422).json({ error: 'No fingerprint data trained yet. Run calibration first.' });
      return;
    }

    // Group fingerprint vectors by location
    const locationVectors: Record<number, { label: string; vector: Record<string, number> }> = {};
    for (const fp of fpRows as any[]) {
      if (!locationVectors[fp.location_id]) {
        locationVectors[fp.location_id] = { label: fp.label, vector: {} };
      }
      locationVectors[fp.location_id].vector[fp.anchor_id] = fp.rssi;
    }

    // Compute Euclidean distance between live vector and each location vector
    // Use -100 dBm as default for missing anchors (very weak / not detected)
    const DEFAULT_RSSI = -100;
    const allAnchors = new Set<string>([
      ...Object.keys(liveVector),
      ...(fpRows as any[]).map((r: any) => r.anchor_id as string),
    ]);

    let bestLocationId: number | null = null;
    let bestLabel = 'Unknown';
    let bestDistance = Infinity;

    for (const [locIdStr, loc] of Object.entries(locationVectors)) {
      let sumSq = 0;
      for (const anchor of allAnchors) {
        const live = liveVector[anchor] ?? DEFAULT_RSSI;
        const fp   = loc.vector[anchor]  ?? DEFAULT_RSSI;
        sumSq += (live - fp) ** 2;
      }
      const dist = Math.sqrt(sumSq);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestLocationId = Number(locIdStr);
        bestLabel = loc.label;
      }
    }

    res.json({
      predicted_location: bestLabel,
      location_id: bestLocationId,
      confidence_distance: Math.round(bestDistance * 10) / 10,
      live_anchors: liveRows,
    });
  } catch (err) {
    console.error('predictLocation error:', err);
    res.status(500).json({ error: 'Failed to predict location' });
  }
}
