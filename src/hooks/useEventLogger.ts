import { useState, useEffect, useRef, useCallback } from 'react';

interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

export const useEventLogger = () => {
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{ [key: string]: boolean }>({});
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  const resetStartTime = useCallback(() => {
    startTimeRef.current = new Date().toISOString();
  }, []);

  const toggleEventExpanded = useCallback((eventId: string) => {
    setExpandedEvents((prev) => {
      const expanded = { ...prev };
      if (expanded[eventId]) {
        delete expanded[eventId];
      } else {
        expanded[eventId] = true;
      }
      return expanded;
    });
  }, []);

  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  return {
    realtimeEvents,
    setRealtimeEvents,
    expandedEvents,
    eventsScrollRef,
    formatTime,
    resetStartTime,
    toggleEventExpanded,
  };
};
