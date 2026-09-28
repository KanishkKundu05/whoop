"use client";

import { useState } from "react";
import { Headphones, Moon } from "lucide-react";
import { formatDailyMessage } from "@/lib/messages/template";

const sampleTracks = [{ name: "Easy morning", bpm: 80 }, { name: "Finding stride", bpm: 110 }, { name: "On the move", bpm: 140 }, { name: "Final stretch", bpm: 170 }];

export function DemoExperiences() {
  const [heartRate, setHeartRate] = useState(112);
  const [greeting, setGreeting] = useState("Good morning");
  const track = sampleTracks.reduce((best, next) => Math.abs(next.bpm - heartRate) < Math.abs(best.bpm - heartRate) ? next : best);
  return <div className="mt-6 grid gap-6 md:grid-cols-2">
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7">
      <Headphones className="text-lime-700" /><h2 className="mt-4 text-xl font-semibold">Try a music match</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Move the slider to see how heart rate can select a similar song BPM. These are fictional tracks.</p>
      <label htmlFor="demo-heart-rate" className="mt-6 block text-sm font-medium">Simulated heart rate · {heartRate} bpm</label>
      <input id="demo-heart-rate" type="range" min="60" max="180" value={heartRate} onChange={event => setHeartRate(Number(event.target.value))} className="mt-4 min-h-11 w-full accent-lime-700" />
      <div aria-live="polite" className="mt-4 rounded-2xl bg-zinc-950 p-5 text-white"><p className="text-xs text-lime-300">SAMPLE MATCH</p><p className="mt-2 text-xl font-semibold">{track.name}</p><p className="mt-1 text-sm text-zinc-400">{track.bpm} BPM · {Math.abs(track.bpm - heartRate)} from your simulated heart rate</p></div>
      <p className="mt-4 text-xs leading-6 text-zinc-500">Live music needs Spotify Premium and WHOOP Bluetooth in a compatible browser.</p>
    </section>
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7">
      <Moon className="text-lime-700" /><h2 className="mt-4 text-xl font-semibold">Preview a morning text</h2><p className="mt-2 text-sm leading-6 text-zinc-500">A small update after WHOOP processes your sleep. Edit the sample greeting below to see the format.</p>
      <label htmlFor="demo-greeting" className="mt-6 block text-sm font-medium">Sample greeting</label><input id="demo-greeting" value={greeting} maxLength={80} onChange={event => setGreeting(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 px-4" />
      <p className="mt-5 break-words rounded-2xl rounded-br-sm bg-lime-100 p-5 text-sm leading-7 text-lime-950">{formatDailyMessage({ greeting: greeting.trim() || "Good morning", wakeTime: "7:12 AM", sleepDuration: "7h 34m", sleepStart: "11:14 PM" })}</p>
      <p className="mt-4 text-xs leading-6 text-zinc-500">Preview only. The live app uses the owner’s configured greeting. You choose a recipient and explicitly enable automatic texts.</p>
    </section>
  </div>;
}
