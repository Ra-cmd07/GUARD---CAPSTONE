import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  SafeAreaView, StatusBar, Platform,
} from 'react-native';
import api from '../config/api';
import axios from 'axios';

const TRILAT_BASE = 'http://192.168.1.29:8080';
// Android status bar height offset so header content never hides behind the notch
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

interface LiveAnchor {
  anchor_id: string;
  rssi: number;
  raw_distance: number;
  corrected_distance: number;
  age_s: number;
}

interface CalPoint {
  anchor_id: string;
  known_distance: number;
  rssi: number;
  captured_at: string;
}

interface GroupedCal {
  anchor_id: string;
  points: CalPoint[];
}

type Step = 'list' | 'capture' | 'capturing';

export default function DistanceCalibrationScreen() {
  const [step, setStep]                   = useState<Step>('list');
  const [calData, setCalData]             = useState<CalPoint[]>([]);
  const [loading, setLoading]             = useState(false);
  const [anchorId, setAnchorId]           = useState('');
  const [knownDistance, setKnownDistance] = useState('');
  const [captureSeconds, setCaptureSeconds] = useState('10');
  const [capturing, setCapturing]         = useState(false);
  const [countdown, setCountdown]         = useState(0);
  const [captureResult, setCaptureResult] = useState<{
    anchor_id: string; known_distance: number; observed_rssi: number; sample_count: number;
  } | null>(null);
  const [captureError, setCaptureError]   = useState('');
  const [liveAnchors, setLiveAnchors]     = useState<LiveAnchor[]>([]);
  const [liveLoading, setLiveLoading]     = useState(false);

  const loadCalData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fingerprint/distance-cal');
      setCalData(data);
    } catch {
      Alert.alert('Error', 'Failed to load calibration data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch live anchors from trilateration server
  const fetchLiveAnchors = useCallback(async () => {
    setLiveLoading(true);
    try {
      const { data } = await axios.get(`${TRILAT_BASE}/latest-rssi`, { timeout: 3000 });
      setLiveAnchors(data.anchors || []);
    } catch {
      setLiveAnchors([]);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => { loadCalData(); }, [loadCalData]);

  // Refresh live anchors every 3s while on capture step
  useEffect(() => {
    if (step === 'capture') {
      fetchLiveAnchors();
      const interval = setInterval(fetchLiveAnchors, 3000);
      return () => clearInterval(interval);
    }
  }, [step, fetchLiveAnchors]);

  // Group by anchor_id for display
  const grouped: GroupedCal[] = Object.values(
    calData.reduce((acc: Record<string, GroupedCal>, row) => {
      if (!acc[row.anchor_id]) acc[row.anchor_id] = { anchor_id: row.anchor_id, points: [] };
      acc[row.anchor_id].points.push(row);
      return acc;
    }, {})
  );

  const handleDeleteAnchor = (anchor_id: string) => {
    Alert.alert(
      'Clear Calibration',
      `Delete all calibration points for "${anchor_id}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/fingerprint/distance-cal/${anchor_id}`);
              await loadCalData();
            } catch {
              Alert.alert('Error', 'Failed to delete calibration data');
            }
          },
        },
      ]
    );
  };

  const handleStartCapture = async () => {
    if (!anchorId.trim()) {
      Alert.alert('Required', 'Please select or enter an anchor ID');
      return;
    }
    const dist = parseFloat(knownDistance);
    if (isNaN(dist) || dist <= 0) {
      Alert.alert('Required', 'Please enter a valid distance in metres');
      return;
    }
    const secs = parseInt(captureSeconds, 10) || 10;

    // Check if this anchor is visible in the trilateration server
    const liveAnchor = liveAnchors.find(a => a.anchor_id === anchorId.trim());

    setCapturing(true);
    setCaptureError('');
    setCaptureResult(null);
    setStep('capturing');
    setCountdown(secs);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);

    setTimeout(async () => {
      clearInterval(timer);
      try {
        // If anchor is in trilateration server, fetch fresh RSSI and pass directly
        let directRssi: number | undefined;
        if (liveAnchor) {
          // Fetch the freshest reading right now
          try {
            const { data } = await axios.get(`${TRILAT_BASE}/latest-rssi`, { timeout: 3000 });
            const fresh = (data.anchors as LiveAnchor[]).find(a => a.anchor_id === anchorId.trim());
            if (fresh) directRssi = fresh.rssi;
          } catch { /* use liveAnchor.rssi as fallback */ }
          if (directRssi == null) directRssi = liveAnchor.rssi;
        }

        const payload: any = {
          anchor_id:      anchorId.trim(),
          known_distance: dist,
          seconds:        secs,
        };
        if (directRssi != null) payload.rssi = directRssi;

        const { data } = await api.post('/fingerprint/distance-cal', payload);
        setCaptureResult(data);
        await loadCalData();
      } catch (err: any) {
        setCaptureError(err.response?.data?.error || 'Capture failed. Make sure the anchor is active.');
      } finally {
        setCapturing(false);
      }
    }, secs * 1000);
  };

  // ── List view ─────────────────────────────────────────────────────
  if (step === 'list') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#0f766e" />
        <View style={[styles.header, { paddingTop: STATUS_H + 12 }]}>
          <Text style={styles.headerTitle}>📏 Distance Calibration</Text>
          <Text style={styles.headerSub}>Improve anchor distance accuracy per room</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Stand at a known distance from each anchor and capture. The system will
            learn the real RSSI-to-distance relationship for your environment and
            automatically correct all future distance readings on the live map.
          </Text>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => {
          setCaptureResult(null); setCaptureError(''); setStep('capture');
        }}>
          <Text style={styles.addBtnText}>＋  Add Calibration Point</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#0f766e" />
        ) : grouped.length === 0 ? (
          <Text style={styles.empty}>
            No calibration data yet.{'\n'}Add points for each anchor to enable distance correction.
          </Text>
        ) : (
          <FlatList
            data={grouped}
            keyExtractor={g => g.anchor_id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardAnchor}>📡 {item.anchor_id}</Text>
                  <TouchableOpacity onPress={() => handleDeleteAnchor(item.anchor_id)}>
                    <Text style={styles.deleteBtn}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableHd]}>Distance</Text>
                  <Text style={[styles.tableCell, styles.tableHd]}>Avg RSSI</Text>
                  <Text style={[styles.tableCell, styles.tableHd]}>Captured</Text>
                </View>
                {item.points.map((p, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={styles.tableCell}>{p.known_distance.toFixed(1)} m</Text>
                    <Text style={styles.tableCell}>{Math.round(p.rssi)} dBm</Text>
                    <Text style={[styles.tableCell, { fontSize: 10, color: '#94a3b8' }]}>
                      {new Date(p.captured_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
                <Text style={styles.cardMeta}>{item.points.length} calibration point{item.points.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── Capture setup ─────────────────────────────────────────────────
  if (step === 'capture') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { paddingTop: STATUS_H + 12 }]}>
          <TouchableOpacity onPress={() => setStep('list')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Calibration Point</Text>
        </View>
        <ScrollView contentContainerStyle={styles.form}>

          {/* Live anchor picker from trilateration server */}
          <Text style={styles.label}>Select Anchor *</Text>
          {liveLoading && <ActivityIndicator size="small" color="#0f766e" style={{ marginBottom: 8 }} />}
          {liveAnchors.length > 0 ? (
            <View style={styles.anchorPicker}>
              {liveAnchors.map(a => (
                <TouchableOpacity
                  key={a.anchor_id}
                  style={[styles.anchorBtn, anchorId === a.anchor_id && styles.anchorBtnActive]}
                  onPress={() => setAnchorId(a.anchor_id)}
                >
                  <Text style={[styles.anchorBtnLabel, anchorId === a.anchor_id && styles.anchorBtnLabelActive]}>
                    📡 {a.anchor_id}
                  </Text>
                  <Text style={[styles.anchorBtnRssi, anchorId === a.anchor_id && styles.anchorBtnLabelActive]}>
                    {Math.round(a.rssi)} dBm · {a.raw_distance.toFixed(1)}m raw
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>
              No live anchors detected from trilateration server. Enter manually below.
            </Text>
          )}

          <Text style={styles.label}>Anchor ID (manual fallback)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 3, anchor_2"
            value={anchorId}
            onChangeText={setAnchorId}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            Tap a live anchor above, or type the ID manually if not listed.
          </Text>

          <Text style={styles.label}>Known Distance (metres) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1, 2, 3, 5"
            value={knownDistance}
            onChangeText={setKnownDistance}
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>
            Stand exactly this distance from the anchor before capturing.
            Repeat at 1m, 2m, 3m, 5m for best results.
          </Text>

          <Text style={styles.label}>Capture Window (seconds)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={captureSeconds}
            onChangeText={setCaptureSeconds}
          />

          {captureResult && (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>✅ Saved!</Text>
              <Text style={styles.successText}>
                {captureResult.anchor_id} at {captureResult.known_distance}m{'\n'}
                Observed RSSI: {captureResult.observed_rssi} dBm{'\n'}
                Samples averaged: {captureResult.sample_count}
              </Text>
            </View>
          )}

          {captureError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {captureError}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleStartCapture}>
            <Text style={styles.primaryBtnText}>▶  Start {captureSeconds}s Capture</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Countdown ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, styles.countdownSafe]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f766e" />
      <View style={[styles.countdownContainer, { paddingTop: STATUS_H + 8 }]}>
        <Text style={styles.countdownIcon}>📡</Text>
        <Text style={styles.countdownTitle}>Measuring…</Text>
        <Text style={styles.countdownSub}>{anchorId}  ·  {knownDistance} m away</Text>
        <View style={styles.countdownCircle}>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.countdownSec}>sec</Text>
        </View>
        {capturing ? (
          <Text style={styles.countdownHint}>Stay still at exactly {knownDistance} m from the anchor</Text>
        ) : captureResult ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneText}>
              ✅ Saved!  RSSI = {captureResult.observed_rssi} dBm
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('capture')}>
              <Text style={styles.primaryBtnText}>Add Another Point</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('list')}>
              <Text style={styles.secondaryBtnText}>View All Calibration Data</Text>
            </TouchableOpacity>
          </View>
        ) : captureError ? (
          <View style={styles.doneBox}>
            <Text style={[styles.doneText, { color: '#fca5a5' }]}>⚠️ {captureError}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('capture')}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#f1f5f9' },
  countdownSafe:      { backgroundColor: '#0f766e' },
  header:             { backgroundColor: '#0f766e', paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle:        { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub:          { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 2 },
  back:               { color: '#99f6e4', fontSize: 13, marginBottom: 4 },
  infoBox:            { marginHorizontal: 14, marginBottom: 4, backgroundColor: '#f0fdfa', borderRadius: 9, padding: 11, borderLeftWidth: 3, borderLeftColor: '#0f766e' },
  infoText:           { fontSize: 12, color: '#374151', lineHeight: 18 },
  addBtn:             { marginHorizontal: 14, marginBottom: 6, backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  addBtnText:         { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:              { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 13, paddingHorizontal: 28, lineHeight: 20 },
  anchorPicker:       { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  anchorBtn:          { borderWidth: 1, borderColor: '#0f766e', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fff' },
  anchorBtnActive:    { backgroundColor: '#0f766e' },
  anchorBtnLabel:     { fontSize: 12, fontWeight: '600', color: '#0f766e' },
  anchorBtnRssi:      { fontSize: 10, color: '#64748b', marginTop: 1 },
  anchorBtnLabelActive: { color: '#fff' },
  card:               { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
                        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardAnchor:         { fontSize: 14, fontWeight: '700', color: '#0f766e' },
  deleteBtn:          { color: '#dc2626', fontWeight: '600', fontSize: 12 },
  tableHeader:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 3, marginBottom: 3 },
  tableRow:           { flexDirection: 'row', paddingVertical: 3 },
  tableRowAlt:        { backgroundColor: '#f8fafc' },
  tableCell:          { flex: 1, fontSize: 11, color: '#374151' },
  tableHd:            { fontWeight: '700', color: '#0f766e', fontSize: 10 },
  cardMeta:           { fontSize: 10, color: '#94a3b8', marginTop: 6 },
  form:               { padding: 16 },
  label:              { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 5, marginTop: 14 },
  input:              { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
                        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1e293b' },
  hint:               { fontSize: 11, color: '#94a3b8', marginTop: 5 },
  primaryBtn:         { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 20 },
  primaryBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn:       { backgroundColor: '#e2e8f0', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  secondaryBtnText:   { color: '#374151', fontWeight: '600', fontSize: 14 },
  successBox:         { backgroundColor: '#f0fdf4', borderRadius: 9, padding: 12, marginTop: 14, borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  successTitle:       { fontSize: 13, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  successText:        { fontSize: 12, color: '#374151', lineHeight: 19 },
  errorBox:           { backgroundColor: '#fef2f2', borderRadius: 9, padding: 12, marginTop: 14, borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  errorText:          { fontSize: 12, color: '#dc2626' },
  countdownContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  countdownIcon:      { fontSize: 40, marginBottom: 8 },
  countdownTitle:     { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 2 },
  countdownSub:       { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginBottom: 24 },
  countdownCircle:    { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)',
                        alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  countdownNumber:    { fontSize: 42, fontWeight: '800', color: '#fff' },
  countdownSec:       { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: -4 },
  countdownHint:      { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  doneBox:            { alignItems: 'center', width: '100%' },
  doneText:           { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 18, textAlign: 'center' },
});
