'use client';

import React, { useState, useMemo } from 'react';
import {
  ScheduleItem,
  BroadcastStatus,
  RoleDefinition,
  WORKFLOW_STAGE_META,
  formatDurationTotal,
  parseTimeToSeconds,
  isItemApprovedForPlayout,
} from '@/lib/conductor-data';
import BroadcastVideoPlayer from './BroadcastVideoPlayer';
import PlayoutHardwareBridgePanel from './PlayoutHardwareBridgePanel';
import PlayoutGraphicsController from './PlayoutGraphicsController';
import { PaginationControls } from './RoleIsolatedPortals';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BellRing,
  CalendarClock,
  Download,
  Monitor,
  Server,
  ShieldCheck,
  SkipForward,
  Sun,
  Terminal,
  Tv,
  Search,
} from 'lucide-react';

export type PlayoutEmergencyMode =
  | 'normal'
  | 'standby_filler'
  | 'station_slate'
  | 'smpte_bars';

export interface ActivePlayoutState {
  currentItem?: ScheduleItem;
  nextItem?: ScheduleItem;
  remainingSec: number;
  progressPercent: number;
}

interface PlayoutManagementPanelProps {
  scheduleStartTime: string;
  allScheduleItems: ScheduleItem[];
  playoutQueueItems: ScheduleItem[];
  activePlayoutState: ActivePlayoutState;
  resolvedPreviewItem: ScheduleItem | null;
  previewTimeSec: number;
  isPreviewPlaying: boolean;
  clockSec: number;
  isClockRunning: boolean;
  emergencyMode: PlayoutEmergencyMode;
  currentRole: RoleDefinition;
  nextAzanStatus: {
    label: string;
    exactTime: string;
    remainingFormatted: string;
    isImminent: boolean;
    isOnNow: boolean;
  };
  isfahanAzanTimes: {
    dhuhr: string;
    maghrib: string;
    fajr?: string;
    sunrise?: string;
    sunset?: string;
    midnight?: string;
  };
  getEffectiveItemDurationSec: (item: ScheduleItem) => number;
  onChangeStatus: (
    id: string,
    nextStatus: BroadcastStatus,
    resetRemainingSec?: number
  ) => void;
  onSetStudioClockSec: (sec: number) => void;
  onSetIsClockRunning: (running: boolean) => void;
  onSetEmergencyMode: (mode: PlayoutEmergencyMode) => void;
  onOpenTrimModal: (item: ScheduleItem) => void;
  onSetPreviewItem: (item: ScheduleItem) => void;
  onSetPreviewTimeSec: (sec: number) => void;
  onSetIsPreviewPlaying: (playing: boolean) => void;
  onOpenCleanFeed: () => void;
  onOpenTomorrowAzan: () => void;
  onExportCasparScript: () => void;
  onExportEDL: () => void;
  onMoveItem: (index: number, direction: 'up' | 'down') => void;
  onStatusToast: (msg: string) => void;
  onTakeNextCue?: () => void;
}

export default function PlayoutManagementPanel({
  scheduleStartTime,
  allScheduleItems,
  playoutQueueItems,
  activePlayoutState,
  resolvedPreviewItem,
  previewTimeSec,
  isPreviewPlaying,
  clockSec,
  isClockRunning,
  emergencyMode,
  currentRole,
  nextAzanStatus,
  isfahanAzanTimes,
  getEffectiveItemDurationSec,
  onChangeStatus,
  onSetStudioClockSec,
  onSetIsClockRunning,
  onSetEmergencyMode,
  onOpenTrimModal,
  onSetPreviewItem,
  onSetPreviewTimeSec,
  onSetIsPreviewPlaying,
  onOpenCleanFeed,
  onOpenTomorrowAzan,
  onExportCasparScript,
  onExportEDL,
  onMoveItem,
  onStatusToast,
  onTakeNextCue,
}: PlayoutManagementPanelProps) {
  const [playoutSubTab, setPlayoutSubTab] = useState<
    'monitors_and_queue' | 'cg_graphics' | 'hardware_bridge'
  >('monitors_and_queue');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(8);
  const [queueSearchQuery, setQueueSearchQuery] = useState<string>('');

  const filteredQueueItems = useMemo(() => {
    if (!queueSearchQuery.trim()) return playoutQueueItems;
    const q = queueSearchQuery.trim().toLowerCase();
    return playoutQueueItems.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.mediaCode.toLowerCase().includes(q) ||
        (it.episode || '').toLowerCase().includes(q)
    );
  }, [playoutQueueItems, queueSearchQuery]);

  const paginatedQueueItems = useMemo(() => {
    const safePage = Math.min(
      page,
      Math.max(1, Math.ceil(filteredQueueItems.length / pageSize))
    );
    const start = (safePage - 1) * pageSize;
    return filteredQueueItems.slice(start, start + pageSize);
  }, [filteredQueueItems, page, pageSize]);

  /**
   * handleChangeStatus:
   * When setting an item to 'on_air', calculates remainingSec as
   * (parseTimeToSeconds(item.duration) - item.trimInSec) - (currentTime - start)
   * to prevent duration desyncs and jump errors during item transitions.
   */
  const handleChangeStatus = (id: string, nextStatus: BroadcastStatus) => {
    const found = allScheduleItems.find((it) => it.id === id);
    if (!found) return;

    if (nextStatus === 'on_air') {
      const item = {
        ...found,
        trimInSec: found.trimInSec ?? 0,
      };
      const start = parseTimeToSeconds(item.startTime);
      const playableSpan = Math.max(
        1,
        parseTimeToSeconds(item.duration) - item.trimInSec
      );
      const rawClock = Math.floor(clockSec);
      const currentTime =
        rawClock >= start && rawClock < start + playableSpan ? rawClock : start;

      const calculatedRemaining =
        parseTimeToSeconds(item.duration) -
        item.trimInSec -
        (currentTime - start);
      const remainingSec = Math.max(0, calculatedRemaining);

      onChangeStatus(id, nextStatus, remainingSec);
      return;
    }

    onChangeStatus(id, nextStatus);
  };

  return (
    <section className="space-y-4">
      {/* Compact Playout Navigation Bar (OS 26 Segmented Pill Control) + Safe Harbor + Azan Readiness */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/[0.08] shadow-inner">
          <button
            type="button"
            onClick={() => setPlayoutSubTab('monitors_and_queue')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold cursor-pointer transition-all ${
              playoutSubTab === 'monitors_and_queue'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>
              ۱. مانیتورهای پخش (PVW/PGM) و صف پلی‌اوت ({playoutQueueItems.length}
              )
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPlayoutSubTab('cg_graphics')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold cursor-pointer transition-all ${
              playoutSubTab === 'cg_graphics'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>۲. کنترلر زیرنویس و گرافیک زنده آنتن (CG)</span>
          </button>

          <button
            type="button"
            onClick={() => setPlayoutSubTab('hardware_bridge')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold cursor-pointer transition-all ${
              playoutSubTab === 'hardware_bridge'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>۳. سوکت سرور سخت‌افزاری (TCP/AMCP) و سوییچ اضطراری</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
          <span
            title="تنها فایل‌های دارای تأیید نهایی بازبینی و هماهنگی مجوز پخش روی آنتن را دارند"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-sans font-bold text-[11px]"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Gatekeeper: محافظ ایمنی آنتن فعال</span>
          </span>

          {nextAzanStatus.isImminent ? (
            <BellRing className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-teal-400" />
          )}
          <span className="text-teal-300 font-sans font-bold">
            {nextAzanStatus.label}:
          </span>
          <span className="text-amber-300 font-bold">
            {nextAzanStatus.exactTime}
          </span>
          <span className="text-slate-400">
            (مانده: {nextAzanStatus.remainingFormatted})
          </span>
          <span className="text-slate-500 text-[11px] hidden xl:inline">
            [ظهر: {isfahanAzanTimes.dhuhr} | مغرب: {isfahanAzanTimes.maghrib}]
          </span>
          <button
            type="button"
            onClick={onOpenTomorrowAzan}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-500/20 border border-teal-500/40 text-teal-200 font-sans font-bold text-[11px] cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5 text-amber-300" />
            <span>اوقات فردا</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: MONITORS & PAGINATED PLAYOUT QUEUE */}
      {playoutSubTab === 'monitors_and_queue' && (
        <div className="space-y-4">
          {/* Master Switcher Bar (TAKE NEXT CUE & Smart 15s Final Countdown) */}
          <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono-tabular font-bold">
                  PGM ON-AIR
                </span>
                <span className="font-bold text-slate-100">
                  {activePlayoutState.currentItem
                    ? `${activePlayoutState.currentItem.title} (ردیف ${activePlayoutState.currentItem.order})`
                    : 'بدون برنامه فعال'}
                </span>
              </div>

              <span className="text-slate-600 hidden sm:inline">←</span>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono-tabular font-bold">
                  NEXT / PVW
                </span>
                <span className="font-semibold text-slate-300">
                  {activePlayoutState.nextItem
                    ? `${activePlayoutState.nextItem.title} (${activePlayoutState.nextItem.startTime})`
                    : 'پایان کنداکتور شیفت'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Smart Countdown Box (Flashes Rose/Amber when <= 15s) */}
              <div
                className={`px-3.5 py-1.5 rounded-xl border font-mono-tabular text-xs flex items-center gap-2 transition-colors ${
                  activePlayoutState.remainingSec > 0 &&
                  activePlayoutState.remainingSec <= 15
                    ? 'border-rose-500/60 bg-rose-950/40 text-rose-300 animate-pulse font-bold'
                    : 'border-slate-800 bg-slate-950 text-teal-300 font-semibold'
                }`}
              >
                <span className="font-sans text-[11px] text-slate-400">
                  زمان باقی‌مانده آنتن:
                </span>
                <span className="text-sm font-bold tracking-wider">
                  {formatDurationTotal(activePlayoutState.remainingSec)}
                </span>
              </div>

              {onTakeNextCue && currentRole.canChangePlayoutStatus && (
                <button
                  type="button"
                  disabled={!activePlayoutState.nextItem}
                  onClick={onTakeNextCue}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer transition-all shadow-lg"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>سوییچ به برنامه بعدی | TAKE NEXT CUE</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Right 6 Columns: PREVIEW & TRIM MONITOR (PVW) */}
            <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 border-t-2 border-t-amber-400/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
              <div className="min-h-[36px] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-100">
                    مانیتور پیش‌نمایش و کنترل پیش از پخش (PVW / Pre-Flight)
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/90 border border-amber-400/35 text-[11px] font-medium text-amber-200 truncate max-w-[230px]">
                    {resolvedPreviewItem
                      ? `${resolvedPreviewItem.title} (${resolvedPreviewItem.mediaCode})`
                      : 'بدون آیتم'}
                  </span>
                </div>
                {currentRole.canTrimPlayout && resolvedPreviewItem && (
                  <button
                    type="button"
                    onClick={() => onOpenTrimModal(resolvedPreviewItem)}
                    className="px-3 py-1 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs rounded-md cursor-pointer shrink-0"
                  >
                    تنظیم محدوده زمانی (Mark In / Out)
                  </button>
                )}
              </div>

              {resolvedPreviewItem && (
                <BroadcastVideoPlayer
                  item={resolvedPreviewItem}
                  currentTimeSec={previewTimeSec}
                  isPlaying={isPreviewPlaying}
                  enforceTrim={true}
                  onTimeChange={onSetPreviewTimeSec}
                  onPlayStateChange={onSetIsPreviewPlaying}
                />
              )}
            </div>

            {/* Left 6 Columns: PROGRAM ON-AIR ANTENNA MONITOR (PGM) */}
            <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 border-t-2 border-t-rose-500 shadow-[0_-4px_20px_-4px_rgba(244,63,94,0.35)] rounded-2xl p-4 flex flex-col justify-between space-y-3">
              <div className="min-h-[36px] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <h3 className="text-sm font-bold text-rose-300">
                    خروجی زنده زنجیره پخش و آنتن (PGM / ON-AIR OUTPUT)
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/90 border border-rose-500/40 text-[11px] font-medium text-rose-200 truncate max-w-[230px]">
                    {activePlayoutState.currentItem
                      ? `${activePlayoutState.currentItem.title} (${activePlayoutState.currentItem.mediaCode})`
                      : 'بدون آیتم'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenCleanFeed}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-md cursor-pointer shrink-0"
                >
                  خروجی تمام‌صفحه آنتن (Clean Feed)
                </button>
              </div>

              {activePlayoutState.currentItem && (
                <BroadcastVideoPlayer
                  item={activePlayoutState.currentItem}
                  currentTimeSec={
                    (activePlayoutState.currentItem.trimInSec || 0) +
                    Math.max(
                      0,
                      getEffectiveItemDurationSec(
                        activePlayoutState.currentItem
                      ) - activePlayoutState.remainingSec
                    )
                  }
                  clockSec={clockSec}
                  dayStartSec={parseTimeToSeconds(
                    scheduleStartTime || '06:00:00'
                  )}
                  isPlaying={isClockRunning}
                  enforceTrim={true}
                  emergencyMode={emergencyMode}
                  onTimeChange={(sec) => {
                    if (!currentRole.canChangePlayoutStatus) return;
                    const itemStart = parseTimeToSeconds(
                      activePlayoutState.currentItem!.startTime
                    );
                    const offset = Math.max(
                      0,
                      sec - (activePlayoutState.currentItem!.trimInSec || 0)
                    );
                    onSetStudioClockSec((itemStart + offset) % 86400);
                  }}
                  onPlayStateChange={(playing) => {
                    if (!currentRole.canChangePlayoutStatus) return;
                    onSetIsClockRunning(playing);
                  }}
                />
              )}
            </div>
          </div>

           {/* Paginated Playout Queue Table */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  صف پلی‌اوت (فایل‌های تأیید نهایی شده ارسالی از واحد هماهنگی)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  تنظیم زمان پخش، محدوده زمانی (Mark In / Out)، ترتیب پلی‌لیست و
                  اجرای پخش روی آنتن
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Quick Search Box in Playout Queue */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={queueSearchQuery}
                    onChange={(e) => {
                      setQueueSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="جستجوی سریع عنوان یا کد مدیا..."
                    className="pr-8 pl-3 py-1.5 w-56 bg-slate-950/90 border border-white/[0.1] rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={onExportCasparScript}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>خروجی اسکریپت CasparCG</span>
                </button>
                <button
                  type="button"
                  onClick={onExportEDL}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>خروجی تایم‌لاین EDL</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-white/[0.08] rounded-xl bg-slate-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),inset_-12px_0_16px_-12px_rgba(0,0,0,0.55),inset_12px_0_16px_-12px_rgba(0,0,0,0.55)]">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-400">
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">#</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">ساعت پخش</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">عنوان برنامه و نسخه معتبر</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">
                      محدوده زمانی (Mark In - Out)
                    </th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">مدت خالص</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">وضعیت تأیید و پخش</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">
                      عملیات مدیریت پلی‌اوت
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {paginatedQueueItems.map((item) => {
                    const actualIdx = allScheduleItems.findIndex(
                      (i) => i.id === item.id
                    );
                    const isOnAir =
                      activePlayoutState.currentItem?.id === item.id;
                    const trimIn = item.trimInSec ?? 0;
                    const trimOut =
                      item.trimOutSec ??
                      (item.sourceDurationSec ||
                        parseTimeToSeconds(item.duration));
                    const approvedForPlayout = isItemApprovedForPlayout(item);

                    return (
                      <tr
                        key={item.id}
                        className={
                          isOnAir
                            ? 'bg-rose-950/30 font-semibold'
                            : !approvedForPlayout
                            ? 'bg-amber-950/15'
                            : 'hover:bg-slate-900/60'
                        }
                      >
                        <td className="py-2.5 px-3 text-center font-mono-tabular">
                          {item.order}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-tabular text-teal-300">
                          {item.startTime}
                        </td>
                        <td className="py-2.5 px-3 text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{item.title}</span>
                            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono-tabular text-teal-300">
                              v{item.revisionVersion || 1}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-tabular text-amber-300">
                          {formatDurationTotal(trimIn)} تا{' '}
                          {formatDurationTotal(trimOut)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-tabular text-slate-200">
                          {item.duration}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded border text-[11px] ${
                                WORKFLOW_STAGE_META[
                                  item.workflowStatus || 'approved_for_playout'
                                ].badgeClass
                              }`}
                            >
                              {
                                WORKFLOW_STAGE_META[
                                  item.workflowStatus || 'approved_for_playout'
                                ].shortLabel
                              }
                            </span>
                            {isOnAir ? (
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[11px] text-rose-300 font-bold">
                                ● روی آنتن (ON-AIR)
                              </span>
                            ) : approvedForPlayout ? (
                              <span className="text-[11px] text-emerald-400">
                                ✓ آماده پخش
                              </span>
                            ) : (
                              <span className="text-[11px] text-rose-400 font-semibold">
                                ✕ مسدود
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                onSetPreviewItem(item);
                                onSetPreviewTimeSec(item.trimInSec || 0);
                                onSetIsPreviewPlaying(true);
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              پیش‌نمایش
                            </button>

                            {currentRole.canTrimPlayout && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onOpenTrimModal(item)}
                                  className="px-2.5 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 rounded whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  تریم (In/Out)
                                </button>
                                <button
                                  type="button"
                                  disabled={actualIdx <= 0}
                                  onClick={() => onMoveItem(actualIdx, 'up')}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded shrink-0 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    actualIdx >= allScheduleItems.length - 1
                                  }
                                  onClick={() => onMoveItem(actualIdx, 'down')}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded shrink-0 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {currentRole.canChangePlayoutStatus && (
                              <button
                                type="button"
                                disabled={!approvedForPlayout}
                                onClick={() => {
                                  handleChangeStatus(item.id, 'on_air');
                                }}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                اجرای پخش (Take)
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={page}
              totalItems={filteredQueueItems.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LIVE CG & TICKER CONTROLLER */}
      {playoutSubTab === 'cg_graphics' && <PlayoutGraphicsController />}

      {/* SUB-TAB 3: HARDWARE TCP/AMCP BRIDGE & EMERGENCY OVERRIDE */}
      {playoutSubTab === 'hardware_bridge' && (
        <div className="space-y-4">
          <div className="p-4 bg-rose-950/25 border border-rose-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>سوییچ اضطراری خروجی آنتن (Emergency Override)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                تغییر حالت سیگنال خروجی در شرایط اضطراری رژی پخش
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'normal', label: 'وضعیت عادی (پلی‌لیست کنداکتور)' },
                  {
                    id: 'standby_filler',
                    label: 'پخش میان‌برنامه احتیاطی (Filler)',
                  },
                  {
                    id: 'station_slate',
                    label: 'آرم استیشن ثابت شبکه اصفهان',
                  },
                  { id: 'smpte_bars', label: 'کالربار فنی (SMPTE Bars)' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  disabled={!currentRole.canChangePlayoutStatus}
                  onClick={() => {
                    onSetEmergencyMode(mode.id);
                    onStatusToast(`حالت خروجی آنتن: ${mode.label}`);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 ${
                    emergencyMode === mode.id
                      ? 'bg-teal-400 text-slate-950'
                      : 'bg-slate-900 text-slate-300 border border-slate-700'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <PlayoutHardwareBridgePanel
            currentItem={activePlayoutState.currentItem}
            nextItem={activePlayoutState.nextItem}
            canControlPlayout={currentRole.canChangePlayoutStatus}
            isMonitoringOnly={Boolean(currentRole.isMonitoringOnly)}
            onStatusToast={onStatusToast}
          />
        </div>
      )}
    </section>
  );
}
