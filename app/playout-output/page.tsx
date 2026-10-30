'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  ATTACHED_CONDUCTOR_SCHEDULE,
  ConductorSchedule,
  ScheduleItem,
  parseTimeToSeconds,
  toBroadcastTimelineSeconds,
  formatSecondsToTime,
  isItemApprovedForPlayout,
} from '@/lib/conductor-data';
import { loadOfflineVideoBlobUrl } from '@/lib/offline-media-db';
import { getNextIsfahanAzanStatus } from '@/lib/isfahan-azan-calculator';
import {
  OnAirGraphicsState,
  DEFAULT_GRAPHICS_STATE,
  CG_STORAGE_KEY,
} from '@/components/PlayoutGraphicsController';
import TomorrowAzanPreviewModal from '@/components/TomorrowAzanPreviewModal';
import { Sun, BellRing, CalendarClock } from 'lucide-react';

const STORAGE_KEY = 'irib_isfahan_conductor_schedule_v2';

export default function PlayoutAntennaOutputPage() {
  const [schedule, setSchedule] = useState<ConductorSchedule>(
    ATTACHED_CONDUCTOR_SCHEDULE
  );
  const [cgState, setCgState] = useState<OnAirGraphicsState>(
    DEFAULT_GRAPHICS_STATE
  );
  const [clockSec, setClockSec] = useState<number>(
    parseTimeToSeconds('07:25:10')
  );
  const [activeBlobUrl, setActiveBlobUrl] = useState<string | null>(null);
  const [showHud, setShowHud] = useState<boolean>(false);
  const [emergencyMode, setEmergencyMode] = useState<
    'normal' | 'standby_filler' | 'station_slate' | 'smpte_bars'
  >(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('irib_isfahan_emergency_mode_v1');
        if (
          saved === 'normal' ||
          saved === 'standby_filler' ||
          saved === 'station_slate' ||
          saved === 'smpte_bars'
        ) {
          return saved as any;
        }
      }
    } catch {
      // Fallback
    }
    return 'normal';
  });
  const [isTomorrowAzanModalOpen, setIsTomorrowAzanModalOpen] =
    useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Load & Sync Schedule and CG Graphics from LocalStorage, BroadcastChannel, and LAN APIs
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSchedule(JSON.parse(saved));
      }
      const savedCg = localStorage.getItem(CG_STORAGE_KEY);
      if (savedCg) {
        setCgState(JSON.parse(savedCg));
      }
      const savedEm = localStorage.getItem('irib_isfahan_emergency_mode_v1');
      if (
        savedEm === 'normal' ||
        savedEm === 'standby_filler' ||
        savedEm === 'station_slate' ||
        savedEm === 'smpte_bars'
      ) {
        setEmergencyMode(savedEm as any);
      }
    } catch {
      // Fallback to default
    }

    const ch =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('irib_isfahan_conductor_sync')
        : null;

    if (ch) {
      ch.onmessage = (ev) => {
        if (ev.data && Array.isArray(ev.data.items)) {
          setSchedule(ev.data);
        }
      };
    }

    const cgCh =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('irib_isfahan_cg_sync')
        : null;

    if (cgCh) {
      cgCh.onmessage = (ev) => {
        if (ev.data && typeof ev.data === 'object') {
          setCgState(ev.data);
        }
      };
    }

    const emCh =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('irib_isfahan_emergency_sync')
        : null;

    if (emCh) {
      emCh.onmessage = (ev) => {
        if (
          ev.data &&
          ev.data.type === 'EMERGENCY_MODE_CHANGE' &&
          ev.data.mode
        ) {
          setEmergencyMode(ev.data.mode);
        }
      };
    }

    // Initial sync with LAN APIs on mount
    fetch('/api/schedule')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          setSchedule(data);
        }
      })
      .catch(() => {});

    fetch('/api/playout/cg')
      .then((r) => (r.ok ? r.json() : null))
      .then((cgData) => {
        if (cgData && typeof cgData.crawlText === 'string') {
          setCgState(cgData);
        }
      })
      .catch(() => {});

    const handleStorage = (ev: StorageEvent) => {
      try {
        if (ev.key === STORAGE_KEY && ev.newValue) {
          const parsed = JSON.parse(ev.newValue);
          if (parsed && Array.isArray(parsed.items)) setSchedule(parsed);
        } else if (ev.key === CG_STORAGE_KEY && ev.newValue) {
          const parsedCg = JSON.parse(ev.newValue);
          if (parsedCg && typeof parsedCg === 'object') setCgState(parsedCg);
        } else if (ev.key === 'irib_isfahan_emergency_mode_v1' && ev.newValue) {
          setEmergencyMode(ev.newValue as any);
        }
      } catch {
        // Ignore parse error
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      ch?.close();
      cgCh?.close();
      emCh?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // 2. Continuous Master Broadcast Clock — Always synced to System Clock
  useEffect(() => {
    const syncToSystemTime = () => {
      const now = new Date();
      setClockSec(
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
      );
    };
    syncToSystemTime();
    const timer = setInterval(syncToSystemTime, 500);
    return () => clearInterval(timer);
  }, []);

  // Calculate next Azan (Dhuhr or Maghrib) status based on IsfahanPrayerTimes
  const nextAzanStatus = useMemo(
    () =>
      getNextIsfahanAzanStatus(clockSec, schedule.dateGregorian || '2026-10-04'),
    [clockSec, schedule.dateGregorian]
  );

  // 3. Determine Current On-Air Item & Offset within Trim Bounds
  const dayStart = schedule.startTime || '06:00:00';
  const playheadTimeline = toBroadcastTimelineSeconds(
    formatSecondsToTime(clockSec),
    dayStart
  );

  let currentItem: ScheduleItem = schedule.items[0];
  let elapsedInSlot = 0;

  for (const item of schedule.items) {
    const startT = toBroadcastTimelineSeconds(item.startTime, dayStart);
    const dur = Math.max(1, parseTimeToSeconds(item.duration));
    if (playheadTimeline >= startT && playheadTimeline < startT + dur) {
      currentItem = item;
      elapsedInSlot = playheadTimeline - startT;
      break;
    }
  }

  const isApprovedForAir = currentItem
    ? isItemApprovedForPlayout(currentItem)
    : false;

  const trimInSec = currentItem?.trimInSec ?? 0;
  const trimOutSec =
    currentItem?.trimOutSec ??
    (currentItem?.sourceDurationSec ||
      parseTimeToSeconds(currentItem?.duration || '00:15:00'));
  const targetMediaTimeSec = Math.min(trimOutSec, trimInSec + elapsedInSlot);

  const currentItemId = currentItem?.id;
  const currentItemVideoUrl = currentItem?.videoUrl;
  const currentItemRevision = currentItem?.revisionVersion || 1;

  // 4. Resolve IndexedDB Video Blob or LAN URL ONLY if approved for playout
  useEffect(() => {
    if (!currentItemId || !isApprovedForAir) {
      setActiveBlobUrl(null);
      return;
    }
    if (currentItemVideoUrl) {
      setActiveBlobUrl(currentItemVideoUrl);
      return;
    }
    loadOfflineVideoBlobUrl(currentItemId, currentItemRevision).then((url) => {
      setActiveBlobUrl(url);
    });
  }, [
    currentItemId,
    currentItemVideoUrl,
    currentItemRevision,
    isApprovedForAir,
  ]);

  // 5. Sync HTML5 Video Playhead to Trimmed Broadcast Time
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeBlobUrl || !isApprovedForAir) return;
    if (Math.abs(v.currentTime - targetMediaTimeSec) > 1.2) {
      v.currentTime = targetMediaTimeSec;
    }
    v.play().catch(() => {});
  }, [targetMediaTimeSec, activeBlobUrl, isApprovedForAir]);

  // 6. Render Clean Broadcast Graphics or Safe Standby Slate on Canvas
  useEffect(() => {
    if ((activeBlobUrl && isApprovedForAir) || !currentItem) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#042f2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (!isApprovedForAir) {
      ctx.fillStyle = '#5eead4';
      ctx.font = 'bold 46px Vazirmatn, IRANSans, Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('شبکه اصفهان', w / 2, h / 2 - 20);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '26px Vazirmatn, IRANSans, Tahoma, sans-serif';
      ctx.fillText(
        'پخش میان‌برنامه احتیاطی (محافظ ایمنی پلی‌اوت فعال است)',
        w / 2,
        h / 2 + 36
      );
      return;
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 42px Vazirmatn, IRANSans, Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(currentItem.title, w / 2, h / 2 - 14);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px Vazirmatn, IRANSans, Tahoma, sans-serif';
    ctx.fillText(
      currentItem.episode || currentItem.notes || 'پخش زنده سیمای مرکز اصفهان',
      w / 2,
      h / 2 + 38
    );
  }, [clockSec, currentItem, activeBlobUrl, isApprovedForAir]);

  return (
    <div
      onMouseMove={() => {
        setShowHud(true);
        setTimeout(() => setShowHud(false), 3000);
      }}
      className="fixed inset-0 bg-black overflow-hidden select-none cursor-none hover:cursor-default"
    >
      {/* Slim Top Notification Bar for Next Azan Readiness (Visible only when engineer moves mouse / showHud is true) */}
      <div
        dir="rtl"
        className={`absolute top-0 inset-x-0 z-30 px-6 py-1.5 border-b flex flex-wrap items-center justify-between gap-3 text-xs backdrop-blur-md transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } ${
          nextAzanStatus.isOnNow
            ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100'
            : nextAzanStatus.isImminent
            ? 'bg-amber-950/90 border-amber-400 text-amber-100 animate-pulse'
            : 'bg-slate-950/85 border-teal-500/40 text-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {nextAzanStatus.isImminent ? (
            <BellRing className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          )}
          <span className="font-bold text-teal-300">
            آماده‌باش سوئیچ اذان آنتن:
          </span>
          <span className="font-semibold">{nextAzanStatus.label}</span>
          <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 font-mono-tabular font-bold text-amber-300">
            ساعت دقیق: {nextAzanStatus.exactTime}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono-tabular text-[11px]">
          <span>
            مانده تا باکس اذان بعدی:{' '}
            <strong className="text-teal-300 font-bold">
              {nextAzanStatus.remainingFormatted}
            </strong>
          </span>
          <span className="text-slate-400 hidden sm:inline">
            (ظهر: {nextAzanStatus.allTimes.dhuhr} | مغرب:{' '}
            {nextAzanStatus.allTimes.maghrib})
          </span>
          <button
            type="button"
            onClick={() => setIsTomorrowAzanModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 font-sans font-bold text-[11px] transition-colors cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5 text-amber-300" />
            <span>پیش‌نمایش اوقات شرعی فردا</span>
          </button>
        </div>
      </div>

      {activeBlobUrl && isApprovedForAir ? (
        <video
          ref={videoRef}
          src={activeBlobUrl}
          autoPlay
          playsInline
          className="w-full h-full object-contain bg-black"
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="w-full h-full object-cover"
        />
      )}

      {/* Emergency Override Signal Overlay (SMPTE Bars / Station Slate / Standby Filler) */}
      {emergencyMode && emergencyMode !== 'normal' && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between bg-slate-950 pointer-events-none select-none">
          {emergencyMode === 'smpte_bars' ? (
            <div className="flex-1 grid grid-cols-7 w-full h-full">
              <div className="bg-slate-100" />
              <div className="bg-yellow-400" />
              <div className="bg-cyan-400" />
              <div className="bg-emerald-500" />
              <div className="bg-fuchsia-500" />
              <div className="bg-rose-600" />
              <div className="bg-blue-600" />
            </div>
          ) : emergencyMode === 'station_slate' ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-teal-950/60 to-slate-900 p-6 text-center">
              <div className="w-24 h-24 rounded-3xl bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center shadow-[0_0_40px_rgba(45,212,191,0.35)] mb-4">
                <span className="text-2xl font-bold text-teal-300">اصفهان</span>
              </div>
              <div className="text-xl font-bold text-white">
                صدا و سیمای جمهوری اسلامی ایران — سیمای مرکز اصفهان
              </div>
              <div className="text-sm text-teal-300 mt-2 font-mono-tabular">
                STATION SLATE ACTIVE · سیگنال پایدار و رسمی استودیو پخش
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-amber-950/40 to-slate-900 p-6 text-center">
              <div className="px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-sm font-bold mb-3">
                STANDBY FILLER LOOP
              </div>
              <div className="text-xl font-bold text-white">
                پخش میان‌برنامه احتیاطی (Standby Filler — تصاویری از نصف جهان)
              </div>
              <div className="text-sm text-slate-300 mt-2">
                در حال پخش خودکار از سرور پشتیبان رژی تا بازگشت سیگنال اصلی
              </div>
            </div>
          )}
          <div className="bg-slate-950/95 border-t border-rose-500/50 px-6 py-2.5 flex items-center justify-between text-xs">
            <span className="font-bold text-rose-400 animate-pulse flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>سوییچ اضطراری آنتن فعال است (EMERGENCY OVERRIDE)</span>
            </span>
            <span className="font-mono-tabular text-amber-300 font-bold">
              {emergencyMode === 'smpte_bars'
                ? 'SIGNAL: SMPTE 75% COLOR BARS'
                : emergencyMode === 'station_slate'
                ? 'SIGNAL: ISFAHAN TV STATION SLATE'
                : 'SIGNAL: STANDBY FILLER LOOP'}
            </span>
          </div>
        </div>
      )}

      {/* LIVE DSK / CG OVERLAYS */}
      {cgState.showChannelBug && (
        <div className="absolute top-11 left-10 px-4 py-2 bg-slate-950/80 border border-teal-500/60 rounded-lg text-teal-300 font-bold text-sm shadow-lg">
          شبکه اصفهان
        </div>
      )}

      {cgState.showLiveBadge && (
        <div className="absolute top-11 right-10 px-3.5 py-1.5 bg-rose-600/90 text-white font-bold text-xs rounded-md flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>پخش زنده | LIVE</span>
        </div>
      )}

      {cgState.showClockOverlay && (
        <div className="absolute top-24 left-10 px-3 py-1 bg-slate-950/75 border border-slate-700 rounded text-slate-200 font-mono-tabular text-xs">
          {formatSecondsToTime(clockSec)}
        </div>
      )}

      {cgState.showLowerThird && (
        <div className="absolute bottom-20 right-12 left-12 max-w-2xl bg-slate-950/90 border-r-4 border-teal-400 px-5 py-3 rounded-l-xl shadow-2xl">
          <div className="text-base font-bold text-slate-100">
            {cgState.lowerThirdTitle}
          </div>
          {cgState.lowerThirdSubtitle && (
            <div className="text-xs text-teal-300 mt-1">
              {cgState.lowerThirdSubtitle}
            </div>
          )}
        </div>
      )}

      {cgState.showCrawlTicker && cgState.crawlText && (
        <div className="absolute bottom-0 inset-x-0 bg-slate-950/95 border-t border-teal-500/50 py-2 px-6 text-xs text-slate-100 flex items-center gap-3 overflow-hidden">
          <span className="px-2 py-0.5 bg-teal-400 text-slate-950 font-bold rounded shrink-0 z-10">
            اطلاعیه پخش
          </span>
          <div className="flex-1 overflow-hidden font-medium">
            <span className="broadcast-ticker-track">{cgState.crawlText}</span>
          </div>
        </div>
      )}

      {/* Subtle Hover HUD for Engineer Verification */}
      {showHud && currentItem && (
        <div className="absolute bottom-14 left-6 right-6 p-4 bg-slate-950/90 border border-slate-700 rounded-xl flex items-center justify-between text-xs text-slate-200">
          <div>
            <span className="font-bold text-rose-400">ON-AIR CLEAN FEED: </span>
            <span>{currentItem.title}</span>
            <span className="mr-3 font-mono-tabular text-teal-300">
              [{currentItem.mediaCode} — v{currentItem.revisionVersion || 1}]
            </span>
          </div>
          <div className="font-mono-tabular flex items-center gap-4">
            <span>ساعت آنتن: {formatSecondsToTime(clockSec)}</span>
            <span>
              بازه تریم: {formatSecondsToTime(trimInSec)} تا{' '}
              {formatSecondsToTime(trimOutSec)}
            </span>
            <button
              type="button"
              onClick={() => document.documentElement.requestFullscreen?.()}
              className="px-3 py-1 bg-teal-400 text-slate-950 font-bold rounded cursor-pointer"
            >
              تمام‌صفحه (F11)
            </button>
          </div>
        </div>
      )}

      <TomorrowAzanPreviewModal
        isOpen={isTomorrowAzanModalOpen}
        baseDateGregorian={schedule.dateGregorian || '2026-10-04'}
        baseDateJalali={schedule.dateShamsi}
        onClose={() => setIsTomorrowAzanModalOpen(false)}
      />
    </div>
  );
}
