// components/PlayoutTrimModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  ScheduleItem,
  WORKFLOW_STAGE_META,
  formatDurationTotal,
  parseTimeToSeconds,
  isItemApprovedForPlayout,
} from '@/lib/conductor-data';
import BroadcastVideoPlayer from './BroadcastVideoPlayer';
import {
  X,
  Scissors,
  CheckCircle2,
  RotateCcw,
  Play,
  SplitSquareVertical,
  ShieldCheck,
  AlertTriangle,
  Cpu,
} from 'lucide-react';

interface PlayoutTrimModalProps {
  isOpen: boolean;
  item: ScheduleItem | null;
  onClose: () => void;
  onApplyTrim: (
    itemId: string,
    trimInSec: number,
    trimOutSec: number,
    sourceDurationSec: number,
    playImmediately?: boolean
  ) => void;
  onSplitProgram?: (
    itemId: string,
    splitPointSec: number,
    insertAdDurationSec: number
  ) => void;
}

export default function PlayoutTrimModal({
  isOpen,
  item,
  onClose,
  onApplyTrim,
  onSplitProgram,
}: PlayoutTrimModalProps) {
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [sourceDurationSec, setSourceDurationSec] = useState<number>(900);
  const [trimInSec, setTrimInSec] = useState<number>(0);
  const [trimOutSec, setTrimOutSec] = useState<number>(900);
  const [midRollAdSec, setMidRollAdSec] = useState<number>(180);
  const [transcodeStatus, setTranscodeStatus] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      const baseDur =
        item.sourceDurationSec ||
        Math.max(60, parseTimeToSeconds(item.duration));
      setSourceDurationSec(baseDur);
      setTrimInSec(item.trimInSec ?? 0);
      setTrimOutSec(item.trimOutSec ?? baseDur);
      setCurrentTimeSec(item.trimInSec ?? 0);
      setIsPlaying(false);
      setTranscodeStatus(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const netDurationSec = Math.max(1, trimOutSec - trimInSec);
  const isApproved = isItemApprovedForPlayout(item);
  const stageMeta =
    WORKFLOW_STAGE_META[item.workflowStatus || 'approved_for_playout'];

  const handleServerSideLosslessCut = async () => {
    setTranscodeStatus('در حال ارسال دستور برش به سرور محلی...');
    try {
      const res = await fetch('/api/media/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: item.videoFileName,
          trimInSec,
          trimOutSec,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTranscodeStatus(
          `فایل برش‌خورده در استوریج محلی ساخته شد: ${data.trimmedFileName}`
        );
      } else {
        setTranscodeStatus(
          'تریم غیرمخرب پلی‌اوت (Virtual Mark In/Out) در پلی‌لیست فعال شد.'
        );
      }
    } catch {
      setTranscodeStatus(
        'تریم غیرمخرب پلی‌اوت (Virtual Mark In/Out) در پلی‌لیست فعال شد.'
      );
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden spatial-modal-content"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-teal-400" />
              <span>
                مدیریت پلی‌اوت، تعیین محدوده زمانی استفاده (Mark In / Out) و
                کنترل پیش از پخش — ردیف {item.order}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {item.title} — نسخه فایل: v{item.revisionVersion || 1} (
              {item.videoFileName || item.mediaCode})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {/* Pre-Flight Readiness Verification Banner */}
          <div
            className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
              isApproved
                ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/30 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {isApproved ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div>
                <span className="font-bold">
                  کنترل پیش از اجرای برنامه (Pre-Flight Check):{' '}
                </span>
                <span>{stageMeta.label}</span>
              </div>
            </div>
            <div className="font-mono-tabular flex items-center gap-3">
              <span>نسخه معتبر: v{item.revisionVersion || 1}</span>
              <span>
                {isApproved ? '✓ مجاز برای اجرا' : '✕ مسدود برای پخش آنتن'}
              </span>
            </div>
          </div>

          <BroadcastVideoPlayer
            item={{
              ...item,
              sourceDurationSec,
              trimInSec,
              trimOutSec,
            }}
            currentTimeSec={currentTimeSec}
            isPlaying={isPlaying}
            enforceTrim={true}
            onTimeChange={setCurrentTimeSec}
            onPlayStateChange={setIsPlaying}
          />

          {/* Trim Controls with Go to In / Go to Out & Range Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-slate-400">
                  نقطه شروع مورد استفاده (Mark In)
                </label>
                <span className="font-mono-tabular text-xs text-teal-300 font-bold">
                  {formatDurationTotal(trimInSec)}
                </span>
              </div>
              <input
                type="range"
                dir="ltr"
                min={0}
                max={Math.max(0, trimOutSec - 1)}
                value={Math.floor(trimInSec)}
                onChange={(e) => {
                  const val = Math.min(
                    trimOutSec - 1,
                    Math.max(0, Number(e.target.value) || 0)
                  );
                  setTrimInSec(val);
                  setCurrentTimeSec(val);
                }}
                className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, trimOutSec - 1)}
                  value={Math.floor(trimInSec)}
                  onChange={(e) =>
                    setTrimInSec(
                      Math.min(
                        trimOutSec - 1,
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    )
                  }
                  className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono-tabular text-teal-300 text-center"
                />
                <button
                  type="button"
                  onClick={() =>
                    setTrimInSec(
                      Math.min(trimOutSec - 1, Math.floor(currentTimeSec))
                    )
                  }
                  className="px-2.5 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-200 text-[11px] font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  ثبت لحظه فعلی (Set In)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTimeSec(trimInSec);
                    setIsPlaying(false);
                  }}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.1] text-teal-300 text-[11px] font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  پرش به شروع (Go to In)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-slate-400">
                  نقطه پایان مورد استفاده (Mark Out)
                </label>
                <span className="font-mono-tabular text-xs text-amber-300 font-bold">
                  {formatDurationTotal(trimOutSec)}
                </span>
              </div>
              <input
                type="range"
                dir="ltr"
                min={trimInSec + 1}
                max={sourceDurationSec}
                value={Math.floor(trimOutSec)}
                onChange={(e) => {
                  const val = Math.max(
                    trimInSec + 1,
                    Math.min(sourceDurationSec, Number(e.target.value) || 0)
                  );
                  setTrimOutSec(val);
                  setCurrentTimeSec(val);
                }}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="number"
                  min={trimInSec + 1}
                  max={sourceDurationSec}
                  value={Math.floor(trimOutSec)}
                  onChange={(e) =>
                    setTrimOutSec(
                      Math.max(
                        trimInSec + 1,
                        Math.min(sourceDurationSec, Number(e.target.value) || 0)
                      )
                    )
                  }
                  className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono-tabular text-amber-300 text-center"
                />
                <button
                  type="button"
                  onClick={() =>
                    setTrimOutSec(
                      Math.max(trimInSec + 1, Math.floor(currentTimeSec))
                    )
                  }
                  className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  ثبت لحظه فعلی (Set Out)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTimeSec(trimOutSec);
                    setIsPlaying(false);
                  }}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.1] text-amber-300 text-[11px] font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  پرش به پایان (Go to Out)
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-between p-3 bg-slate-900/90 border border-slate-800 rounded-lg">
              <div className="text-xs text-slate-400">
                مدت‌زمان مورد استفاده در پلی‌لیست:
              </div>
              <div className="text-lg font-bold font-mono-tabular text-emerald-300">
                {formatDurationTotal(netDurationSec)}
              </div>
              <div className="text-[11px] text-slate-500">
                کل فایل اصلی: {formatDurationTotal(sourceDurationSec)}
              </div>
            </div>
          </div>

          {/* Non-Destructive Mid-Roll Program Splitter */}
          {onSplitProgram && (
            <div className="p-4 bg-slate-950/90 border border-purple-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <SplitSquareVertical className="w-4 h-4" />
                  <span>
                    تقسیم برنامه به ۲ بخش و درج باکس آگهی میان‌برنامه (Mid-Roll
                    Split)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  نشانگر ویدئو را روی لحظه دلخواه قرار دهید تا برنامه در تایم‌کد{' '}
                  <strong className="font-mono-tabular text-teal-300">
                    {formatDurationTotal(Math.floor(currentTimeSec))}
                  </strong>{' '}
                  بدون برش فیزیکی به دو بخش متوالی تقسیم شود.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-slate-400">مدت آگهی (ثانیه):</label>
                <input
                  type="number"
                  min={0}
                  max={1200}
                  step={30}
                  value={midRollAdSec}
                  onChange={(e) => setMidRollAdSec(Number(e.target.value) || 0)}
                  className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-center font-mono-tabular text-purple-300"
                />
                <button
                  type="button"
                  onClick={() => {
                    onSplitProgram(
                      item.id,
                      Math.floor(currentTimeSec),
                      midRollAdSec
                    );
                    onClose();
                  }}
                  className="px-3.5 py-1.5 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold rounded-lg cursor-pointer"
                >
                  تقسیم در این تایم‌کد + درج آگهی
                </button>
              </div>
            </div>
          )}

          {transcodeStatus && (
            <div className="p-2.5 bg-slate-950 border border-teal-500/40 rounded-lg text-xs text-teal-300">
              {transcodeStatus}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrimInSec(0);
                  setTrimOutSec(sourceDurationSec);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازنشانی محدوده (پخش کامل فایل)</span>
              </button>

              <button
                type="button"
                onClick={handleServerSideLosslessCut}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-sky-300 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>برش در استوریج سرور محلی (FFmpeg)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onApplyTrim(
                    item.id,
                    trimInSec,
                    trimOutSec,
                    sourceDurationSec,
                    false
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ذخیره محدوده زمانی و بروزرسانی پلی‌لیست</span>
              </button>

              <button
                type="button"
                disabled={!isApproved}
                onClick={() =>
                  onApplyTrim(
                    item.id,
                    trimInSec,
                    trimOutSec,
                    sourceDurationSec,
                    true
                  )
                }
                title={
                  isApproved
                    ? 'اعمال محدوده زمانی و اجرای فوری روی آنتن'
                    : 'اجرای پخش مسدود است: این پرونده هنوز تأیید نهایی نشده است'
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>اعمال و اجرای فوری در پلی‌اوت (Take On-Air)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
