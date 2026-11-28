"use client";

import { useEffect, useState } from "react";

/**
 * Should this poll chime? Only for call ids never seen before; the first load (seen = null) is silent.
 * `seen` keeps every id ever shown, so a call hidden by "On my way" and returned by a slow poll stays quiet.
 */
export function newCalls(seen: ReadonlySet<string> | null, ids: readonly string[]): { chime: boolean; seen: Set<string> } {
  const next = new Set(seen ?? []);
  let chime = false;
  for (const id of ids) {
    if (!next.has(id)) chime = seen !== null;
    next.add(id);
  }
  return { chime, seen: next };
}

let audio: AudioContext | null = null;

/** False until the first tap unlocks audio; browsers block sound before a user gesture. */
export function useSoundUnlocked() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const unlock = () => { try { audio ??= new AudioContext(); void audio.resume().then(() => setOn(audio?.state === "running")); } catch { /* no audio */ } };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  return on;
}

/** Waiter sound on/off, remembered per device, default on. */
export function useCallSound(): [boolean, () => void] {
  const [on, setOn] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("sora-waiter-sound") === "off") setOn(false); } catch { /* storage blocked */ } }, []);
  const toggle = () => setOn((was) => {
    try { localStorage.setItem("sora-waiter-sound", was ? "off" : "on"); } catch { /* storage blocked */ }
    return !was;
  });
  return [on, toggle];
}

/** A soft rising two-note chime (E5 then B5, sine, quick fade), plus a short buzz on phones that can. */
export function playCallChime() {
  try {
    if (audio?.state === "running") {
      const t = audio.currentTime;
      [659, 988].forEach((hz, i) => {
        const osc = audio!.createOscillator();
        const gain = audio!.createGain();
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, t + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.25, t + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.5);
        osc.connect(gain).connect(audio!.destination);
        osc.start(t + i * 0.16);
        osc.stop(t + i * 0.16 + 0.5);
      });
    }
  } catch { /* no audio: the terracotta card still shows */ }
  navigator.vibrate?.([120, 80, 120]);
}
