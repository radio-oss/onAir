// components/ScheduleArchiveModal.tsx
'use client';

import React, { useState } from 'react';
import { ConductorSchedule } from '@/lib/conductor-data';
import {
  ArchivedScheduleSummary,
  deleteArchivedSchedule,
} from '@/lib/schedule-templates';
import {
  X,
  Archive,
  CalendarPlus,
  RotateCcw,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface ScheduleArchiveModalProps {
  isOpen: boolean;
  currentSchedule: ConductorSchedule;
  archivedList: ArchivedScheduleSummary[];
  canEditSchedule: boolean;
  onClose: () => void;
  onSaveCurrentToArchive: () => void;
  onRestoreArchivedSchedule: (schedule: ConductorSchedule) => void;
  onCreateNewDaySchedule: (
    dateShamsi: string,
    dayOfWeek: string,
    resetStatuses: boolean
  ) => void;
  onArchiveListChanged: (nextList: ArchivedScheduleSummary[]) => void;
}

export default function ScheduleArchiveModal({
  isOpen,
  currentSchedule,
  archivedList,
  canEditSchedule,
  onClose,
  onSaveCurrentToArchive,
  onRestoreArchivedSchedule,
  onCreateNewDaySchedule,
  onArchiveListChanged,
}: ScheduleArchiveModalProps) {
  const [newDateShamsi, setNewDateShamsi] = useState<string>('1405/07/14');
  const [newDayOfWeek, setNewDayOfWeek] = useState<string>('سه‌شنبه');
  const [resetStatuses, setResetStatuses] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleCreateDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSchedule) return;
    onCreateNewDaySchedule(newDateShamsi, newDayOfWeek, resetStatuses);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                آرشیو چندروزه کنداکتورها و ایجاد جدول روز جدید
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                مدیریت سوابق جداول پخش روزانه در زیرساخت محلی سازمان
              </p>
            </div>
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
          {/* Save Current Day */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-100">
                کنداکتور فعال فعلی: {currentSchedule.dayOfWeek}{' '}
                {currentSchedule.dateShamsi}
              </div>
              <div className="text-slate-400 mt-0.5">
                شامل {currentSchedule.items.length} باکس برنامه به همراه وضعیت
                تأییدها و نسخه‌های فایل
              </div>
            </div>
            <button
              type="button"
              onClick={onSaveCurrentToArchive}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold rounded-lg cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>ذخیره روز جاری در آرشیو</span>
            </button>
          </div>

          {/* Create New Broadcast Day from Template */}
          {canEditSchedule && (
            <form
              onSubmit={handleCreateDay}
              className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3"
            >
              <div className="font-bold text-sky-300 flex items-center gap-1.5">
                <CalendarPlus className="w-4 h-4" />
                <span>ایجاد کنداکتور برای روز جدید (بر پایه ساختار فعلی):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    تاریخ شمسی جدید:
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={newDateShamsi}
                    onChange={(e) => setNewDateShamsi(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono-tabular text-center text-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">روز هفته:</label>
                  <select
                    value={newDayOfWeek}
                    onChange={(e) => setNewDayOfWeek(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                  >
                    {[
                      'شنبه',
                      'یک‌شنبه',
                      'دوشنبه',
                      'سه‌شنبه',
                      'چهارشنبه',
                      'پنج‌شنبه',
                      'جمعه',
                    ].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg cursor-pointer"
                  >
                    ایجاد کنداکتور روز جدید
                  </button>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetStatuses}
                  onChange={(e) => setResetStatuses(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-teal-500"
                />
                <span>
                  آرشیو خودکار روز فعلی و بازنشانی وضعیت پخش آیتم‌های پخش‌شده به
                  «آماده پخش» برای روز جدید
                </span>
              </label>
            </form>
          )}

          {/* Archived Days List */}
          <div className="space-y-2">
            <div className="font-bold text-slate-200">
              کنداکتورهای ذخیره‌شده در آرشیو محلی ({archivedList.length} مورد):
            </div>
            {archivedList.length === 0 ? (
              <div className="p-6 text-center bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400">
                هنوز کنداکتوری در آرشیو چندروزه ذخیره نشده است.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {archivedList.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-slate-100">
                        {entry.dayOfWeek} —{' '}
                        <span className="font-mono-tabular text-teal-300">
                          {entry.dateShamsi}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {entry.itemCount} ردیف برنامه | ساعت ذخیره:{' '}
                        {entry.savedAt}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreArchivedSchedule(entry.schedule);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-md cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>بارگذاری این روز</span>
                      </button>
                      {canEditSchedule && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = deleteArchivedSchedule(entry.id);
                            onArchiveListChanged(next);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
