import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  SafeAreaView, StatusBar,
} from 'react-native';
import api from '../config/api';

interface FingerprintLocation {
  id: number;
  label: string;
  description?: string;
  sample_count: number;
  created_at: string;
}

interface CaptureResult {
  location: string;
  anchors_captured: number;
  readings: { anchor_id: string; rssi: number; distance: number }[];
}

type Step = 'list' | 'new_location' | 'capture' | 'capturing';

export default function FingerprintCalibrationScreen() {
  const [step, setStep]                       = useState<Step>('list');
  const [locations, setLocations]             = useState<FingerprintLocation[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [newLabel, setNewLabel]               = useState('');
  const [newDescription, setNewDescription]  = useState('');
  const [selectedLocation, setSelectedLocation] = useState<FingerprintLocation | null>(null);
  const [captureSeconds, setCaptureSeconds]  = useState('10');
  const [capturing, setCapturing]            = useState(false);
  const [captureResult, setCaptureResult]    = useState<CaptureResult | null>(null);
  const [captureError, setCaptureError]      = useState('');
  const [countdown, setCountdown]            = useState(0);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fingerprint/locations');
      setLocations(data);
    } catch {
      Alert.alert('Error', 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  // ── Create new location ───────────────────────────────────────────
  const handleCreateLocation = async () => {
    if (!newLabel.trim()) {
      Alert.alert('Required', 'Please enter a location name');
      return;
    }
    setLoading(true);
    try {
      await api.post('/fingerprint/locations', {
        label: newLabel.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewLabel('');
      setNewDescription('');
      await loadLocations();
      setStep('list');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create location');
    } finally {
      setLoading(false);
    }
  };

  // ── Delete location ───────────────────────────────────────────────
  const handleDelete = (loc: FingerprintLocation) => {
    Alert.alert(
      'Delete Location',
      `Delete "${loc.label}" and all ${loc.sample_count} samples?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/fingerprint/locations/${loc.id}`);
              await loadLocations();
            } catch {
              Alert.alert('Error', 'Failed to delete location');
            }
          },
        },
      ]
    );
  };

  // ── Start capture ─────────────────────────────────────────────────
  const handleStartCapture = async () => {
    if (!selectedLocation) return;
    const secs = parseInt(captureSeconds, 10) || 10;

    setCapturing(true);
    setCaptureError('');
    setCaptureResult(null);
    setStep('capturing');
    setCountdown(secs);

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);

    // Wait for the capture window, then request the backend to save
    setTimeout(async () => {
      clearInterval(timer);
      try {
        const { data } = await api.post('/fingerprint/capture', {
          location_id: selectedLocation.id,
          seconds: secs,
        });
        setCaptureResult(data);
        await loadLocations();
      } catch (err: any) {
        setCaptureError(err.response?.data?.error || 'Capture failed. Make sure ESP32 anchors are active.');
      } finally {
        setCapturing(false);
      }
    }, secs * 1000);
  };

  // ── Render: location list ─────────────────────────────────────────
  if (step === 'list') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📡 Fingerprint Calibration</Text>
          <Text style={styles.headerSub}>Admin only — define room locations</Text>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setStep('new_location')}>
          <Text style={styles.addBtnText}>＋  Add New Location</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1d4ed8" />
        ) : (
          <FlatList
            data={locations}
            keyExtractor={l => String(l.id)}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <Text style={styles.empty}>No locations yet. Add one to start calibrating.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>{item.label}</Text>
                  {item.description ? (
                    <Text style={styles.cardDesc}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.cardMeta}>{item.sample_count} samples collected</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.captureBtn}
                    onPress={() => { setSelectedLocation(item); setCaptureResult(null); setStep('capture'); }}
                  >
                    <Text style={styles.captureBtnText}>Capture</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── Render: new location form ─────────────────────────────────────
  if (step === 'new_location') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('list')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Location</Text>
        </View>
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>Location Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Room 201, Library, Hallway"
            value={newLabel}
            onChangeText={setNewLabel}
            autoFocus
          />
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="e.g. Grade 11 STEM classroom, 2nd floor"
            value={newDescription}
            onChangeText={setNewDescription}
            multiline
          />
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.disabledBtn]}
            onPress={handleCreateLocation}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Save Location</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: capture setup ─────────────────────────────────────────
  if (step === 'capture') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('list')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Capture Fingerprint</Text>
        </View>
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📍 {selectedLocation?.label}</Text>
            <Text style={styles.infoText}>
              Stand at this location now. The system will read RSSI values from
              all active ESP32 anchors over the capture window and save them as
              the fingerprint for this room.
            </Text>
          </View>

          <Text style={styles.label}>Capture Window (seconds)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={captureSeconds}
            onChangeText={setCaptureSeconds}
          />
          <Text style={styles.hint}>
            Longer windows give more readings to average. 10–15 seconds is recommended.
          </Text>

          {captureResult && (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>✅ Captured!</Text>
              <Text style={styles.successText}>
                {captureResult.anchors_captured} anchor{captureResult.anchors_captured !== 1 ? 's' : ''} recorded for {captureResult.location}
              </Text>
              {captureResult.readings.map(r => (
                <Text key={r.anchor_id} style={styles.readingRow}>
                  {r.anchor_id}: RSSI {Math.round(r.rssi)} dBm {r.distance != null ? `· ${r.distance.toFixed(1)}m` : ''}
                </Text>
              ))}
            </View>
          )}

          {captureError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {captureError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleStartCapture}
          >
            <Text style={styles.primaryBtnText}>▶  Start {captureSeconds}s Capture</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Make sure all ESP32 anchor boards are powered on before capturing.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: capturing countdown ───────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, styles.countdownSafe]}>
      <View style={styles.countdownContainer}>
        <Text style={styles.countdownIcon}>📡</Text>
        <Text style={styles.countdownTitle}>Recording…</Text>
        <Text style={styles.countdownLocation}>{selectedLocation?.label}</Text>
        <View style={styles.countdownCircle}>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.countdownSec}>sec</Text>
        </View>
        {capturing ? (
          <Text style={styles.countdownHint}>Stay still at this location</Text>
        ) : captureResult ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneText}>✅ {captureResult.anchors_captured} anchors recorded!</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('capture')}>
              <Text style={styles.primaryBtnText}>Capture Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('list')}>
              <Text style={styles.secondaryBtnText}>Back to Locations</Text>
            </TouchableOpacity>
          </View>
        ) : captureError ? (
          <View style={styles.doneBox}>
            <Text style={styles.errorText}>⚠️ {captureError}</Text>
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
  safe:               { flex: 1, backgroundColor: '#f8fafc' },
  countdownSafe:      { backgroundColor: '#1d4ed8' },
  header:             { backgroundColor: '#1d4ed8', padding: 16, paddingTop: 20 },
  headerTitle:        { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub:          { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  back:               { color: '#93c5fd', fontSize: 14, marginBottom: 4 },
  addBtn:             { margin: 16, backgroundColor: '#1d4ed8', borderRadius: 10, padding: 14, alignItems: 'center' },
  addBtnText:         { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty:              { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  card:               { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12,
                        flexDirection: 'row', alignItems: 'center',
                        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardLabel:          { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cardDesc:           { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardMeta:           { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  cardActions:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  captureBtn:         { backgroundColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  captureBtnText:     { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
  deleteBtn:          { backgroundColor: '#fee2e2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  deleteBtnText:      { color: '#dc2626', fontWeight: '700' },
  form:               { padding: 20 },
  label:              { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  input:              { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
                        borderRadius: 8, padding: 12, fontSize: 14, color: '#1e293b' },
  hint:               { fontSize: 11, color: '#94a3b8', marginTop: 6 },
  primaryBtn:         { backgroundColor: '#1d4ed8', borderRadius: 10, padding: 14,
                        alignItems: 'center', marginTop: 24 },
  primaryBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn:       { backgroundColor: '#e2e8f0', borderRadius: 10, padding: 14,
                        alignItems: 'center', marginTop: 12 },
  secondaryBtnText:   { color: '#374151', fontWeight: '600', fontSize: 15 },
  disabledBtn:        { opacity: 0.6 },
  infoBox:            { backgroundColor: '#eff6ff', borderRadius: 10, padding: 14, borderLeftWidth: 4, borderLeftColor: '#1d4ed8' },
  infoTitle:          { fontSize: 15, fontWeight: '700', color: '#1d4ed8', marginBottom: 6 },
  infoText:           { fontSize: 13, color: '#374151', lineHeight: 20 },
  successBox:         { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, marginTop: 20, borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  successTitle:       { fontSize: 15, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  successText:        { fontSize: 13, color: '#374151', marginBottom: 8 },
  readingRow:         { fontSize: 12, color: '#4b5563', marginTop: 2, fontFamily: 'monospace' },
  errorBox:           { backgroundColor: '#fef2f2', borderRadius: 10, padding: 14, marginTop: 20, borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  errorText:          { fontSize: 13, color: '#dc2626' },
  countdownContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  countdownIcon:      { fontSize: 48, marginBottom: 12 },
  countdownTitle:     { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  countdownLocation:  { fontSize: 15, color: 'rgba(255,255,255,0.75)', marginBottom: 32 },
  countdownCircle:    { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.15)',
                        alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  countdownNumber:    { fontSize: 48, fontWeight: '800', color: '#fff' },
  countdownSec:       { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: -4 },
  countdownHint:      { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  doneBox:            { alignItems: 'center', width: '100%' },
  doneText:           { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 20 },
});
