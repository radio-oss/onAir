// File: src/utils/broadcastLogger.ts
import { ScheduleItem, formatDurationTotal } from '@/lib/conductor-data';

export type BroadcastEventType =
  | 'start'
  | 'stop'
  | 'transition'
  | 'pause'
  | 'auto_take'
  | 'manual_take'
  | 'trim_update'
  | 'emergency_switch';

export interface BroadcastLogEvent {
  id: string;
  timestampIso: string;
  actualTimecode: string; // HH:MM:SS or HH:MM:SS:FF
  plannedStartTime: string;
  eventType: BroadcastEventType;
  order: number;
  mediaCode: string;
  programTitle: string;
  category?: string;
  trimInFormatted: string;
  trimOutFormatted: string;
  netDuration: string;
  transitionType?: 'CUT' | 'MIX' | 'WIPE' | 'AUTO' | 'MANUAL';
  operatorName: string;
  directorName: string;
  notes: string;
}

export interface LogBroadcastEventInput {
  eventType: BroadcastEventType;
  item?: Partial<ScheduleItem>;
  actualTimecode?: string;
  plannedStartTime?: string;
  order?: number;
  mediaCode?: string;
  programTitle?: string;
  category?: string;
  trimInSec?: number;
  trimOutSec?: number;
  netDuration?: string;
  transitionType?: 'CUT' | 'MIX' | 'WIPE' | 'AUTO' | 'MANUAL';
  operatorName?: string;
  directorName?: string;
  notes?: string;
}

const STORAGE_KEY = 'irib_isfahan_broadcast_rolling_buffer_v1';
const DEFAULT_MAX_BUFFER_SIZE = 1000;

let maxBufferCapacity = DEFAULT_MAX_BUFFER_SIZE;
let rollingEventBuffer: BroadcastLogEvent[] = [];
let isHydratedFromStorage = false;

function formatCurrentTehranTimecode(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ff = String(Math.floor((date.getMilliseconds() / 1000) * 25)).padStart(2, '0');
  return `${hh}:${mm}:${ss}:${ff}`;
}

function hydrateBufferIfNeeded(): void {
  if (isHydratedFromStorage || typeof window === 'undefined') return;
  isHydratedFromStorage = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      rollingEventBuffer = parsed.slice(0, maxBufferCapacity);
    }
  } catch {
    // Ignore storage read errors in restricted offline contexts
  }
}

function persistBuffer(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(rollingEventBuffer.slice(0, maxBufferCapacity))
    );
  } catch {
    // Ignore localStorage quota errors
  }
}

/**
 * Configures the maximum number of broadcast events retained in the rolling buffer.
 */
export function setBroadcastBufferCapacity(capacity: number): void {
  if (!Number.isFinite(capacity) || capacity < 10) return;
  maxBufferCapacity = Math.floor(capacity);
  hydrateBufferIfNeeded();
  if (rollingEventBuffer.length > maxBufferCapacity) {
    rollingEventBuffer = rollingEventBuffer.slice(0, maxBufferCapacity);
    persistBuffer();
  }
}

/**
 * Returns a shallow copy of the current rolling broadcast event buffer (newest first).
 */
export function getBroadcastEvents(): BroadcastLogEvent[] {
  hydrateBufferIfNeeded();
  return [...rollingEventBuffer];
}

/**
 * Appends a broadcast event (start, stop, transition, etc.) into the rolling buffer,
 * automatically evicting the oldest entries once the buffer capacity is reached.
 */
export function logBroadcastEvent(input: LogBroadcastEventInput): BroadcastLogEvent {
  hydrateBufferIfNeeded();

  const now = new Date();
  const item = input.item;
  const trimInSec = input.trimInSec ?? item?.trimInSec ?? 0;
  const trimOutSec = input.trimOutSec ?? item?.trimOutSec ?? 0;

  const entry: BroadcastLogEvent = {
    id: `bc-evt-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    timestampIso: now.toISOString(),
    actualTimecode: input.actualTimecode || formatCurrentTehranTimecode(now),
    plannedStartTime: input.plannedStartTime || item?.startTime || '00:00:00',
    eventType: input.eventType,
    order: input.order ?? item?.order ?? 0,
    mediaCode: input.mediaCode || item?.mediaCode || 'N/A',
    programTitle: input.programTitle || item?.title || 'رویداد سیستمی پخش',
    category: input.category || item?.category,
    trimInFormatted: formatDurationTotal(trimInSec),
    trimOutFormatted: formatDurationTotal(trimOutSec),
    netDuration:
      input.netDuration ||
      item?.duration ||
      formatDurationTotal(Math.max(0, trimOutSec - trimInSec)),
    transitionType:
      input.transitionType ||
      (input.eventType === 'transition' ? 'CUT' : 'AUTO'),
    operatorName: input.operatorName || 'اپراتور پلی‌اوت و رژی',
    directorName: input.directorName || 'محمود فرشچیان',
    notes: input.notes || '',
  };

  rollingEventBuffer = [entry, ...rollingEventBuffer].slice(0, maxBufferCapacity);
  persistBuffer();

  return entry;
}

/**
 * Convenience helpers for logging standard start, stop, and transition events.
 */
export function logBroadcastStart(
  item: ScheduleItem,
  operatorName = 'اپراتور پلی‌اوت و رژی',
  notes = 'شروع پخش آیتم روی آنتن (START)'
): BroadcastLogEvent {
  return logBroadcastEvent({
    eventType: 'start',
    item,
    transitionType: 'AUTO',
    operatorName,
    notes,
  });
}

export function logBroadcastStop(
  item: ScheduleItem,
  operatorName = 'اپراتور پلی‌اوت و رژی',
  notes = 'توقف پخش آیتم (STOP)'
): BroadcastLogEvent {
  return logBroadcastEvent({
    eventType: 'stop',
    item,
    transitionType: 'MANUAL',
    operatorName,
    notes,
  });
}

export function logBroadcastTransition(
  fromItem: ScheduleItem | null,
  toItem: ScheduleItem,
  transitionType: 'CUT' | 'MIX' | 'WIPE' | 'AUTO' | 'MANUAL' = 'CUT',
  operatorName = 'اپراتور پلی‌اوت و رژی',
  notes?: string
): BroadcastLogEvent {
  const autoNote = fromItem
    ? `سوییچ آنتن (${transitionType}) از [${fromItem.mediaCode} - ${fromItem.title}] به [${toItem.mediaCode} - ${toItem.title}]`
    : `سوییچ آنتن (${transitionType}) به [${toItem.mediaCode} - ${toItem.title}]`;

  return logBroadcastEvent({
    eventType: 'transition',
    item: toItem,
    transitionType,
    operatorName,
    notes: notes ?? autoNote,
  });
}

/**
 * Clears all events from the rolling broadcast buffer.
 */
export function clearBroadcastEvents(): void {
  rollingEventBuffer = [];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage removal errors
    }
  }
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts the broadcast event buffer into an Excel/UTF-8 compatible CSV string (with UTF-8 BOM).
 */
export function formatBroadcastEventsToCSV(
  events: BroadcastLogEvent[] = getBroadcastEvents()
): string {
  const headers = [
    'شناسه رویداد (Event ID)',
    'زمان ثبت (ISO Timestamp)',
    'تایم‌کد واقعی آنتن (Actual Timecode)',
    'ساعت کنداکتور (Planned Start)',
    'نوع رویداد (Event Type)',
    'نوع ترنزیشن (Transition)',
    'ردیف (Order)',
    'کد مدیا (Media Code)',
    'عنوان برنامه (Program Title)',
    'نقطه شروع (Mark In)',
    'نقطه پایان (Mark Out)',
    'مدت خالص (Net Duration)',
    'اپراتور مسئول (Operator)',
    'مدیر پخش (Broadcast Director)',
    'توضیحات فنی (Notes)',
  ];

  const rows = events.map((evt) => [
    escapeCsvCell(evt.id),
    escapeCsvCell(evt.timestampIso),
    escapeCsvCell(evt.actualTimecode),
    escapeCsvCell(evt.plannedStartTime),
    escapeCsvCell(evt.eventType.toUpperCase()),
    escapeCsvCell(evt.transitionType || 'AUTO'),
    escapeCsvCell(evt.order),
    escapeCsvCell(evt.mediaCode),
    escapeCsvCell(evt.programTitle),
    escapeCsvCell(evt.trimInFormatted),
    escapeCsvCell(evt.trimOutFormatted),
    escapeCsvCell(evt.netDuration),
    escapeCsvCell(evt.operatorName),
    escapeCsvCell(evt.directorName),
    escapeCsvCell(evt.notes),
  ]);

  return (
    '\uFEFF' +
    [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n')
  );
}

/**
 * Exports the rolling buffer of broadcast events as a downloadable CSV file
 * to the broadcast engineer's download directory for compliance logging.
 */
export function exportBroadcastLogsToCSV(
  events?: BroadcastLogEvent[],
  dateLabel?: string
): string {
  const targetEvents = events ?? getBroadcastEvents();
  const csvContent = formatBroadcastEventsToCSV(targetEvents);

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const safeDate = (dateLabel || new Date().toISOString().slice(0, 10)).replace(
      /[^a-zA-Z0-9\u0600-\u06FF_-]/g,
      '-'
    );
    const filename = `Broadcast-Compliance-Log-Isfahan-${safeDate}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return csvContent;
}
