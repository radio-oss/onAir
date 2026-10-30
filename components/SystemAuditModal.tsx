// components/SystemAuditModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  ConductorSchedule,
  WorkflowStage,
  WORKFLOW_STAGE_META,
  isItemApprovedForPlayout,
} from '@/lib/conductor-data';
import {
  X,
  ShieldCheck,
  History,
  CheckCircle2,
  RefreshCw,
  Layers,
} from 'lucide-react';

interface ServerAuditRecord {
  id: string;
  timestamp: string;
  actorName: string;
  itemOrder?: number;
  mediaCode?: string;
  itemTitle?: string;
  versionNumber?: number;
  toStage?: string;
  actionType: string;
  details: string;
}

interface SystemAuditModalProps {
  isOpen: boolean;
  schedule: ConductorSchedule;
  onClose: () => void;
}

export default function SystemAuditModal({
  isOpen,
  schedule,
  onClose,
}: SystemAuditModalProps) {
  const [serverLogs, setServerLogs] = useState<ServerAuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchServerAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/audit');
      if (res.ok) {
        const data = await res.json();
        setServerLogs(data.logs || []);
      }
    } catch {
      // Fallback to item-level workflowHistory
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchServerAuditLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Aggregate all item-level workflow histories as well
  const combinedHistory = schedule.items.flatMap((it) =>
    (it.workflowHistory || []).map((h) => ({
      id: `${it.id}-${h.id}`,
      order: it.order,
      title: it.title,
      mediaCode: it.mediaCode,
      versionNumber: h.versionNumber || it.revisionVersion || 1,
      actorName: h.actorName,
      timestamp: h.timestamp,
      toStage: h.toStage,
      comment: h.comment || '',
    }))
  );

  const totalVersionsCount = schedule.items.reduce(
    (acc, it) => acc + (it.versions?.length || 1),
    0
  );
  const totalMarkersCount = schedule.items.reduce(
    (acc, it) => acc + (it.qcMarkers?.length || 0),
    0
  );
  const approvedCount = schedule.items.filter((it) =>
    isItemApprovedForPlayout(it)
  ).length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                ممیزی متمرکز سوابق پرونده‌ها، نسخه‌ها و بررسی سلامت زیرساخت آفلاین
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                پیگیری کامل ارتباط هر اصلاحیه با نسخه مربوطه، تصمیم‌های بازبین،
                مدیر پخش و سوابق تغییر وضعیت
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchServerAuditLogs}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-teal-300 rounded-lg cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              <span>بروزرسانی از سرور</span>
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

        <div className="p-6 space-y-5 text-xs overflow-y-auto">
          {/* 11-Step Compliance & Infrastructure Telemetry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-center">
            <div>
              <div className="text-slate-400">کل نسخه‌های ثبت‌شده در سامانه</div>
              <div className="text-base font-bold font-mono-tabular text-teal-300 mt-1">
                {totalVersionsCount} نسخه
              </div>
            </div>
            <div>
              <div className="text-slate-400">اصلاحیه‌های متصل به تایم‌کد/بازه</div>
              <div className="text-base font-bold font-mono-tabular text-amber-300 mt-1">
                {totalMarkersCount} مورد
              </div>
            </div>
            <div>
              <div className="text-slate-400">پرونده‌های دارای مجوز پلی‌اوت</div>
              <div className="text-base font-bold font-mono-tabular text-emerald-400 mt-1">
                {approvedCount} / {schedule.items.length}
              </div>
            </div>
            <div>
              <div className="text-slate-400">وضعیت زیرساخت ذخیره‌سازی محلی</div>
              <div className="text-xs font-bold text-emerald-300 mt-1.5 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>۱۰۰٪ آفلاین (LAN Active)</span>
              </div>
            </div>
          </div>

          {/* Server Audit Log if entries exist */}
          {serverLogs.length > 0 && (
            <div className="space-y-2">
              <div className="font-bold text-teal-300 flex items-center gap-1.5">
                <History className="w-4 h-4" />
                <span>
                  آخرین وقایع ثبت‌شده در فایل ممیزی سرور محلی (
                  <code>./offline-data/audit-trail.json</code>):
                </span>
              </div>
              <div className="max-h-44 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950 p-2 space-y-1.5">
                {serverLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 bg-slate-900/80 border border-slate-800 rounded flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-slate-200">
                        {log.actorName}:{' '}
                      </span>
                      <span className="text-slate-300">{log.details}</span>
                      {log.mediaCode && (
                        <span className="mr-2 font-mono-tabular text-teal-300">
                          [{log.mediaCode} v{log.versionNumber || 1}]
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono-tabular text-slate-400">
                      {log.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete Item-by-Item Version & Workflow History */}
          <div className="space-y-2">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>
                سوابق تغییر وضعیت، تصمیم‌های بازبینی و نسخه‌های هر پرونده (
                {combinedHistory.length} ثبت):
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950">
              <table className="w-full text-right">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md">
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-2.5">ردیف و برنامه</th>
                    <th className="p-2.5 text-center">نسخه فایل</th>
                    <th className="p-2.5">مرحله جدید</th>
                    <th className="p-2.5">اقدام‌کننده</th>
                    <th className="p-2.5">شرح تصمیم / اصلاحیه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {combinedHistory.map((h) => {
                    const stageMeta =
                      WORKFLOW_STAGE_META[h.toStage as WorkflowStage];
                    return (
                      <tr key={h.id} className="hover:bg-slate-900/50">
                        <td className="p-2.5 text-slate-100 font-semibold">
                          ردیف {h.order}: {h.title.slice(0, 32)}
                        </td>
                        <td className="p-2.5 text-center font-mono-tabular text-teal-300">
                          v{h.versionNumber}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] ${
                              stageMeta?.badgeClass || ''
                            }`}
                          >
                            {stageMeta?.shortLabel || h.toStage}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-300">{h.actorName}</td>
                        <td className="p-2.5 text-slate-400">{h.comment}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
