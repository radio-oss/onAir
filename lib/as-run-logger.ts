// lib/as-run-logger.ts
import {
  ScheduleItem,
  WORKFLOW_STAGE_META,
  formatDurationTotal,
} from './conductor-data';
import { logBroadcastEvent, BroadcastEventType } from '@/src/utils/broadcastLogger';

export interface AsRunLogEntry {
  id: string;
  actualStartTime: string; // HH:MM:SS
  plannedStartTime: string;
  order: number;
  mediaCode: string;
  versionNumber: number;
  workflowStageLabel: string;
  title: string;
  trimInFormatted: string;
  trimOutFormatted: string;
  netDuration: string;
  operatorName: string;
  eventType:
    | 'AUTO_TAKE'
    | 'MANUAL_TAKE'
    | 'TRIM_UPDATED'
    | 'EMERGENCY_SWITCH'
    | 'MONITOR_ALERT';
  notes: string;
}

const AS_RUN_STORAGE_KEY = 'irib_isfahan_as_run_log_v1';

export function getAsRunLogs(): AsRunLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AS_RUN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function appendAsRunLog(
  item: ScheduleItem,
  actualStartTime: string,
  operatorName: string,
  eventType: AsRunLogEntry['eventType'],
  notes = ''
): AsRunLogEntry[] {
  const current = getAsRunLogs();
  const stageKey = item.workflowStatus || 'approved_for_playout';
  const entry: AsRunLogEntry = {
    id: `asrun-${Date.now()}`,
    actualStartTime,
    plannedStartTime: item.startTime,
    order: item.order,
    mediaCode: item.mediaCode,
    versionNumber: item.revisionVersion || 1,
    workflowStageLabel:
      WORKFLOW_STAGE_META[stageKey]?.shortLabel || 'آماده در پلی‌اوت',
    title: item.title,
    trimInFormatted: formatDurationTotal(item.trimInSec || 0),
    trimOutFormatted: formatDurationTotal(item.trimOutSec || 0),
    netDuration: item.duration,
    operatorName,
    eventType,
    notes,
  };
  const updated = [entry, ...current].slice(0, 500);
  try {
    localStorage.setItem(AS_RUN_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }

  // Sync with the rolling broadcast compliance logger (start/stop/transition)
  const mappedEventType: BroadcastEventType =
    eventType === 'AUTO_TAKE'
      ? 'start'
      : eventType === 'MANUAL_TAKE'
        ? 'transition'
        : eventType === 'EMERGENCY_SWITCH'
          ? 'emergency_switch'
          : 'trim_update';

  logBroadcastEvent({
    eventType: mappedEventType,
    item,
    actualTimecode: actualStartTime,
    transitionType: eventType === 'MANUAL_TAKE' ? 'CUT' : 'AUTO',
    operatorName,
    directorName: 'محمود فرشچیان',
    notes,
  });

  return updated;
}

export function exportAsRunLogsToCSV(
  logs: AsRunLogEntry[],
  dateShamsi: string
) {
  const headers = [
    'ساعت واقعی پخش (Actual)',
    'ساعت کنداکتور (Planned)',
    'ردیف',
    'شناسه مدیا',
    'نسخه فایل',
    'وضعیت تأیید',
    'عنوان برنامه',
    'نقطه شروع (Mark In)',
    'نقطه پایان (Mark Out)',
    'مدت مورد استفاده',
    'مسئول پلی‌اوت / اپراتور پایش',
    'نوع رخداد',
    'توضیحات و گزارش پایش',
  ];

  const rows = logs.map((l) => [
    l.actualStartTime,
    l.plannedStartTime,
    l.order,
    l.mediaCode,
    `v${l.versionNumber || 1}`,
    `"${(l.workflowStageLabel || '').replace(/"/g, '""')}"`,
    `"${l.title.replace(/"/g, '""')}"`,
    l.trimInFormatted,
    l.trimOutFormatted,
    l.netDuration,
    `"${l.operatorName}"`,
    l.eventType,
    `"${l.notes.replace(/"/g, '""')}"`,
  ]);

  const csv =
    '\uFEFF' +
    [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AsRun-Log-Isfahan-${dateShamsi.replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
