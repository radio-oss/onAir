// components/PlayoutGraphicsController.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Tv, Type, Eye, EyeOff, Radio, Send } from 'lucide-react';

export interface OnAirGraphicsState {
  showChannelBug: boolean;
  showLiveBadge: boolean;
  showClockOverlay: boolean;
  showCrawlTicker: boolean;
  crawlText: string;
  lowerThirdTitle: string;
  lowerThirdSubtitle: string;
  showLowerThird: boolean;
}

export const DEFAULT_GRAPHICS_STATE: OnAirGraphicsState = {
  showChannelBug: true,
  showLiveBadge: false,
  showClockOverlay: true,
  showCrawlTicker: true,
  crawlText:
    'بینندگان عزیز شبکه اصفهان؛ سریال شبانگاهی «نون خ» امشب ساعت ۱۸:۱۵ و فیلم سینمایی «موقعیت مهدی» ساعت ۲۱:۴۵ پخش خواهد شد.',
  lowerThirdTitle: 'برنامه زنده صبح نصف جهان',
  lowerThirdSubtitle: 'ارتباط مستقیم با اداره کل هواشناسی استان اصفهان',
  showLowerThird: false,
};

export const CG_STORAGE_KEY = 'irib_isfahan_onair_cg_v1';

export default function PlayoutGraphicsController() {
  const [cgState, setCgState] = useState<OnAirGraphicsState>(
    DEFAULT_GRAPHICS_STATE
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CG_STORAGE_KEY);
      if (saved) setCgState(JSON.parse(saved));
    } catch {
      // Ignore
    }

    fetch('/api/playout/cg')
      .then((r) => (r.ok ? r.json() : null))
      .then((serverCg) => {
        if (serverCg && typeof serverCg.crawlText === 'string') {
          setCgState(serverCg);
        }
      })
      .catch(() => {});
  }, []);

  const broadcastCGUpdate = (next: OnAirGraphicsState) => {
    setCgState(next);
    try {
      localStorage.setItem(CG_STORAGE_KEY, JSON.stringify(next));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('irib_isfahan_cg_sync');
        ch.postMessage(next);
        ch.close();
      }
      fetch('/api/playout/cg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => {});
    } catch {
      // Ignore
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-teal-400" />
          <h3 className="text-sm font-bold text-slate-100">
            کنترلر گرافیک، لوگو و زیرنویس زنده آنتن (CG / DSK Character Generator)
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">
          همگام‌سازی آنی در شبکه داخلی و خروجی آنتن (Clean Feed)
        </span>
      </div>

      {/* Quick Overlay Layer Toggles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
        <button
          type="button"
          onClick={() =>
            broadcastCGUpdate({
              ...cgState,
              showChannelBug: !cgState.showChannelBug,
            })
          }
          className={`p-2.5 rounded-lg border font-semibold flex items-center justify-between cursor-pointer ${
            cgState.showChannelBug
              ? 'bg-teal-500/20 border-teal-500/50 text-teal-200'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}
        >
          <span>لوگوی شبکه (Logo Bug)</span>
          {cgState.showChannelBug ? (
            <Eye className="w-4 h-4 text-teal-400" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() =>
            broadcastCGUpdate({
              ...cgState,
              showLiveBadge: !cgState.showLiveBadge,
            })
          }
          className={`p-2.5 rounded-lg border font-semibold flex items-center justify-between cursor-pointer ${
            cgState.showLiveBadge
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-200'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}
        >
          <span>نشان «زنده» (LIVE)</span>
          <Radio className="w-4 h-4 text-rose-400" />
        </button>

        <button
          type="button"
          onClick={() =>
            broadcastCGUpdate({
              ...cgState,
              showClockOverlay: !cgState.showClockOverlay,
            })
          }
          className={`p-2.5 rounded-lg border font-semibold flex items-center justify-between cursor-pointer ${
            cgState.showClockOverlay
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}
        >
          <span>ساعت دیجیتال آنتن (Clock)</span>
          {cgState.showClockOverlay ? (
            <Eye className="w-4 h-4 text-emerald-400" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() =>
            broadcastCGUpdate({
              ...cgState,
              showCrawlTicker: !cgState.showCrawlTicker,
            })
          }
          className={`p-2.5 rounded-lg border font-semibold flex items-center justify-between cursor-pointer ${
            cgState.showCrawlTicker
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}
        >
          <span>زیرنویس روان (Ticker)</span>
          <Type className="w-4 h-4 text-amber-400" />
        </button>

        <button
          type="button"
          onClick={() =>
            broadcastCGUpdate({
              ...cgState,
              showLowerThird: !cgState.showLowerThird,
            })
          }
          className={`p-2.5 rounded-lg border font-semibold flex items-center justify-between cursor-pointer ${
            cgState.showLowerThird
              ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}
        >
          <span>کادر معرفی (Lower Third)</span>
          <Send className="w-4 h-4 text-sky-400" />
        </button>
      </div>

      {/* Crawl Text & Lower Third Inputs + Mini Live CG 16:9 Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-7 space-y-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs text-slate-400">
                متن زیرنویس روان پایین صفحه (Ticker):
              </label>
              <span className="text-[11px] font-mono-tabular text-teal-300 bg-slate-950/90 border border-white/[0.08] px-2 py-0.5 rounded-md">
                {cgState.crawlText.length} کاراکتر · تخمین زمان عبور:{' '}
                {Math.max(5, Math.round(cgState.crawlText.length / 8))} ثانیه
              </span>
            </div>
            <input
              type="text"
              value={cgState.crawlText}
              onChange={(e) =>
                broadcastCGUpdate({ ...cgState, crawlText: e.target.value })
              }
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-slate-500">الگوی آماده زیرنویس:</span>
              <button
                type="button"
                onClick={() =>
                  broadcastCGUpdate({
                    ...cgState,
                    crawlText:
                      'بینندگان عزیز شبکه اصفهان؛ سریال شبانگاهی «نون خ» امشب ساعت ۱۸:۱۵ و فیلم سینمایی «موقعیت مهدی» ساعت ۲۱:۴۵ پخش خواهد شد.',
                  })
                }
                className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-teal-300 cursor-pointer transition-colors"
              >
                ۱. اعلام برنامه‌های امشب شبکه اصفهان
              </button>
              <button
                type="button"
                onClick={() =>
                  broadcastCGUpdate({
                    ...cgState,
                    crawlText:
                      'هم‌اکنون فرا رسیدن وقت فضیلت اذان به افق نصف جهان — التماس دعا از درگاه ایزد منان.',
                  })
                }
                className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-amber-300 cursor-pointer transition-colors"
              >
                ۲. اطلاعیه پخش اذان به افق اصفهان
              </button>
              <button
                type="button"
                onClick={() =>
                  broadcastCGUpdate({
                    ...cgState,
                    crawlText:
                      'روابط عمومی صدا و سیمای مرکز اصفهان آماده دریافت دیدگاه‌ها و پیشنهادهای شما مخاطبان گرامی از طریق سامانه ۱۶۲ است.',
                  })
                }
                className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-sky-300 cursor-pointer transition-colors"
              >
                ۳. پیام خوش‌آمدگویی و ارتباط با روابط عمومی
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">
                عنوان کادر معرفی (Lower Third Title):
              </label>
              <input
                type="text"
                value={cgState.lowerThirdTitle}
                onChange={(e) =>
                  broadcastCGUpdate({
                    ...cgState,
                    lowerThirdTitle: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">
                زیرعنوان کادر معرفی (Lower Third Subtitle):
              </label>
              <input
                type="text"
                value={cgState.lowerThirdSubtitle}
                onChange={(e) =>
                  broadcastCGUpdate({
                    ...cgState,
                    lowerThirdSubtitle: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Mini Live CG 16:9 Broadcast Preview Monitor */}
        <div className="lg:col-span-5">
          <div className="text-[11px] text-slate-400 mb-1.5 flex items-center justify-between">
            <span>مانیتور پیش‌نمایش زنده گرافیک آنتن (Mini Live CG Preview 16:9)</span>
            <span className="font-mono-tabular text-teal-400">DSK LAYER</span>
          </div>
          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/50 shadow-inner select-none">
            {/* Safe Title Grid Guides */}
            <div className="absolute inset-3 border border-dashed border-white/[0.07] rounded pointer-events-none" />

            {/* Top Row: Logo Bug & Clock + LIVE */}
            <div className="absolute top-2.5 inset-x-3 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5">
                {cgState.showChannelBug && (
                  <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-teal-400/60 text-teal-300 font-bold">
                    شبکه اصفهان
                  </span>
                )}
                {cgState.showLiveBadge && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold animate-pulse">
                    زنده | LIVE
                  </span>
                )}
              </div>

              {cgState.showClockOverlay && (
                <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-white/[0.15] text-slate-100 font-mono-tabular">
                  IRIB ISFAHAN · CLOCK ON
                </span>
              )}
            </div>

            {/* Center Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[11px] font-mono-tabular text-slate-500/60">
                16:9 HD CLEAN FEED CG OVERLAY
              </span>
            </div>

            {/* Lower Third Box */}
            {cgState.showLowerThird && (
              <div className="absolute bottom-8 right-3 left-6 bg-slate-950/90 backdrop-blur-md border border-white/[0.14] border-r-4 border-r-teal-400 rounded-lg px-3 py-1.5 shadow-lg">
                <div className="text-[11px] font-bold text-white truncate">
                  {cgState.lowerThirdTitle || 'عنوان کادر معرفی (Lower Third)'}
                </div>
                <div className="text-[10px] text-teal-300 truncate">
                  {cgState.lowerThirdSubtitle || 'زیرعنوان برنامه زنده'}
                </div>
              </div>
            )}

            {/* Bottom Crawl Ticker */}
            {cgState.showCrawlTicker && (
              <div className="absolute bottom-0 inset-x-0 bg-teal-950/95 border-t border-teal-400/50 px-2.5 py-1 text-[10px] text-teal-100 flex items-center gap-1.5 overflow-hidden">
                <strong className="text-amber-300 shrink-0 bg-teal-950/95 px-1 rounded z-10">
                  [زیرنویس شبکه اصفهان]:
                </strong>
                <div className="flex-1 overflow-hidden">
                  <span className="broadcast-ticker-track">{cgState.crawlText}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
