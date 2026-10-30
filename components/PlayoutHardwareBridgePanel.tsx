// components/PlayoutHardwareBridgePanel.tsx
'use client';

import React, { useState } from 'react';
import {
  ScheduleItem,
  parseTimeToSeconds,
  isItemApprovedForPlayout,
} from '@/lib/conductor-data';
import {
  Server,
  Play,
  Square,
  Layers,
  ShieldAlert,
  CheckCircle2,
  Terminal,
  Radio,
} from 'lucide-react';

interface PlayoutHardwareBridgePanelProps {
  currentItem?: ScheduleItem;
  nextItem?: ScheduleItem;
  canControlPlayout: boolean;
  isMonitoringOnly?: boolean;
  onStatusToast: (msg: string) => void;
}

interface HardwareCommandLog {
  id: string;
  timestamp: string;
  command: string;
  target: string;
  connected: boolean;
  response: string;
  blocked?: boolean;
}

export default function PlayoutHardwareBridgePanel({
  currentItem,
  nextItem,
  canControlPlayout,
  isMonitoringOnly = false,
  onStatusToast,
}: PlayoutHardwareBridgePanelProps) {
  const [host, setHost] = useState<string>('127.0.0.1');
  const [port, setPort] = useState<number>(5250);
  const [channel, setChannel] = useState<number>(1);
  const [layer, setLayer] = useState<number>(10);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [logs, setLogs] = useState<HardwareCommandLog[]>([
    {
      id: 'init-hw-1',
      timestamp: '06:00:00',
      command: 'INFO 1-10',
      target: '127.0.0.1:5250',
      connected: false,
      response:
        'درگاه سوکت پلی‌اوت محلی آماده ارسال فرامین AMCP به سرور پخش است.',
    },
  ]);

  const sendHardwareCommand = async (
    targetItem: ScheduleItem | undefined,
    action: 'PLAY_NOW' | 'LOADBG_QUEUE' | 'STOP' | 'STANDBY_FILLER'
  ) => {
    if (!canControlPlayout || isMonitoringOnly) {
      onStatusToast(
        'اپراتور پایش پخش در حالت پایش صرف قرار دارد و مجاز به ارسال فرمان به سرور پلی‌اوت نیست.'
      );
      return;
    }

    const itemToUse = targetItem || currentItem;
    if (!itemToUse && action !== 'STOP' && action !== 'STANDBY_FILLER') return;

    setIsSending(true);
    try {
      const res = await fetch('/api/playout/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          port,
          channel,
          layer,
          mediaCode: itemToUse?.mediaCode || 'STANDBY',
          versionNumber: itemToUse?.revisionVersion || 1,
          trimInSec: itemToUse?.trimInSec || 0,
          durationSec: itemToUse
            ? parseTimeToSeconds(itemToUse.duration)
            : 900,
          workflowStatus: itemToUse?.workflowStatus || 'approved_for_playout',
          action,
        }),
      });

      const data = await res.json();
      const timeNow = new Date().toLocaleTimeString('fa-IR');

      if (!res.ok || data.blockedByGatekeeper) {
        const blockedEntry: HardwareCommandLog = {
          id: `hw-${Date.now()}`,
          timestamp: timeNow,
          command: `BLOCKED [${action}] ${itemToUse?.mediaCode || ''}`,
          target: `${host}:${port}`,
          connected: false,
          blocked: true,
          response:
            data.error ||
            'ارسال به زنجیره پخش توسط محافظ ایمنی سرور پلی‌اوت مسدود شد.',
        };
        setLogs((prev) => [blockedEntry, ...prev].slice(0, 15));
        onStatusToast(blockedEntry.response);
      } else {
        const entry: HardwareCommandLog = {
          id: `hw-${Date.now()}`,
          timestamp: timeNow,
          command: data.amcpCommand,
          target: data.targetEndpoint || `${host}:${port}`,
          connected: Boolean(data.hardwareConnected),
          response: data.serverResponse,
        };
        setLogs((prev) => [entry, ...prev].slice(0, 15));
        onStatusToast(
          `فرمان پلی‌اوت (${data.amcpCommand}) به درگاه سرور ارسال شد.`
        );
      }
    } catch (err) {
      onStatusToast(`خطا در ارتباط با سرویس پلی‌اوت محلی: ${String(err)}`);
    } finally {
      setIsSending(false);
    }
  };

  const currentApproved = currentItem
    ? isItemApprovedForPlayout(currentItem)
    : false;
  const nextApproved = nextItem ? isItemApprovedForPlayout(nextItem) : false;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-teal-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              پل ارتباطی سرور سخت‌افزاری پلی‌اوت و زنجیره پخش آنتن (Local TCP/AMCP
              Playout Integration)
            </h3>
            <p className="text-[11px] text-slate-400">
              ارسال واقعی دستورات پخش به سرور محلی (CasparCG / SDI Playout Server)
              با کنترل خودکار نسخه معتبر و مجوز پخش
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 font-mono-tabular text-teal-300">
            TCP {host}:{port} (CH {channel}-{layer})
          </span>
        </div>
      </div>

      {/* Server Connection Settings & Hardware Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div className="lg:col-span-5 grid grid-cols-4 gap-2 text-xs">
          <div className="col-span-2">
            <label className="block text-[11px] text-slate-400 mb-1">
              آدرس IP سرور پلی‌اوت محلی
            </label>
            <input
              type="text"
              dir="ltr"
              disabled={!canControlPlayout || isMonitoringOnly}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono-tabular text-slate-200 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              پورت AMCP
            </label>
            <input
              type="number"
              dir="ltr"
              disabled={!canControlPlayout || isMonitoringOnly}
              value={port}
              onChange={(e) => setPort(Number(e.target.value) || 5250)}
              className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono-tabular text-teal-300 text-center disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              کانال/لایه
            </label>
            <div className="flex items-center gap-1" dir="ltr">
              <input
                type="number"
                disabled={!canControlPlayout || isMonitoringOnly}
                value={channel}
                onChange={(e) => setChannel(Number(e.target.value) || 1)}
                className="w-1/2 px-1 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono-tabular text-slate-200 text-center disabled:opacity-50"
              />
              <input
                type="number"
                disabled={!canControlPlayout || isMonitoringOnly}
                value={layer}
                onChange={(e) => setLayer(Number(e.target.value) || 10)}
                className="w-1/2 px-1 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono-tabular text-slate-200 text-center disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-wrap items-center justify-end gap-2 text-xs">
          <button
            type="button"
            disabled={isSending || !canControlPlayout || isMonitoringOnly}
            onClick={() => sendHardwareCommand(currentItem, 'PLAY_NOW')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold rounded-lg cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              ارسال فرمان PLAY آیتم فعلی به آنتن (
              {currentItem ? `${currentItem.mediaCode} v${currentItem.revisionVersion || 1}` : '-'}
              )
            </span>
          </button>

          <button
            type="button"
            disabled={isSending || !canControlPlayout || isMonitoringOnly}
            onClick={() => sendHardwareCommand(nextItem, 'LOADBG_QUEUE')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 disabled:opacity-40 text-teal-200 font-semibold rounded-lg cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              آماده‌سازی آیتم بعدی در پس‌زمینه (LOADBG{' '}
              {nextItem ? nextItem.mediaCode : '-'})
            </span>
          </button>

          <button
            type="button"
            disabled={isSending || !canControlPlayout || isMonitoringOnly}
            onClick={() => sendHardwareCommand(undefined, 'STANDBY_FILLER')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 disabled:opacity-40 text-amber-200 font-semibold rounded-lg cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>پخش استندبای سرور</span>
          </button>

          <button
            type="button"
            disabled={isSending || !canControlPlayout || isMonitoringOnly}
            onClick={() => sendHardwareCommand(undefined, 'STOP')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            <span>توقف لایه (STOP)</span>
          </button>
        </div>
      </div>

      {/* Pre-Flight Hardware Gatekeeper Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
          <span className="text-slate-400">
            وضعیت مجوز آیتم فعلی در درگاه سخت‌افزار:
          </span>
          {currentApproved ? (
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تأیید نهایی شده (نسخه v{currentItem?.revisionVersion || 1})</span>
            </span>
          ) : (
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>مسدود توسط محافظ پلی‌اوت (تأیید نشده)</span>
            </span>
          )}
        </div>

        <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
          <span className="text-slate-400">
            وضعیت مجوز آیتم بعدی (Next Cue) در درگاه سخت‌افزار:
          </span>
          {nextApproved ? (
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>آماده LOADBG (نسخه v{nextItem?.revisionVersion || 1})</span>
            </span>
          ) : (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>در انتظار تأیید نهایی پیش از ورود به صف</span>
            </span>
          )}
        </div>
      </div>

      {/* Live AMCP Command Console Log */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-teal-400" />
            <span>کنسول پایش فرامین ارسالی به زنجیره پخش و سرور پلی‌اوت:</span>
          </span>
          <span>پروتکل: CasparCG AMCP 2.1 (25fps PAL/HD)</span>
        </div>

        <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] font-mono-tabular">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`px-2 py-1 rounded flex flex-wrap items-center justify-between gap-2 ${
                log.blocked
                  ? 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-900/70 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-slate-500">[{log.timestamp}]</span>
                <span className="text-teal-300 font-bold" dir="ltr">
                  {log.command}
                </span>
              </div>
              <span className="text-slate-400 text-[10px]">{log.response}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
