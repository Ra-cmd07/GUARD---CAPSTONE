import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  SafeAreaView, StatusBar, Platform,
} from 'react-native';
import api from '../config/api';
import axios from 'axios';

const TRILAT_BASE = 'http://192.168.1.29:8080';
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

interface LiveAnchor { anchor_id: string; rssi: number; corrected_distance: number; age_s: number; }
interface RoomZone {
  id: number; room_name: string; anchor_id: string;
  inside_rssi: number; doorway_rssi: number; outside_rssi: number;
  doorway_distance_m: number; created_at: string;
}

type CaptureStep = 'inside' | 'doorway' | 'outside';
type Step = 'list' | 'new_zone' | 'capture_inside' | 'capture_doorway' | 'capture_outside' | 'review';

export default function RoomZoneScreen() {
  const [step, setStep]           = useState<Step>('list');
  const [zones, setZones]         = useState<RoomZone[]>([]);
  const [loading, setLoading]     = useState(false);
  const [roomName, setRoomName]   = useState('');
  const [anchorId, setAnchorId]   = useState('');
  const [liveAnchors, setLiveAnchors] = useState<LiveAnchor[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [insideRssi, setInsideRssi]   = useState<number | null>(null);
  const [doorwayRssi, setDoorwayRssi] = useState<number | null>(null);
  const [outsideRssi, setOutsideRssi] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [saveResult, setSaveResult] = useState<any>(null);
  const [saveError, setSaveError] = useState('');

  const loadZones = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/fingerprint/room-zones'); setZones(data); }
    catch { Alert.alert('Error', 'Failed to load zones'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadZones(); }, [loadZones]);

  const fetchLiveAnchors = useCallback(async () => {
    setLiveLoading(true);
    try {
      const { data } = await axios.get(`${TRILAT_BASE}/latest-rssi`, { timeout: 3000 });
      setLiveAnchors(data.anchors || []);
    } catch { setLiveAnchors([]); }
    finally { setLiveLoading(false); }
  }, []);

  useEffect(() => {
    const steps: Step[] = ['capture_inside', 'capture_doorway', 'capture_outside'];
    if (steps.includes(step)) {
      fetchLiveAnchors();
      const id = setInterval(fetchLiveAnchors, 3000);
      return () => clearInterval(id);
    }
  }, [step, fetchLiveAnchors]);

  const doCapture = async (which: CaptureStep) => {
    if (!anchorId.trim()) { Alert.alert('Select anchor first'); return; }
    setCapturing(true); setCountdown(8);
    const timer = setInterval(() => setCountdown(p => { if (p <= 1) { clearInterval(timer); return 0; } return p - 1; }), 1000);
    setTimeout(async () => {
      clearInterval(timer);
      try {
        const { data } = await axios.get(`${TRILAT_BASE}/latest-rssi`, { timeout: 3000 });
        const anchor = (data.anchors as LiveAnchor[]).find(a => a.anchor_id === anchorId.trim());
        if (!anchor) { Alert.alert('Anchor not found', `No reading from anchor "${anchorId}" — is it active?`); }
        else {
          if (which === 'inside')   setInsideRssi(anchor.rssi);
          if (which === 'doorway')  setDoorwayRssi(anchor.rssi);
          if (which === 'outside')  setOutsideRssi(anchor.rssi);
        }
      } catch { Alert.alert('Error', 'Failed to read anchor RSSI'); }
      finally { setCapturing(false); }
    }, 8000);
  };

  const handleSave = async () => {
    if (!roomName.trim() || !anchorId.trim() || insideRssi == null || doorwayRssi == null || outsideRssi == null) {
      Alert.alert('Incomplete', 'All three positions must be captured before saving.'); return;
    }
    setLoading(true); setSaveError('');
    try {
      const { data } = await api.post('/fingerprint/room-zones', {
        room_name: roomName.trim(), anchor_id: anchorId.trim(),
        inside_rssi: insideRssi, doorway_rssi: doorwayRssi, outside_rssi: outsideRssi,
      });
      setSaveResult(data);
      await loadZones();
      setStep('review');
    } catch (err: any) { setSaveError(err.response?.data?.error || 'Failed to save zone'); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setRoomName(''); setAnchorId('');
    setInsideRssi(null); setDoorwayRssi(null); setOutsideRssi(null);
    setSaveResult(null); setSaveError('');
  };

  const handleDelete = (zone: RoomZone) => {
    Alert.alert('Delete', `Delete zone for "${zone.room_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/fingerprint/room-zones/${zone.id}`); await loadZones(); }
        catch { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  // ── Helper: capture card ─────────────────────────────────────────
  const CaptureCard = ({ which, label, emoji, rssi, stepName }: {
    which: CaptureStep; label: string; emoji: string; rssi: number | null; stepName: Step;
  }) => (
    <View style={s.captureCard}>
      <View style={{ flex: 1 }}>
        <Text style={s.captureLabel}>{emoji} {label}</Text>
        {rssi != null
          ? <Text style={s.captureRssi}>✅ {Math.round(rssi)} dBm captured</Text>
          : <Text style={s.captureHint}>Stand at this position, then tap Capture</Text>
        }
      </View>
      <TouchableOpacity
        style={[s.capBtn, rssi != null && s.capBtnDone]}
        onPress={() => { setStep(stepName); }}
      >
        <Text style={s.capBtnTxt}>{rssi != null ? 'Re-capture' : 'Capture'}</Text>
      </TouchableOpacity>
    </View>
  );

  // ── List ──────────────────────────────────────────────────────────
  if (step === 'list') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#7c3aed" />
        <View style={[s.hdr, { paddingTop: STATUS_H + 12 }]}>
          <Text style={s.hdrTitle}>🚪 Room Zones</Text>
          <Text style={s.hdrSub}>Inside/doorway/outside calibration</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => { resetForm(); setStep('new_zone'); }}>
          <Text style={s.addBtnTxt}>＋  Add Room Zone</Text>
        </TouchableOpacity>
        {loading ? <ActivityIndicator style={{ marginTop: 24 }} color="#7c3aed" /> :
          <FlatList data={zones} keyExtractor={z => String(z.id)}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }}
            ListEmptyComponent={<Text style={s.empty}>No zones yet.{'\n'}Add one to enable Enter/Exit detection.</Text>}
            renderItem={({ item }) => (
              <View style={s.card}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardLabel}>{item.room_name}</Text>
                  <Text style={s.cardMeta}>Anchor: {item.anchor_id}  ·  Doorway: {item.doorway_distance_m.toFixed(1)}m</Text>
                  <Text style={s.cardMeta}>Inside: {Math.round(item.inside_rssi)} dBm  ·  Doorway: {Math.round(item.doorway_rssi)} dBm  ·  Outside: {Math.round(item.outside_rssi)} dBm</Text>
                </View>
                <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(item)}>
                  <Text style={s.delBtnTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        }
      </SafeAreaView>
    );
  }

  // ── New Zone form ─────────────────────────────────────────────────
  if (step === 'new_zone') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.hdr, { paddingTop: STATUS_H + 12 }]}>
          <TouchableOpacity onPress={() => setStep('list')}><Text style={s.back}>← Back</Text></TouchableOpacity>
          <Text style={s.hdrTitle}>New Room Zone</Text>
        </View>
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <Text style={s.lbl}>Room Name *</Text>
          <TextInput style={s.input} placeholder="e.g. Library, Room 201" value={roomName} onChangeText={setRoomName} autoFocus />

          <Text style={s.lbl}>Select Anchor *</Text>
          {liveLoading && <ActivityIndicator size="small" color="#7c3aed" />}
          {liveAnchors.length > 0 && (
            <View style={s.anchorRow}>
              {liveAnchors.map(a => (
                <TouchableOpacity key={a.anchor_id}
                  style={[s.anchorBtn, anchorId === a.anchor_id && s.anchorBtnActive]}
                  onPress={() => setAnchorId(a.anchor_id)}>
                  <Text style={[s.anchorLbl, anchorId === a.anchor_id && s.anchorLblActive]}>📡 {a.anchor_id}</Text>
                  <Text style={[s.anchorRssi, anchorId === a.anchor_id && s.anchorLblActive]}>{Math.round(a.rssi)} dBm</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TextInput style={s.input} placeholder="Anchor ID (manual)" value={anchorId} onChangeText={setAnchorId} autoCapitalize="none" />

          <View style={s.divider} />
          <Text style={s.sectionTitle}>Capture three positions:</Text>
          <CaptureCard which="inside"  label="Inside (room center)" emoji="🟢" rssi={insideRssi}  stepName="capture_inside"  />
          <CaptureCard which="doorway" label="Doorway (threshold)"  emoji="🟡" rssi={doorwayRssi} stepName="capture_doorway" />
          <CaptureCard which="outside" label="Outside (past door)"  emoji="🔴" rssi={outsideRssi} stepName="capture_outside" />

          {saveError ? <View style={s.errBox}><Text style={s.errTxt}>⚠️ {saveError}</Text></View> : null}

          <TouchableOpacity
            style={[s.primaryBtn, (loading || insideRssi == null || doorwayRssi == null || outsideRssi == null) && s.disabledBtn]}
            onPress={handleSave}
            disabled={loading || insideRssi == null || doorwayRssi == null || outsideRssi == null}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnTxt}>💾  Save Zone</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Capture screens (inside / doorway / outside) ──────────────────
  const captureConfig: Record<string, { label: string; hint: string; emoji: string; which: CaptureStep; next: Step }> = {
    capture_inside:  { label: 'Inside',  hint: 'Stand at the center of the room.',        emoji: '🟢', which: 'inside',  next: 'new_zone' },
    capture_doorway: { label: 'Doorway', hint: 'Stand exactly at the door threshold.',    emoji: '🟡', which: 'doorway', next: 'new_zone' },
    capture_outside: { label: 'Outside', hint: 'Stand just outside the door (1–2 steps).', emoji: '🔴', which: 'outside', next: 'new_zone' },
  };
  const cfg = captureConfig[step];

  if (cfg) {
    const currentRssi = liveAnchors.find(a => a.anchor_id === anchorId)?.rssi;
    return (
      <SafeAreaView style={[s.safe, s.captureSafe]}>
        <StatusBar barStyle="light-content" backgroundColor="#7c3aed" />
        <View style={[s.captureScreen, { paddingTop: STATUS_H + 16 }]}>
          <Text style={s.captureScreenEmoji}>{cfg.emoji}</Text>
          <Text style={s.captureScreenTitle}>{cfg.label} Position</Text>
          <Text style={s.captureScreenHint}>{cfg.hint}</Text>
          {currentRssi != null && (
            <View style={s.liveRssiBox}>
              <Text style={s.liveRssiLabel}>Live RSSI from {anchorId}</Text>
              <Text style={s.liveRssiValue}>{Math.round(currentRssi)} dBm</Text>
            </View>
          )}
          {capturing ? (
            <View style={s.countdownBox}>
              <Text style={s.countdownNum}>{countdown}</Text>
              <Text style={s.countdownSec}>sec</Text>
              <Text style={s.captureScreenHint}>Stay still…</Text>
            </View>
          ) : (
            <View style={s.captureActions}>
              <TouchableOpacity style={s.captureTriggerBtn} onPress={() => doCapture(cfg.which)}>
                <Text style={s.captureTriggerTxt}>▶  Start 8s Capture</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.backBtn} onPress={() => setStep('new_zone')}>
                <Text style={s.backBtnTxt}>← Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Review / Success ──────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={[s.hdr, { paddingTop: STATUS_H + 12 }]}>
        <Text style={s.hdrTitle}>Zone Saved ✅</Text>
      </View>
      <ScrollView contentContainerStyle={s.form}>
        {saveResult && (
          <View style={s.successBox}>
            <Text style={s.successTitle}>✅ {saveResult.room_name}</Text>
            <Text style={s.successTxt}>Anchor: {saveResult.anchor_id}</Text>
            <Text style={s.successTxt}>Doorway boundary: {saveResult.doorway_distance_m?.toFixed(2)} m ({saveResult.distance_method})</Text>
            <Text style={s.successTxt}>Inside RSSI: {Math.round(saveResult.inside_rssi)} dBm</Text>
            <Text style={s.successTxt}>Doorway RSSI: {Math.round(saveResult.doorway_rssi)} dBm</Text>
            <Text style={s.successTxt}>Outside RSSI: {Math.round(saveResult.outside_rssi)} dBm</Text>
          </View>
        )}
        <TouchableOpacity style={s.primaryBtn} onPress={() => { resetForm(); setStep('new_zone'); }}>
          <Text style={s.primaryBtnTxt}>Add Another Zone</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secBtn} onPress={() => setStep('list')}>
          <Text style={s.secBtnTxt}>View All Zones</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#f1f5f9' },
  captureSafe:      { backgroundColor: '#7c3aed' },
  hdr:              { backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingBottom: 12 },
  hdrTitle:         { color: '#fff', fontSize: 16, fontWeight: '700' },
  hdrSub:           { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 2 },
  back:             { color: '#c4b5fd', fontSize: 13, marginBottom: 4 },
  addBtn:           { margin: 14, backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  addBtnTxt:        { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:            { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 13, lineHeight: 20 },
  card:             { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
                      flexDirection: 'row', alignItems: 'center',
                      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardLabel:        { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  cardMeta:         { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  delBtn:           { backgroundColor: '#fee2e2', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  delBtnTxt:        { color: '#dc2626', fontWeight: '700', fontSize: 12 },
  form:             { padding: 16 },
  lbl:              { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 5, marginTop: 14 },
  input:            { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1e293b' },
  anchorRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 6 },
  anchorBtn:        { borderWidth: 1, borderColor: '#7c3aed', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fff' },
  anchorBtnActive:  { backgroundColor: '#7c3aed' },
  anchorLbl:        { fontSize: 12, fontWeight: '600', color: '#7c3aed' },
  anchorRssi:       { fontSize: 10, color: '#64748b', marginTop: 1 },
  anchorLblActive:  { color: '#fff' },
  divider:          { height: 1, backgroundColor: '#e2e8f0', marginVertical: 14 },
  sectionTitle:     { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  captureCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
                      borderWidth: 1, borderColor: '#e2e8f0' },
  captureLabel:     { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  captureRssi:      { fontSize: 11, color: '#16a34a', marginTop: 2 },
  captureHint:      { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  capBtn:           { backgroundColor: '#ede9fe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  capBtnDone:       { backgroundColor: '#d1fae5' },
  capBtnTxt:        { fontSize: 11, fontWeight: '600', color: '#7c3aed' },
  errBox:           { backgroundColor: '#fef2f2', borderRadius: 9, padding: 12, marginTop: 14, borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  errTxt:           { fontSize: 12, color: '#dc2626' },
  primaryBtn:       { backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 20 },
  primaryBtnTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  secBtn:           { backgroundColor: '#e2e8f0', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  secBtnTxt:        { color: '#374151', fontWeight: '600', fontSize: 14 },
  disabledBtn:      { opacity: 0.45 },
  successBox:       { backgroundColor: '#f5f3ff', borderRadius: 9, padding: 14, borderLeftWidth: 3, borderLeftColor: '#7c3aed' },
  successTitle:     { fontSize: 14, fontWeight: '700', color: '#7c3aed', marginBottom: 8 },
  successTxt:       { fontSize: 12, color: '#374151', marginTop: 3 },
  captureScreen:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  captureScreenEmoji: { fontSize: 48, marginBottom: 10 },
  captureScreenTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  captureScreenHint:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: 20 },
  liveRssiBox:      { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 20, alignItems: 'center' },
  liveRssiLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  liveRssiValue:    { fontSize: 28, fontWeight: '800', color: '#fff' },
  countdownBox:     { alignItems: 'center' },
  countdownNum:     { fontSize: 52, fontWeight: '800', color: '#fff' },
  countdownSec:     { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: -6, marginBottom: 8 },
  captureActions:   { alignItems: 'center', width: '100%' },
  captureTriggerBtn:{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12 },
  captureTriggerTxt:{ color: '#7c3aed', fontWeight: '700', fontSize: 15 },
  backBtn:          { paddingVertical: 10 },
  backBtnTxt:       { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
});
