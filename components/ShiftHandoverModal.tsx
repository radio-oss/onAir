// components/ShiftHandoverModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  ConductorSchedule,
  isItemApprovedForPlayout,
  parseTimeToSeconds,
  formatDurationTotal,
} from '@/lib/conductor-data';
import {
  getAsRunLogs,
  appendAsRunLog,
  exportAsRunLogsToCSV,
  AsRunLogEntry,
} from '@/lib/as-run-logger';
import { exportBroadcastLogsToCSV } from '@/src/utils/broadcastLogger';
import {
  X,
  FileCheck2,
  Download,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
} from 'lucide-react';

interface ShiftHandoverModalProps {
  isOpen: boolean;
  schedule: ConductorSchedule;
  onClose: () => void;
  onSaveShiftReport: (notes: string, nextSupervisor: string) => void;
}

export default function ShiftHandoverModal({
  isOpen,
  schedule,
  onClose,
  onSaveShiftReport,
}: ShiftHandoverModalProps) {
  const [shiftNotes, setShiftNotes] = useState<string>(schedule.notes);
  const [nextSupervisor, setNextSupervisor] = useState<string>(
    schedule.supervisorName
  );
  const [asRunLogs, setAsRunLogs] = useState<AsRunLogEntry[]>([]);
  const [incidentItemOrder, setIncidentItemOrder] = useState<number>(1);
  const [incidentNote, setIncidentNote] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setShiftNotes(schedule.notes);
      setNextSupervisor(schedule.supervisorName);
      setAsRunLogs(getAsRunLogs());
    }
  }, [isOpen, schedule.notes, schedule.supervisorName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const approvedCount = schedule.items.filter((i) =>
    isItemApprovedForPlayout(i)
  ).length;
  const unapprovedOrRevisionCount = schedule.items.length - approvedCount;

  const handleLogMonitoringIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentNote.trim()) return;
    const targetItem =
      schedule.items.find((i) => i.order === incidentItemOrder) ||
      schedule.items[0];
    if (!targetItem) return;

    const updated = appendAsRunLog(
      targetItem,
      new Date().toLocaleTimeString('fa-IR'),
      nextSupervisor || 'اپراتور پایش پخش',
      'EMERGENCY_SWITCH',
      `[گزارش خطای پایش]: ${incidentNote.trim()}`
    );
    setAsRunLogs(updated);
    setIncidentNote('');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-bold text-slate-100">
              پایش تطابق اجرای پخش (As-Run)، پیگیری خطاها و تحویل شیفت
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs overflow-y-auto">
          {/* Summary Metrics */}
          <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-center">
            <div>
              <div className="text-slate-400">
                فایل‌های آماده و دارای تأیید نهایی
              </div>
              <div className="text-lg font-bold font-mono-tabular text-emerald-400 mt-1">
                {approvedCount} / {schedule.items.length}
              </div>
            </div>
            <div>
              <div className="text-slate-400">
                پرونده‌های در جریان بازبینی / نیازمند اصلاح
              </div>
              <div className="text-lg font-bold font-mono-tabular text-amber-400 mt-1">
                {unapprovedOrRevisionCount} مورد
              </div>
            </div>
            <div>
              <div className="text-slate-400">
                رخدادهای ثبت‌شده در لاگ پایش آنتن (As-Run)
              </div>
              <div className="text-lg font-bold font-mono-tabular text-teal-300 mt-1">
                {asRunLogs.length} رخداد
              </div>
            </div>
          </div>

          {/* Operator Monitoring Incident Logger (گام ۱۱: پیگیری خطا از طریق سامانه) */}
          <form
            onSubmit={handleLogMonitoringIncident}
            className="p-4 bg-slate-950 border border-amber-500/40 rounded-xl space-y-3"
          >
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>
                ثبت و پیگیری مغایرت زمان‌بندی یا خطای فنی پخش (ویژه اپراتور پایش
                و مسئول پلی‌اوت):
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select
                value={incidentItemOrder}
                onChange={(e) => setIncidentItemOrder(Number(e.target.value))}
                className="px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
              >
                {schedule.items.map((it) => (
                  <option key={it.id} value={it.order}>
                    ردیف {it.order}: {it.title.slice(0, 28)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={incidentNote}
                onChange={(e) => setIncidentNote(e.target.value)}
                placeholder="شرح خطا یا مغایرت در اجرای پخش (مثال: تأخیر ۲۰ ثانیه‌ای ارتباط استودیو)..."
                className="sm:col-span-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>ثبت در لاگ پایش</span>
              </button>
            </div>
          </form>

          {/* Recent As-Run Logs Table */}
          {asRunLogs.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-slate-300">
                آخرین سوابق اجرای واقعی پخش و گزارش‌های پایش (As-Run Log):
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950">
                <table className="w-full text-right">
                  <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md">
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="p-2">زمان واقعی</th>
                      <th className="p-2">زمان کنداکتور</th>
                      <th className="p-2 text-center">تطابق زمانی (Delta)</th>
                      <th className="p-2">ردیف و برنامه</th>
                      <th className="p-2">توضیحات / گزارش پایش</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {asRunLogs.slice(0, 12).map((log) => {
                      const actualSec = parseTimeToSeconds(log.actualStartTime);
                      const plannedSec = parseTimeToSeconds(log.plannedStartTime);
                      const diffSec = actualSec - plannedSec;
                      const absDiff = Math.abs(diffSec);
                      return (
                        <tr key={log.id}>
                          <td className="p-2 font-mono-tabular text-teal-300">
                            {log.actualStartTime}
                          </td>
                          <td className="p-2 font-mono-tabular text-slate-400">
                            {log.plannedStartTime}
                          </td>
                          <td className="p-2 text-center font-mono-tabular">
                            {absDiff < 5 ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                                ON-TIME (منطبق)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                                {diffSec > 0 ? `+${formatDurationTotal(absDiff)} تأخیر` : `-${formatDurationTotal(absDiff)} تعجیل`}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-slate-200">
                            ردیف {log.order}: {log.title}
                          </td>
                          <td className="p-2 text-amber-300">{log.notes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Shift Handover Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                مسئول پلی‌اوت / اپراتور پایش شیفت:
              </label>
              <input
                type="text"
                value={nextSupervisor}
                onChange={(e) => setNextSupervisor(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                گزارش کلی اجرای کنداکتور و موارد تحویلی به شیفت بعد:
              </label>
              <input
                type="text"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  exportAsRunLogsToCSV(asRunLogs, schedule.dateShamsi)
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود لاگ واقعی اجرای پخش (As-Run CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => exportBroadcastLogsToCSV(undefined, schedule.dateShamsi)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود لاگ فریم‌به‌فریم ترافیک آنتن (25fps CSV)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
              >
                بستن
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveShiftReport(shiftNotes, nextSupervisor);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold rounded-lg cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت گزارش پایش و تحویل شیفت</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
