const KEY = 'childtrack_offline_queue';

export interface OfflineRecord {
  student_name:  string;
  lrn:           string;
  gender:        string;
  guardian_name: string;
  by_whom:       string;
  status:        string;
  session:       string;
  date:          string;
  qr_data:       string;
}

export function enqueueRecord(record: OfflineRecord): void {
  const queue = getQueue();
  queue.push(record);
  localStorage.setItem(KEY, JSON.stringify(queue));
}

export function getQueue(): OfflineRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export async function syncQueue(token: string): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: OfflineRecord[] = [];

  for (const record of queue) {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await fetch(
        `${API_BASE}/attendance`,
        {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(record),
        }
      );
      // 409 = already recorded = counts as synced
      if (res.ok || res.status === 409) synced++;
      else remaining.push(record);
    } catch {
      remaining.push(record);
    }
  }

  localStorage.setItem(KEY, JSON.stringify(remaining));
  return synced;
}