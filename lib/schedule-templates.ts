// lib/schedule-templates.ts
import { ConductorSchedule } from './conductor-data';

const ARCHIVE_KEY = 'irib_isfahan_multi_day_archive_v1';

export interface ArchivedScheduleSummary {
  id: string;
  dateShamsi: string;
  dayOfWeek: string;
  title: string;
  itemCount: number;
  savedAt: string;
  schedule: ConductorSchedule;
}

export function getArchivedSchedules(): ArchivedScheduleSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveScheduleToArchive(
  schedule: ConductorSchedule
): ArchivedScheduleSummary[] {
  const existing = getArchivedSchedules().filter(
    (s) => s.dateShamsi !== schedule.dateShamsi
  );
  const entry: ArchivedScheduleSummary = {
    id: `arch-${schedule.dateShamsi}-${Date.now()}`,
    dateShamsi: schedule.dateShamsi,
    dayOfWeek: schedule.dayOfWeek,
    title: schedule.title,
    itemCount: schedule.items.length,
    savedAt: new Date().toLocaleTimeString('fa-IR'),
    schedule,
  };
  const updated = [entry, ...existing].slice(0, 30);
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function deleteArchivedSchedule(id: string): ArchivedScheduleSummary[] {
  const updated = getArchivedSchedules().filter((s) => s.id !== id);
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}
