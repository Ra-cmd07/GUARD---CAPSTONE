"use strict";
/**
 * BLE Positioning Utilities
 * Convert RSSI to distance and calculate position using trilateration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rssiToDistance = rssiToDistance;
exports.calculatePosition = calculatePosition;
exports.calculateOffsetPosition = calculateOffsetPosition;
exports.smoothPosition = smoothPosition;
/**
 * Convert RSSI (signal strength) to distance in meters
 * Formula: distance = 10 ^ ((TxPower - RSSI) / (10 * N))
 *
 * @param rssi - Received Signal Strength Indicator (typically -30 to -100)
 * @param txPower - Transmission power at 1 meter (calibrated: -70 dBm)
 * @param n - Path loss exponent (2-4, depends on environment)
 *
 * CALIBRATED VALUES:
 * - txPower = -70 (measured from actual BLE beacon RSSI=-59 at 0.25m)
 * - n = 2.3 (average of all environments: outdoor 1.8, classroom 2.8, cafeteria 2.2)
 */
function rssiToDistance(rssi, txPower = -70, n = 2.3) {
    if (rssi === 0)
        return -1; // Invalid reading
    const ratio = (txPower - rssi) / (10 * n);
    const distance = Math.pow(10, ratio);
    // Clamp distance to reasonable range (0.1m - 50m)
    return Math.max(0.1, Math.min(distance, 50));
}
/**
 * Calculate position using trilateration from 3+ beacons
 * Uses weighted centroid method for simplicity
 *
 * @param signals - Array of beacon signals with RSSI and coordinates
 */
function calculatePosition(signals) {
    if (signals.length < 1)
        return null;
    // Convert RSSI to distances
    const measurements = signals.map(signal => {
        const [lat, lng] = signal.coordinates.split(',').map(Number);
        const distance = rssiToDistance(signal.rssi);
        // Weight: closer beacons have more influence
        const weight = 1 / Math.pow(distance, 2);
        return { lat, lng, distance, weight };
    }).filter(m => !isNaN(m.lat) && !isNaN(m.lng));
    if (measurements.length === 0)
        return null;
    // Weighted centroid calculation
    const totalWeight = measurements.reduce((sum, m) => sum + m.weight, 0);
    const lat = measurements.reduce((sum, m) => sum + (m.lat * m.weight), 0) / totalWeight;
    const lng = measurements.reduce((sum, m) => sum + (m.lng * m.weight), 0) / totalWeight;
    // Calculate accuracy (average distance to beacons)
    const avgDistance = measurements.reduce((sum, m) => sum + m.distance, 0) / measurements.length;
    return {
        lat: Number(lat.toFixed(7)),
        lng: Number(lng.toFixed(7)),
        accuracy: Math.round(avgDistance)
    };
}
/**
 * Calculate position offset within accuracy circle
 * Places the beacon dot at the actual distance from the anchor
 *
 * Distance zones:
 * - Close: 0-5m (stay very close to anchor)
 * - Within range: 5-15m (medium distance from anchor)
 * - Far: 15m+ (farther from anchor)
 *
 * @param beaconLat - Beacon latitude
 * @param beaconLng - Beacon longitude
 * @param rssi - Signal strength
 * @param previousPosition - Last known position for smoothing
 */
function calculateOffsetPosition(beaconLat, beaconLng, rssi, previousPosition) {
    const distance = rssiToDistance(rssi);
    // If we have previous position, move toward/away from beacon based on actual distance
    if (previousPosition) {
        const deltaLat = previousPosition.lat - beaconLat;
        const deltaLng = previousPosition.lng - beaconLng;
        const currentDistanceMeters = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng) * 111320; // to meters
        // Calculate the direction angle from beacon to previous position
        const angle = Math.atan2(deltaLng, deltaLat);
        // Convert new distance from meters to degrees (approximate)
        const distanceDeg = distance / 111320;
        // Place dot at the actual distance from beacon in the same direction
        // Use high alpha for more responsive distance changes
        const alpha = 0.6; // 60% new position, 40% old position for smooth but responsive movement
        const newLat = beaconLat + Math.cos(angle) * distanceDeg;
        const newLng = beaconLng + Math.sin(angle) * distanceDeg;
        return {
            lat: previousPosition.lat * (1 - alpha) + newLat * alpha,
            lng: previousPosition.lng * (1 - alpha) + newLng * alpha,
            accuracy: Math.round(distance)
        };
    }
    // No previous position: place at distance in a consistent initial direction
    // Use 45-degree angle (northeast) as default starting direction
    const distanceDeg = distance / 111320;
    const angle = Math.PI / 4; // 45 degrees - consistent initial placement
    return {
        lat: beaconLat + Math.cos(angle) * distanceDeg,
        lng: beaconLng + Math.sin(angle) * distanceDeg,
        accuracy: Math.round(distance)
    };
}
/**
 * Smooth position changes to prevent jitter
 * Exponential moving average
 */
function smoothPosition(newPos, oldPos, alpha = 0.3) {
    if (!oldPos)
        return newPos;
    return {
        lat: oldPos.lat * (1 - alpha) + newPos.lat * alpha,
        lng: oldPos.lng * (1 - alpha) + newPos.lng * alpha,
        accuracy: Math.round(oldPos.accuracy * (1 - alpha) + newPos.accuracy * alpha)
    };
}
