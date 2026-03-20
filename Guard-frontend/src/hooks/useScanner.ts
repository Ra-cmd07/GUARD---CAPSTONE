import { useEffect, useRef, useCallback } from 'react';

export function useScanner(enabled: boolean, onScan: (data: string) => void) {
  const bufferRef = useRef('');
  const timerRef  = useRef<ReturnType<typeof setTimeout>>();

  const flush = useCallback(() => {
    const data = bufferRef.current.trim();
    bufferRef.current = '';
    if (!data) return;
    try {
      JSON.parse(data);   // only accept valid JSON QR payloads
      onScan(data);
    } catch {
      console.warn('Scanner: non-JSON input ignored:', data);
    }
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current);
        flush();
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, flush]);
}