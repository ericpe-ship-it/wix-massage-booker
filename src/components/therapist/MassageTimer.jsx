import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Clock } from 'lucide-react';

export default function MassageTimer({ duration, startTime }) {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef(null);
  const totalSeconds = (duration || 13) * 60;

  const start = () => {
    setRunning(true);
    setSeconds(0);
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s + 1 >= totalSeconds) {
          clearInterval(intervalRef.current);
          setRunning(false);
          // Play chime
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(830, ctx.currentTime);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 2.6);
          } catch (e) {}
          return totalSeconds;
        }
        return s + 1;
      });
    }, 1000);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setSeconds(0);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const remaining = totalSeconds - seconds;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = (seconds / totalSeconds) * 100;

  if (!running && seconds === 0) {
    return (
      <Button size="sm" variant="outline" onClick={start} className="h-7 px-2 text-xs gap-1">
        <Play className="w-3 h-3" /> Timer
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-6 h-6">
        <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="10" fill="none" stroke={pct > 85 ? '#ef4444' : '#6366f1'} strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * 10}`}
            strokeDashoffset={`${2 * Math.PI * 10 * (1 - pct / 100)}`}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className={`text-xs font-mono font-semibold ${pct > 85 ? 'text-red-600' : 'text-indigo-600'}`}>
        {mins}:{String(secs).padStart(2, '0')}
      </span>
      <Button size="sm" variant="ghost" onClick={stop} className="h-6 w-6 p-0 text-gray-400">
        <Square className="w-2.5 h-2.5" />
      </Button>
    </div>
  );
}