// components/ItemEditorModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  ScheduleItem,
  ProgramCategory,
  SignalSource,
  BroadcastStatus,
  WorkflowStage,
  CATEGORY_META,
  SOURCE_META,
  STATUS_META,
  WORKFLOW_STAGE_META,
  computeEndTime,
  mapWorkflowToBroadcastStatus,
  parseTimeToSeconds,
  formatSecondsToTime,
} from '@/lib/conductor-data';
import { X, Lock, Unlock, Save, Layers, UserCheck } from 'lucide-react';

interface ItemEditorModalProps {
  isOpen: boolean;
  item: ScheduleItem | null;
  isNew?: boolean;
  canLockTimes: boolean;
  canApproveReject: boolean;
  onClose: () => void;
  onSave: (updatedItem: ScheduleItem, autoCascade: boolean) => void;
}

export default function ItemEditorModal({
  isOpen,
  item,
  isNew = false,
  canLockTimes,
  canApproveReject,
  onClose,
  onSave,
}: ItemEditorModalProps) {
  const [formData, setFormData] = useState<ScheduleItem | null>(null);
  const [autoCascade, setAutoCascade] = useState<boolean>(true);

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
    }
  }, [item]);

  if (!isOpen || !formData) return null;

  const handleStartOrDurationChange = (
    field: 'startTime' | 'duration',
    value: string
  ) => {
    const nextStart = field === 'startTime' ? value : formData.startTime;
    const nextDuration = field === 'duration' ? value : formData.duration;
    const nextEnd = computeEndTime(nextStart, nextDuration);
    setFormData({
      ...formData,
      [field]: value,
      endTime: nextEnd,
    });
  };

  const adjustTimeField = (
    field: 'startTime' | 'duration',
    deltaSec: number
  ) => {
    const currentSec = parseTimeToSeconds(formData[field]);
    const nextSec =
      field === 'startTime'
        ? (currentSec + deltaSec + 86400) % 86400
        : Math.max(5, currentSec + deltaSec);
    handleStartOrDurationChange(field, formatSecondsToTime(nextSec));
  };

  const handleWorkflowStageChange = (nextStage: WorkflowStage) => {
    setFormData({
      ...formData,
      workflowStatus: nextStage,
      status: mapWorkflowToBroadcastStatus(nextStage),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData, autoCascade);
  };

  const availableVersions = formData.versions || [];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden spatial-modal-content"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              {isNew
                ? `افزودن برنامه جدید به کنداکتور (ردیف ${formData.order})`
                : `ویرایش آیتم کنداکتور و تنظیمات پرونده — ردیف ${formData.order}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تنظیمات زمان‌بندی، شناسه مدیا، بازبین مسئول، نسخه معتبر فایل و وضعیت گردش‌کار
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-sky-300">
                تنظیم‌کننده ردیف:{' '}
                <strong>{formData.createdBy || 'خانم مرادی (واحد هماهنگی)'}</strong>
              </span>
              {formData.lastEditedBy && (
                <span className="px-2 py-0.5 rounded bg-teal-500/15 border border-teal-400/30 text-teal-300">
                  آخرین ویرایش‌کننده:{' '}
                  <strong>
                    {formData.lastEditedBy}
                    {formData.lastEditedAt ? ` (${formData.lastEditedAt})` : ''}
                  </strong>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                عنوان برنامه / باکس پخش *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="مثال: برنامه زنده صبح نصف جهان"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                شماره قسمت / فصل
              </label>
              <input
                type="text"
                value={formData.episode || ''}
                onChange={(e) =>
                  setFormData({ ...formData, episode: e.target.value })
                }
                placeholder="مثال: قسمت ۱۸۲"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Timing section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 bg-slate-950/70 border border-slate-800/90 rounded-lg">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                ساعت شروع (HH:MM:SS)
              </label>
              <input
                type="text"
                required
                dir="ltr"
                pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"
                value={formData.startTime}
                onChange={(e) =>
                  handleStartOrDurationChange('startTime', e.target.value)
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono-tabular text-teal-300 text-center focus:outline-none focus:border-teal-500"
              />
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {[
                  { label: '+1 دقیقه', delta: 60 },
                  { label: '-1 دقیقه', delta: -60 },
                  { label: '+10 ثانیه', delta: 10 },
                  { label: '-10 ثانیه', delta: -10 },
                ].map((step) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => adjustTimeField('startTime', step.delta)}
                    className="py-1 px-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] text-slate-300 hover:text-teal-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                مدت زمان (HH:MM:SS)
              </label>
              <input
                type="text"
                required
                dir="ltr"
                pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"
                value={formData.duration}
                onChange={(e) =>
                  handleStartOrDurationChange('duration', e.target.value)
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono-tabular text-amber-300 text-center focus:outline-none focus:border-teal-500"
              />
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {[
                  { label: '+1 دقیقه', delta: 60 },
                  { label: '-1 دقیقه', delta: -60 },
                  { label: '+10 ثانیه', delta: 10 },
                  { label: '-10 ثانیه', delta: -10 },
                ].map((step) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => adjustTimeField('duration', step.delta)}
                    className="py-1 px-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] text-slate-300 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">
                ساعت پایان (محاسبه خودکار)
              </label>
              <input
                type="text"
                readOnly
                dir="ltr"
                value={formData.endTime}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-sm font-mono-tabular text-slate-300 text-center cursor-not-allowed"
              />
              <div className="text-[10px] text-slate-500 text-center pt-1">
                به‌روزرسانی آنی با تغییر شروع یا مدت
              </div>
            </div>
          </div>

          {/* Quick Duration Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">مدت زمان‌های پرتکرار:</span>
            {[
              { label: '۳ دقیقه (تیزر)', val: '00:03:00' },
              { label: '۵ دقیقه (آگهی)', val: '00:05:00' },
              { label: '۱۵ دقیقه (خبر)', val: '00:15:00' },
              { label: '۳۰ دقیقه (مستند)', val: '00:30:00' },
              { label: '۴۵ دقیقه (برنامه/سریال)', val: '00:45:00' },
              { label: '۶۰ دقیقه (زنده)', val: '01:00:00' },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() =>
                  handleStartOrDurationChange('duration', preset.val)
                }
                className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                طبقه برنامه (Category)
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as ProgramCategory,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              >
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                منبع سیگنال (Source)
              </label>
              <select
                value={formData.source}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    source: e.target.value as SignalSource,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              >
                {Object.entries(SOURCE_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label} ({meta.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                شناسه برنامه / کد مدیا (Media ID)
              </label>
              <input
                type="text"
                dir="ltr"
                required
                value={formData.mediaCode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mediaCode: e.target.value.toUpperCase(),
                  })
                }
                placeholder="SER-ISFAHAN-101"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono-tabular text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Workflow Stage, Active Version & Assigned Inspector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                مرحله گردش‌کار پرونده
              </label>
              <select
                value={formData.workflowStatus || 'approved_for_playout'}
                disabled={!canApproveReject}
                onChange={(e) =>
                  handleWorkflowStageChange(e.target.value as WorkflowStage)
                }
                className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500 disabled:opacity-50"
              >
                {Object.entries(WORKFLOW_STAGE_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    گام {meta.stepNumber}: {meta.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                <span>نسخه معتبر فایل</span>
              </label>
              {availableVersions.length > 1 ? (
                <select
                  value={formData.revisionVersion || 1}
                  onChange={(e) => {
                    const vNum = Number(e.target.value);
                    const foundVer = availableVersions.find(
                      (v) => v.versionNumber === vNum
                    );
                    setFormData({
                      ...formData,
                      revisionVersion: vNum,
                      videoFileName:
                        foundVer?.videoFileName || formData.videoFileName,
                      videoUrl: foundVer?.videoUrl || formData.videoUrl,
                    });
                  }}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-teal-500/40 rounded-lg text-xs font-mono-tabular text-teal-300"
                >
                  {availableVersions.map((v) => (
                    <option key={v.versionNumber} value={v.versionNumber}>
                      نسخه v{v.versionNumber} ({v.videoFileName})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min={1}
                  dir="ltr"
                  value={formData.revisionVersion || 1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      revisionVersion: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono-tabular text-teal-300 text-center"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>کارشناس بازبین مربوط (QC)</span>
              </label>
              <input
                type="text"
                value={formData.assignedInspectorName || 'مهندس کریمی'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    assignedInspectorName: e.target.value,
                  })
                }
                placeholder="نام بازبین مسئول"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                وضعیت اجرای پخش
              </label>
              <select
                value={formData.status}
                disabled={!canApproveReject}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as BroadcastStatus,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-teal-500 disabled:opacity-50"
              >
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                تهیه‌کننده / واحد تحویل‌دهنده
              </label>
              <input
                type="text"
                value={formData.producerName || ''}
                onChange={(e) =>
                  setFormData({ ...formData, producerName: e.target.value })
                }
                placeholder="واحد تولید سیمای اصفهان"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                اسپانسر / سفارش‌دهنده
              </label>
              <input
                type="text"
                value={formData.sponsor || ''}
                onChange={(e) =>
                  setFormData({ ...formData, sponsor: e.target.value })
                }
                placeholder="اختیاری (ویژه بازرگانی)"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              توضیحات فنی، زیرنویس و دستورات رژی (Notes)
            </label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="توضیحات سوییچ استودیو، زیرنویس، ارتباط زنده یا ملاحظات بازبینی..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <div className="flex flex-wrap items-center gap-4">
              <label
                className={`inline-flex items-center gap-2 text-xs select-none ${
                  canLockTimes
                    ? 'cursor-pointer text-slate-200'
                    : 'cursor-not-allowed text-slate-500'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!canLockTimes}
                  checked={Boolean(formData.lockStartTime)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lockStartTime: e.target.checked,
                    })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500"
                />
                {formData.lockStartTime ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>قفل باکس رأس ساعت (ویژه اخبار و اذان)</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCascade}
                  onChange={(e) => setAutoCascade(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500"
                />
                <span>بازشماری خودکار ساعت شروع آیتم‌های بعدی</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>ذخیره در کنداکتور</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
