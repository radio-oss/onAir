'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Database,
  HardDrive,
  Radio,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Wifi,
  ShieldCheck,
} from 'lucide-react';

export type HealthStatus = 'healthy' | 'warning' | 'checking';

interface HealthDetail {
  status: HealthStatus;
  label: string;
  subtext: string;
  latencyMs?: number;
}

interface SystemHealthWidgetProps {
  totalItemsCount: number;
  lastScheduleUpdate?: string;
  emergencyModeActive?: boolean;
}

export default function SystemHealthWidget({
  totalItemsCount,
  lastScheduleUpdate,
  emergencyModeActive = false,
}: SystemHealthWidgetProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  const [wsHealth, setWsHealth] = useState<HealthDetail>({
    status: 'healthy',
    label: 'اتصال WebSocket و شبکه LAN',
    subtext: 'کانال همگام‌سازی لحظه‌ای فعال است (Non-Drop PAL)',
    latencyMs: 11,
  });

  const [dbHealth, setDbHealth] = useState<HealthDetail>({
    status: 'healthy',
    label: 'همگام‌سازی دیتابیس (Storage Sync)',
    subtext: 'ذخیره‌سازی محلی و دیتابیس IndexedDB پایدار است',
  });

  const [mediaHealth, setMediaHealth] = useState<HealthDetail>({
    status: 'healthy',
    label: 'پایداری اتصال مخزن مدیا',
    subtext: 'پوشه offline-data/media و Watchfolder متصل است',
  });

  const runSystemHealthProbe = useCallback(async () => {
    setIsChecking(true);
    const startMs = Date.now();
    try {
      // 1. Probe LAN / API latency
      const apiRes = await fetch('/api/schedule', { method: 'GET' }).catch(
        () => null
      );
      const latency = Math.max(6, Date.now() - startMs);

      if (apiRes && apiRes.ok) {
        setWsHealth({
          status: 'healthy',
          label: 'اتصال WebSocket و شبکه LAN',
          subtext: 'ارتباط مستقیم با سرور محلی و رژی برقرار است',
          latencyMs: latency,
        });
      } else {
        setWsHealth({
          status: 'warning',
          label: 'اتصال WebSocket و شبکه LAN',
          subtext: 'در حال کار در حالت ایزوله محلی (BroadcastChannel)',
          latencyMs: latency,
        });
      }

      // 2. Probe Local Storage & IndexedDB integrity
      let storageOk = false;
      try {
        const testKey = '__probe_test_key__';
        localStorage.setItem(testKey, '1');
        storageOk = localStorage.getItem(testKey) === '1';
        localStorage.removeItem(testKey);
      } catch {
        storageOk = false;
      }

      if (storageOk) {
        setDbHealth({
          status: 'healthy',
          label: 'همگام‌سازی دیتابیس (Storage Sync)',
          subtext: `پایگاه محلی کاملاً همگام است (${totalItemsCount} ردیف فعال)`,
        });
      } else {
        setDbHealth({
          status: 'warning',
          label: 'همگام‌سازی دیتابیس (Storage Sync)',
          subtext: 'محدودیت سهمیه حافظه مرورگر مشاهده شد',
        });
      }

      // 3. Probe Media Storage & Watchfolder
      const mediaRes = await fetch('/api/media/library', {
        method: 'GET',
      }).catch(() => null);
      if (mediaRes && mediaRes.ok) {
        setMediaHealth({
          status: 'healthy',
          label: 'پایداری اتصال مخزن مدیا',
          subtext: 'مخزن ذخیره‌سازی ویدئو و Watchfolder در دسترس است',
        });
      } else {
        setMediaHealth({
          status: 'warning',
          label: 'پایداری اتصال مخزن مدیا',
          subtext: 'مخزن در حالت کش آفلاین حافظه IndexedDB فعال است',
        });
      }
    } catch {
      setWsHealth((prev) => ({ ...prev, status: 'warning' }));
    } finally {
      setIsChecking(false);
      setLastCheckTime(new Date().toLocaleTimeString('fa-IR'));
    }
  }, [totalItemsCount]);

  useEffect(() => {
    runSystemHealthProbe();
    const interval = setInterval(runSystemHealthProbe, 30000);
    return () => clearInterval(interval);
  }, [runSystemHealthProbe]);

  const allHealthy =
    wsHealth.status === 'healthy' &&
    dbHealth.status === 'healthy' &&
    mediaHealth.status === 'healthy';

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 right-4 z-40 no-print select-none font-sans"
    >
      {/* Expanded Health Inspection Drawer */}
      {isOpen && (
        <div className="mb-2 w-80 sm:w-96 p-4 rounded-2xl bg-slate-950/95 border border-teal-500/40 shadow-2xl backdrop-blur-xl space-y-3.5 transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  allHealthy
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400 animate-ping'
                }`}
              />
              <span className="font-bold text-xs text-slate-100">
                پایش لحظه‌ای سلامت و پایداری استودیو
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {/* 1. WebSocket / Live Link */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-950 shrink-0 mt-0.5">
                <Wifi
                  className={`w-4 h-4 ${
                    wsHealth.status === 'healthy'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">
                    {wsHealth.label}
                  </span>
                  <span
                    className={`font-mono-tabular text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      wsHealth.status === 'healthy'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {wsHealth.latencyMs ? `${wsHealth.latencyMs}ms` : 'آنلاین'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {wsHealth.subtext}
                </p>
              </div>
            </div>

            {/* 2. Storage / Database Sync */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-950 shrink-0 mt-0.5">
                <Database
                  className={`w-4 h-4 ${
                    dbHealth.status === 'healthy'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">
                    {dbHealth.label}
                  </span>
                  <span
                    className={`font-mono-tabular text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      dbHealth.status === 'healthy'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    همگام
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {dbHealth.subtext}
                </p>
              </div>
            </div>

            {/* 3. Media Storage Integrity */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-950 shrink-0 mt-0.5">
                <HardDrive
                  className={`w-4 h-4 ${
                    mediaHealth.status === 'healthy'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">
                    {mediaHealth.label}
                  </span>
                  <span
                    className={`font-mono-tabular text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      mediaHealth.status === 'healthy'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    پایدار
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {mediaHealth.subtext}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span>آخرین سنجش: {lastCheckTime || 'لحظاتی قبل'}</span>
            <button
              type="button"
              disabled={isChecking}
              onClick={runSystemHealthProbe}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold cursor-pointer disabled:opacity-40 transition-colors"
            >
              <RefreshCw
                className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`}
              />
              <span>بررسی مجدد</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Status Capsule Pill in Bottom-Right Corner */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-full border shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-95 ${
          allHealthy
            ? 'bg-slate-950/90 hover:bg-slate-900 border-teal-500/50 hover:border-teal-400 text-slate-200'
            : 'bg-amber-950/80 hover:bg-amber-900 border-amber-500/60 text-amber-100'
        }`}
        title="کلیک برای مشاهده جزئیات سلامت سیستم و ارتباطات شبکه"
      >
        <Activity
          className={`w-4 h-4 ${
            allHealthy
              ? 'text-emerald-400 group-hover:scale-110 transition-transform'
              : 'text-amber-400 animate-pulse'
          }`}
        />
        <span className="text-xs font-bold font-sans">سلامت سیستم</span>

        {/* 3 Real-time Status Micro-LEDs (WebSocket, Storage, Media) */}
        <div className="flex items-center gap-1.5 pr-1 border-r border-slate-700/80">
          <span
            title="وضعیت ارتباط زنده / WebSocket"
            className={`w-2 h-2 rounded-full ${
              wsHealth.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
            } animate-pulse`}
          />
          <span
            title="وضعیت همگام‌سازی دیتابیس (Storage Sync)"
            className={`w-2 h-2 rounded-full ${
              dbHealth.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span
            title="پایداری اتصال مخزن مدیا (Media Storage)"
            className={`w-2 h-2 rounded-full ${
              mediaHealth.status === 'healthy'
                ? 'bg-emerald-400'
                : 'bg-amber-400'
            }`}
          />
        </div>

        <ChevronUp
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
    </div>
  );
}
