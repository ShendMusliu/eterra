// src/config/reservationWindows.ts
// Typed reservation windows with sane defaults and optional env overrides.
// Weekday mapping uses JS getDay(): 0=Sun ... 6=Sat
import { DateTime } from "luxon";

export const TIMEZONE = "Europe/Belgrade";

export type HHmm = `${string}:${string}`;
export type Window = { start: HHmm; end: HHmm };
export type WindowsByWeekday = Record<0 | 1 | 2 | 3 | 4 | 5 | 6, Window>;

const parseHHmm = (s: string | undefined, fallback: HHmm): HHmm => {
  if (!s) return fallback;
  const ok = /^\d{2}:\d{2}$/.test(s);
  return (ok ? (s as HHmm) : fallback);
};

// Frontend env (Vite) for flexibility; build-time values
const FE_WD_START = parseHHmm(import.meta?.env?.VITE_RES_WD_START, "16:00");
const FE_WD_END = parseHHmm(import.meta?.env?.VITE_RES_WD_END, "23:00");
const FE_WE_START = parseHHmm(import.meta?.env?.VITE_RES_WE_START, "12:00");
const FE_WE_END = parseHHmm(import.meta?.env?.VITE_RES_WE_END, "23:00");

export const defaultWindows: WindowsByWeekday = {
  0: { start: FE_WE_START, end: FE_WE_END }, // Sun
  1: { start: FE_WD_START, end: FE_WD_END }, // Mon
  2: { start: FE_WD_START, end: FE_WD_END }, // Tue
  3: { start: FE_WD_START, end: FE_WD_END }, // Wed
  4: { start: FE_WD_START, end: FE_WD_END }, // Thu
  5: { start: FE_WD_START, end: FE_WD_END }, // Fri
  6: { start: FE_WE_START, end: FE_WE_END }, // Sat
};

export const hhmmToMinutes = (hhmm: HHmm): number => {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
};

export const minutesToHHmm = (mins: number): HHmm => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` as HHmm;
};

export const getWindowForDate = (date: Date, windows: WindowsByWeekday = defaultWindows): { startMins: number; endMins: number; window: Window } => {
  // Normalize to Europe/Belgrade for weekday calc
  const dt = DateTime.fromJSDate(date, { zone: TIMEZONE });
  const jsDow = (dt.weekday % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6; // Luxon: 1=Mon..7=Sun; map to JS: 0=Sun..6=Sat
  const day = (jsDow === 0 ? 0 : (jsDow as 1 | 2 | 3 | 4 | 5 | 6));
  const window = windows[day];
  const startMins = hhmmToMinutes(window.start);
  const endMins = hhmmToMinutes(window.end);
  return { startMins, endMins, window };
};

export const allowedStartHours = (date: Date, slotMinutes: number = 60, windows: WindowsByWeekday = defaultWindows): number[] => {
  const { startMins, endMins } = getWindowForDate(date, windows);
  const lastStart = endMins - slotMinutes; // must finish by end
  const startHour = Math.ceil(startMins / 60);
  const endHour = Math.floor(lastStart / 60);
  if (endHour < startHour) return [];
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h);
  }
  return hours.filter((h) => h >= 0 && h <= 23);
};

export const formatHourRange = (date: Date, hour: number, slotMinutes: number = 60): string => {
  const start = DateTime.fromJSDate(date, { zone: TIMEZONE }).set({ hour, minute: 0, second: 0, millisecond: 0 });
  const end = start.plus({ minutes: slotMinutes });
  return `${start.toFormat("HH:mm")} – ${end.toFormat("HH:mm")}`;
};

