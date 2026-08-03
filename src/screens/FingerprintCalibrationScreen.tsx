import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  SafeAreaView, StatusBar, Dimensions, Platform,
} from 'react-native';
import api from '../config/api';

const { width: SW } = Dimensions.get('window');
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

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

  const handleCreateLocation = async () => {
    if (!newLabel.trim()) { Alert.alert('Required', 'Please enter a location name'); return; }
    setLoading(true);
    try {
      await api.post('/fingerprint/locations', {
        label: newLabel.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewLabel(''); setNewDescription('');
      await loadLocations();
      setStep('list');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create location');
    } finally { setLoading(false); }
  };

  const handleDelete = (loc: FingerprintLocation) => {
    Alert.alert('Delete', `Delete "${loc.label}" and all ${loc.sample_count} samples?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/fingerprint/locations/${loc.id}`); await loadLocations(); }
        catch { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  const handleStartCapture = async () => {
    if (!selectedLocation) return;
    const secs = parseInt(captureSeconds, 10) || 10;
    setCapturing(true); setCaptureError(''); setCaptureResult(null);
    setStep('capturing'); setCountdown(secs);
    const timer = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
    }, 1000);
    setTimeout(async () => {
      clearInterval(timer);
      try {
        const { data } = await api.post('/fingerprint/capture', { location_id: selectedLocation.id, seconds: secs });
        setCaptureResult(data); await loadLocations();
      } catch (err: any) {
        setCaptureError(err.response?.data?.error || 'Capture failed. Make sure anchors are active.');
      } finally { setCapturing(false); }
    }, secs * 1000);
  };

  // ── List ──────────────────────────────────────────────────────────
  if (step === 'list') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
        <View style={[s.hdr, { paddingTop: STATUS_H + 12 }]}>
          <Text style={s.hdrTitle}>📡 Room Fingerprint</Text>
          <Text style={s.hdrSub}>Admin only — calibrate room locations</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setStep('new_location')}>
          <Text style={s.addBtnTxt}>＋  Add New Location</Text>
        </TouchableOpacity>
        {loading
          ? <ActivityIndicator style={{ marginTop: 24 }} color="#1d4ed8" />
          : <FlatList
              data={locations}
              keyExtractor={l => String(l.id)}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }}
              ListEmptyComponent={<Text style={s.empty}>No locations yet.{'\n'}Add one to start calibrating.</Text>}
              renderItem={({ item }) => (
                <View style={s.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardLabel}>{item.label}</Text>
                    {item.description ? <Text style={s.cardDesc}>{item.description}</Text> : null}
                    <Text style={s.cardMeta}>{item.sample_count} sample{item.sample_count !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={s.cardBtns}>
                    <TouchableOpacity style={s.capBtn}
                      onPress={() => { setSelectedLocation(item); setCaptureResult(null); setStep('capture'); }}>
                      <Text style={s.capBtnTxt}>Capture</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(item)}>
                      <Text style={s.delBtnTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
        }
      </SafeAreaView>
    );
  }

  // ── New Location ──────────────────────────────────────────────────
  if (step === 'new_location') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.hdr, { paddingTop: STATUS_H + 12 }]}>
          <TouchableOpacity onPress={() => setStep('list')}>
            <Text style={s.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.hdrTitle}>New Location</Text>
        </View>
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <Text style={s.lbl}>Location Name *</Text>
          <TextInput style={s.input} placeholder="e.g. Room 201, Library"
            value={newLabel} onChangeText={setNewLabel} autoFocus />
          <Text style={s.lbl}>Description (optional)</Text>
          <TextInput style={[s.input, { height: 72 }]}
            placeholder="e.g. Grade 11 STEM classroom"
            value={newDescription} onChangeText={setNewDescription} multiline />
          <TouchableOpacity style={[s.primaryBtn, loading && s.disabledBtn]}
            onPress={handleCreateLocation} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnTxt}>Save Location</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Capture Setup ─────────────────────────────────────────────────
  if (step === 'capture') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.hdr, { paddingTop: STATUS_H + 12 }]}>
          <TouchableOpacity onPress={() => setStep('list')}>
            <Text style={s.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.hdrTitle}>Capture Fingerprint</Text>
        </View>
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>📍 {selectedLocation?.label}</Text>
            <Text style={s.infoTxt}>Stand here now. The system reads RSSI from all active anchors over the capture window.</Text>
          </View>
          <Text style={s.lbl}>Window (seconds)</Text>
          <TextInput style={s.input} keyboardType="numeric"
            value={captureSeconds} onChangeText={setCaptureSeconds} />
          {captureResult && (
            <View style={s.successBox}>
              <Text style={s.successTitle}>✅ {captureResult.anchors_captured} anchor{captureResult.anchors_captured !== 1 ? 's' : ''} recorded</Text>
              {captureResult.readings.map(r => (
                <Text key={r.anchor_id} style={s.readingRow}>
                  {r.anchor_id}: {Math.round(r.rssi)} dBm{r.distance != null ? ` · ${r.distance.toFixed(1)}m` : ''}
                </Text>
              ))}
            </View>
          )}
          {captureError ? <View style={s.errBox}><Text style={s.errTxt}>⚠️ {captureError}</Text></View> : null}
          <TouchableOpacity style={s.primaryBtn} onPress={handleStartCapture}>
            <Text style={s.primaryBtnTxt}>▶  Start {captureSeconds}s Capture</Text>
          </TouchableOpacity>
          <Text style={s.hint}>Make sure all ESP32 anchors are powered on.</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Counting Down ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, s.cdSafe]}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <View style={[s.cdContainer, { paddingTop: STATUS_H + 8 }]}>
        <Text style={s.cdIcon}>📡</Text>
        <Text style={s.cdTitle}>Recording…</Text>
        <Text style={s.cdLoc}>{selectedLocation?.label}</Text>
        <View style={s.cdCircle}>
          <Text style={s.cdNum}>{countdown}</Text>
          <Text style={s.cdSec}>sec</Text>
        </View>
        {capturing
          ? <Text style={s.cdHint}>Stay still at this location</Text>
          : captureResult
            ? <View style={s.doneBox}>
                <Text style={s.doneTxt}>✅ {captureResult.anchors_captured} anchors recorded!</Text>
                <TouchableOpacity style={s.primaryBtn} onPress={() => setStep('capture')}>
                  <Text style={s.primaryBtnTxt}>Capture Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secBtn} onPress={() => setStep('list')}>
                  <Text style={s.secBtnTxt}>Back to Locations</Text>
                </TouchableOpacity>
              </View>
            : captureError
              ? <View style={s.doneBox}>
                  <Text style={s.errTxt}>⚠️ {captureError}</Text>
                  <TouchableOpacity style={s.primaryBtn} onPress={() => setStep('capture')}>
                    <Text style={s.primaryBtnTxt}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              : null
        }
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#f1f5f9' },
  cdSafe:       { backgroundColor: '#1d4ed8' },
  hdr:          { backgroundColor: '#1d4ed8', paddingHorizontal: 16, paddingBottom: 12 },
  hdrTitle:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  hdrSub:       { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 2 },
  back:         { color: '#93c5fd', fontSize: 13, marginBottom: 4 },
  addBtn:       { margin: 14, backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  addBtnTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:        { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 13, lineHeight: 20 },
  card:         { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
                  flexDirection: 'row', alignItems: 'center',
                  shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardLabel:    { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  cardDesc:     { fontSize: 11, color: '#64748b', marginTop: 1 },
  cardMeta:     { fontSize: 10, color: '#94a3b8', marginTop: 3 },
  cardBtns:     { flexDirection: 'row', gap: 6 },
  capBtn:       { backgroundColor: '#dbeafe', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  capBtnTxt:    { color: '#1d4ed8', fontWeight: '600', fontSize: 12 },
  delBtn:       { backgroundColor: '#fee2e2', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  delBtnTxt:    { color: '#dc2626', fontWeight: '700', fontSize: 12 },
  form:         { padding: 16 },
  lbl:          { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 5, marginTop: 14 },
  input:        { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
                  borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: '#1e293b' },
  hint:         { fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
  primaryBtn:   { backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 13,
                  alignItems: 'center', marginTop: 20 },
  primaryBtnTxt:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  secBtn:       { backgroundColor: '#e2e8f0', borderRadius: 10, paddingVertical: 13,
                  alignItems: 'center', marginTop: 10, width: SW * 0.7 },
  secBtnTxt:    { color: '#374151', fontWeight: '600', fontSize: 14 },
  disabledBtn:  { opacity: 0.6 },
  infoBox:      { backgroundColor: '#eff6ff', borderRadius: 9, padding: 12, borderLeftWidth: 3, borderLeftColor: '#1d4ed8' },
  infoTitle:    { fontSize: 14, fontWeight: '700', color: '#1d4ed8', marginBottom: 4 },
  infoTxt:      { fontSize: 12, color: '#374151', lineHeight: 18 },
  successBox:   { backgroundColor: '#f0fdf4', borderRadius: 9, padding: 12, marginTop: 14, borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  successTitle: { fontSize: 13, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  readingRow:   { fontSize: 11, color: '#4b5563', marginTop: 2, fontFamily: 'monospace' },
  errBox:       { backgroundColor: '#fef2f2', borderRadius: 9, padding: 12, marginTop: 14, borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  errTxt:       { fontSize: 12, color: '#dc2626' },
  cdContainer:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  cdIcon:       { fontSize: 40, marginBottom: 8 },
  cdTitle:      { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 2 },
  cdLoc:        { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginBottom: 24 },
  cdCircle:     { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  cdNum:        { fontSize: 42, fontWeight: '800', color: '#fff' },
  cdSec:        { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: -4 },
  cdHint:       { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  doneBox:      { alignItems: 'center', width: '100%' },
  doneTxt:      { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 16 },
});
