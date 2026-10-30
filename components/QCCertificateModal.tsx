// components/QCCertificateModal.tsx
'use client';

import React from 'react';
import {
  ScheduleItem,
  CATEGORY_META,
  QC_CATEGORY_META,
  WORKFLOW_STAGE_META,
  formatDurationTotal,
  parseTimeToSeconds,
  isItemApprovedForPlayout,
} from '@/lib/conductor-data';
import { X, Printer, ShieldCheck, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';

interface QCCertificateModalProps {
  isOpen: boolean;
  item: ScheduleItem | null;
  dateShamsi: string;
  directorName: string;
  plannerName: string;
  onClose: () => void;
}

export default function QCCertificateModal({
  isOpen,
  item,
  dateShamsi,
  directorName,
  plannerName,
  onClose,
}: QCCertificateModalProps) {
  if (!isOpen || !item) return null;

  const markers = item.qcMarkers || [];
  const versions = item.versions || [];
  const trimIn = item.trimInSec ?? 0;
  const trimOut =
    item.trimOutSec ??
    (item.sourceDurationSec || parseTimeToSeconds(item.duration));
  const isApproved = isItemApprovedForPlayout(item);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden print:bg-white print:text-black print:border-none max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <h3 className="text-sm font-bold text-slate-100">
              گواهی رسمی بازبینی (QC)، سوابق نسخه و مجوز پلی‌اوت برنامه
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ گواهی بازبینی</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 text-xs leading-relaxed overflow-y-auto print:bg-white print:text-black">
          {/* Header Banner */}
          <div className="border border-slate-700 print:border-slate-400 print:bg-white print:text-black p-4 rounded-lg flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-bold text-sm print:text-black">
                صدا و سیمای جمهوری اسلامی ایران — مرکز اصفهان (شبکه اصفهان)
              </div>
              <div className="text-slate-400 print:text-black mt-0.5">
                فرم رسمی بازبینی فنی/محتوایی (QC)، کنترل نسخه معتبر و دستور تریم پلی‌اوت
              </div>
            </div>
            <div className="text-left font-mono-tabular space-y-0.5 print:text-black">
              <div>تاریخ پخش: {dateShamsi}</div>
              <div>ردیف کنداکتور: {item.order}</div>
              <div>
                شناسه مدیا: {item.mediaCode} (نسخه v{item.revisionVersion || 1})
              </div>
            </div>
          </div>

          {/* Approval Status Alert */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between print:bg-white print:text-black print:border-slate-400 ${
              isApproved
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold print:text-black">
              {isApproved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 print:text-black" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 print:text-black" />
              )}
              <span>
                وضعیت فعلی پرونده:{' '}
                {
                  WORKFLOW_STAGE_META[
                    item.workflowStatus || 'approved_for_playout'
                  ].label
                }
              </span>
            </div>
            <span className="font-mono-tabular print:text-black">
              نسخه معتبر: v{item.revisionVersion || 1}
            </span>
          </div>

          {/* Program Metadata & Trim Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-950/60 border border-slate-800 print:bg-white print:text-black print:border-slate-400 rounded-lg">
            <div>
              <span className="text-slate-400 print:text-black">عنوان برنامه: </span>
              <strong className="text-slate-100 print:text-black">{item.title}</strong>
            </div>
            <div>
              <span className="text-slate-400 print:text-black">قسمت / کلاکت: </span>
              <strong className="print:text-black">{item.episode || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 print:text-black">طبقه برنامه: </span>
              <strong className="print:text-black">{CATEGORY_META[item.category]?.label}</strong>
            </div>
            <div>
              <span className="text-slate-400 print:text-black">نقطه شروع (Mark In): </span>
              <strong className="font-mono-tabular text-teal-300 print:text-black">
                {formatDurationTotal(trimIn)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 print:text-black">نقطه پایان (Mark Out): </span>
              <strong className="font-mono-tabular text-amber-300 print:text-black">
                {formatDurationTotal(trimOut)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 print:text-black">مدت زمان مورد استفاده: </span>
              <strong className="font-mono-tabular text-emerald-300 print:text-black">
                {item.duration}
              </strong>
            </div>
          </div>

          {/* Version History Table */}
          {versions.length > 0 && (
            <div className="space-y-2">
              <div className="font-bold text-slate-200 print:text-black flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-400 print:text-black" />
                <span>
                  سوابق نسخه‌های بارگذاری‌شده فایل ({versions.length} نسخه):
                </span>
              </div>
              <table className="w-full border-collapse border border-slate-700 print:border-slate-400 print:bg-white print:text-black text-right">
                <thead>
                  <tr className="bg-slate-800 text-slate-200 print:bg-white print:text-black">
                    <th className="p-2 border border-slate-700 print:border-slate-400">نسخه</th>
                    <th className="p-2 border border-slate-700 print:border-slate-400">نام فایل</th>
                    <th className="p-2 border border-slate-700 print:border-slate-400">مدت</th>
                    <th className="p-2 border border-slate-700 print:border-slate-400">تحویل‌دهنده</th>
                    <th className="p-2 border border-slate-700 print:border-slate-400">توضیحات نسخه</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((ver) => (
                    <tr key={ver.versionNumber}>
                      <td className="p-2 border border-slate-700 print:border-slate-400 font-mono-tabular font-bold">
                        v{ver.versionNumber}
                      </td>
                      <td className="p-2 border border-slate-700 print:border-slate-400 font-mono-tabular">
                        {ver.videoFileName}
                      </td>
                      <td className="p-2 border border-slate-700 print:border-slate-400 font-mono-tabular">
                        {ver.duration}
                      </td>
                      <td className="p-2 border border-slate-700 print:border-slate-400">
                        {ver.uploadedBy}
                      </td>
                      <td className="p-2 border border-slate-700 print:border-slate-400">
                        {ver.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* QC Markers Table */}
          <div className="space-y-2">
            <div className="font-bold text-slate-200 print:text-black">
              جدول اصلاحیه‌های متصل به زمان / بازه زمانی ({markers.length} مورد):
            </div>
            {markers.length === 0 ? (
              <div className="p-3 border border-slate-800 print:border-slate-400 print:bg-white print:text-black rounded text-emerald-300">
                ✓ این برنامه بدون هیچ‌گونه ایراد فنی یا محتوایی بازبینی و تأیید
                شده است.
              </div>
            ) : (
              <table className="w-full border-collapse border border-slate-700 print:border-slate-400 print:bg-white print:text-black text-right">
                <thead>
                  <tr className="bg-slate-800 text-slate-200 print:bg-white print:text-black">
                    <th className="p-2 border border-slate-700 print:border-slate-400">
                      زمان / بازه زمانی
                    </th>
                    <th className="p-2 border border-slate-700 print:border-slate-400">نسخه</th>
                    <th className="p-2 border border-slate-700 print:border-slate-400">نوع مورد</th>
                    <th className="p-2 border border-slate-700 print:border-slate-400">شرح بازبین</th>
                    <th className="p-2 border border-slate-700 print:border-slate-400">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {markers.map((m) => (
                    <tr key={m.id}>
                      <td className="p-2 border border-slate-700 print:border-slate-400 font-mono-tabular">
                        {m.endTimecode
                          ? `${m.timecode} تا ${m.endTimecode}`
                          : m.timecode}
                      </td>
                      <td className="p-2 border border-slate-700 print:border-slate-400 font-mono-tabular">
                        v{m.versionNumber || 1}
                      </td>
                      <td className="p-2 border border-slate-700 print:border-slate-400">
                        {QC_CATEGORY_META[m.category].label}
                      </td>
                      <td className="p-2 border border-slate-700 print:border-slate-400">{m.note}</td>
                      <td className="p-2 border border-slate-700 print:border-slate-400">
                        {m.resolved ? 'رفع‌شده در نسخه جدید' : 'در پرونده'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-800 print:border-slate-400 text-center">
            <div className="border border-slate-700 print:border-slate-400 print:bg-white print:text-black p-3 rounded">
              <div className="font-bold">تهیه‌کننده و تدوینگر</div>
              <div className="mt-1 text-slate-400 print:text-black">
                {item.producerName || 'واحد تولید'}
              </div>
              <div className="mt-6 text-[10px] text-slate-500 print:text-black">
                تحویل نسخه v{item.revisionVersion || 1}
              </div>
            </div>
            <div className="border border-slate-700 print:border-slate-400 print:bg-white print:text-black p-3 rounded">
              <div className="font-bold">کارشناس بازبین (QC)</div>
              <div className="mt-1 text-slate-400 print:text-black">
                {item.assignedInspectorName || 'مهندس کریمی'}
              </div>
              <div className="mt-6 text-[10px] text-slate-500 print:text-black">مهر و امضا</div>
            </div>
            <div className="border border-slate-700 print:border-slate-400 print:bg-white print:text-black p-3 rounded">
              <div className="font-bold">واحد هماهنگی</div>
              <div className="mt-1 text-slate-400 print:text-black">{plannerName}</div>
              <div className="mt-6 text-[10px] text-slate-500 print:text-black">مهر و امضا</div>
            </div>
            <div className="border border-slate-700 print:border-slate-400 print:bg-white print:text-black p-3 rounded">
              <div className="font-bold">مدیر پخش (تصمیم نهایی)</div>
              <div className="mt-1 text-slate-400 print:text-black">{directorName || 'محمود فرشچیان'}</div>
              <div className="mt-6 text-[10px] text-slate-500 print:text-black">
                وضعیت:{' '}
                {
                  WORKFLOW_STAGE_META[
                    item.workflowStatus || 'approved_for_playout'
                  ].shortLabel
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
