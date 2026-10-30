'use client';

import React, { useMemo, useState } from 'react';
import {
  calculateTomorrowIsfahanPrayerPreview,
  IsfahanPrayerTimes,
} from '@/lib/isfahan-azan-calculator';
import {
  Sun,
  X,
  CalendarClock,
  Clock,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';

interface TomorrowAzanPreviewModalProps {
  isOpen: boolean;
  baseDateGregorian: string;
  baseDateJalali?: string;
  onClose: () => void;
  onApplyTomorrowAzanToSchedule?: (tomorrowTimes: IsfahanPrayerTimes) => void;
}

export default function TomorrowAzanPreviewModal({
  isOpen,
  baseDateGregorian,
  baseDateJalali,
  onClose,
  onApplyTomorrowAzanToSchedule,
}: TomorrowAzanPreviewModalProps) {
  const [selectedOffsetDays, setSelectedOffsetDays] = useState<number>(1);
  const [copiedBoxKey, setCopiedBoxKey] = useState<string | null>(null);

  const previewData = useMemo(() => {
    const base = new Date(baseDateGregorian || '2026-10-04');
    const validBase = Number.isNaN(base.getTime())
      ? new Date('2026-10-04')
      : base;
    // Shift by (selectedOffsetDays - 1) so calculateTomorrowIsfahanPrayerPreview computes target day
    const shiftedBase = new Date(
      validBase.getTime() + (selectedOffsetDays - 1) * 86400000
    )
      .toISOString()
      .slice(0, 10);
    return calculateTomorrowIsfahanPrayerPreview(shiftedBase);
  }, [baseDateGregorian, selectedOffsetDays]);

  if (!isOpen) return null;

  const handleCopyTime = (key: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedBoxKey(key);
    setTimeout(() => setCopiedBoxKey(null), 1800);
  };

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none cursor-default"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-3xl bg-slate-900 border border-teal-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                پیش‌نمایش دقیق اوقات شرعی و برنامه‌ریزی باکس‌های اذان روز آینده
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                محاسبه نجومی آفلاین به افق مرکز اصفهان (عرض جغرافیایی ۳۲.۶۵۴۶°
                شمالی، طول ۵۱.۶۶۸۰° شرقی — مرکز ژئوفیزیک)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Date Selector & Summary Banner */}
          <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              <CalendarClock className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-slate-400">تاریخ مبنای کنداکتور فعلی:</span>
              <span className="font-bold text-slate-200">
                {baseDateJalali ? `${baseDateJalali} — ` : ''}
                <span className="font-mono-tabular">{baseDateGregorian}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-teal-300 font-bold">
                تاریخ هدف پیش‌نمایش:{' '}
                <span className="font-mono-tabular">
                  {previewData.tomorrowDateGregorian}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { offset: 1, label: 'فردا (+۱ روز)' },
                { offset: 2, label: 'پس‌فردا (+۲ روز)' },
                { offset: 3, label: '۳ روز آینده' },
                { offset: 7, label: 'هفته آینده (+۷ روز)' },
              ].map((opt) => (
                <button
                  key={opt.offset}
                  type="button"
                  onClick={() => setSelectedOffsetDays(opt.offset)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    selectedOffsetDays === opt.offset
                      ? 'bg-teal-400 text-slate-950'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Highlighted Main Broadcast Azan Boxes (Dhuhr & Maghrib & Fajr) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {previewData.rows
              .filter((r) => r.isMainBroadcastBox)
              .map((box) => (
                <div
                  key={box.key}
                  className="p-4 rounded-xl bg-slate-950/90 border border-amber-500/35 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">
                      {box.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular font-bold ${
                        box.diffSeconds > 0
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          : box.diffSeconds < 0
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {box.diffSeconds > 0
                        ? `+${box.diffSeconds}s نسبت به روز قبل`
                        : box.diffSeconds < 0
                        ? `${box.diffSeconds}s نسبت به روز قبل`
                        : 'بدون تغییر'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      ساعت دقیق اذان فردا:
                    </span>
                    <span className="text-xl font-bold font-mono-tabular text-teal-300">
                      {box.tomorrowTime}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">
                        شروع پیشنهادی باکس (نیایش/تلاوت):
                      </span>
                      <span className="font-mono-tabular font-semibold text-slate-200">
                        {box.recommendedPreBoxStart}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">
                        پایان پیشنهادی باکس اذان (۱۵ دقیقه):
                      </span>
                      <span className="font-mono-tabular font-semibold text-slate-200">
                        {box.recommendedBoxEnd}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyTime(
                        box.key,
                        `${box.title} (${previewData.tomorrowDateGregorian}): ساعت دقیق اذان ${box.tomorrowTime} | باکس پیشنهادی از ${box.recommendedPreBoxStart} تا ${box.recommendedBoxEnd}`
                      )
                    }
                    className="w-full mt-1 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedBoxKey === box.key ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300 font-semibold">
                          تایم‌کد باکس کپی شد
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-teal-400" />
                        <span>کپی تایم‌کد برای کنداکتور فردا</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
          </div>

          {/* Complete 5-Horizon Comparison Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
            <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-400" />
                <span>
                  جدول کامل مقایسه اوقات شرعی امروز و روز هدف به افق اصفهان
                </span>
              </div>
              <span className="text-[11px] font-normal text-slate-400">
                دقت ثانیه‌ای (HH:MM:SS) جهت برنامه‌ریزی پلی‌اوت
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">عنوان افق شرعی</th>
                    <th className="py-2.5 px-4">
                      ساعت امروز ({previewData.todayDateGregorian})
                    </th>
                    <th className="py-2.5 px-4 text-teal-300">
                      ساعت روز هدف ({previewData.tomorrowDateGregorian})
                    </th>
                    <th className="py-2.5 px-4">اختلاف روزانه</th>
                    <th className="py-2.5 px-4">بازه پیشنهادی باکس کنداکتور</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {previewData.rows.map((row) => (
                    <tr
                      key={row.key}
                      className={
                        row.isMainBroadcastBox
                          ? 'bg-amber-950/10 hover:bg-amber-950/20'
                          : 'hover:bg-slate-900/50'
                      }
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-200">
                        {row.title}
                        {row.isMainBroadcastBox && (
                          <span className="mr-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                            باکس اصلی آنتن
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-400">
                        {row.todayTime}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular font-bold text-teal-300 text-sm">
                        {row.tomorrowTime}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-300">
                        {row.diffSeconds > 0
                          ? `+${row.diffSeconds} ثانیه`
                          : row.diffSeconds < 0
                          ? `${row.diffSeconds} ثانیه`
                          : '۰ ثانیه'}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-300">
                        {row.isMainBroadcastBox
                          ? `${row.recommendedPreBoxStart} تا ${row.recommendedBoxEnd}`
                          : '— (اعلام در زیرنویس/گرافیک)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            مسئول پلی‌اوت و هماهنگی می‌توانند زمان دقیق باکس‌های اذان ظهر (
            <strong className="font-mono-tabular text-amber-300">
              {previewData.tomorrowTimes.dhuhr}
            </strong>
            ) و مغرب (
            <strong className="font-mono-tabular text-amber-300">
              {previewData.tomorrowTimes.maghrib}
            </strong>
            ) را از همین پنجره در کنداکتور روز آینده لحاظ نمایند.
          </div>

          <div className="flex items-center gap-2">
            {onApplyTomorrowAzanToSchedule && (
              <button
                type="button"
                onClick={() => {
                  onApplyTomorrowAzanToSchedule(previewData.tomorrowTimes);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>اعمال ساعت اذان فردا روی ردیف اذان کنداکتور</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
            >
              بستن پنجره
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
