'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { RoleDefinition } from '@/lib/conductor-data';
import {
  Users,
  KeyRound,
  DownloadCloud,
  UploadCloud,
  Radio,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface ActiveLanSession {
  clientId: string;
  roleId: string;
  roleTitle: string;
  personName: string;
  activeTab: string;
  editingItemId?: string;
  ipAddress: string;
  lastSeenMs: number;
}

interface LanPresenceAndBackupBarProps {
  currentRole: RoleDefinition;
  activeTab: string;
  activeEditingOrQcItemTitle?: string;
  onOpenRoleCredentials: () => void;
  onBackupRestored: () => void;
  onStatusToast: (msg: string) => void;
}

const LOCAL_PRESENCE_KEY = 'irib_isfahan_lan_presence_sessions_v1';

export default function LanPresenceAndBackupBar({
  currentRole,
  activeTab,
  activeEditingOrQcItemTitle,
  onOpenRoleCredentials,
  onBackupRestored,
  onStatusToast,
}: LanPresenceAndBackupBarProps) {
  const [clientId] = useState<string>(
    () => `station-${Math.random().toString(36).slice(2, 8)}`
  );
  const [sessions, setSessions] = useState<ActiveLanSession[]>([]);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const roleId = currentRole.id;
  const roleTitle = currentRole.title;
  const personName = currentRole.personName;

  const syncPresenceOnce = useCallback(async () => {
    const localSession: ActiveLanSession = {
      clientId,
      roleId,
      roleTitle,
      personName,
      activeTab,
      editingItemId: activeEditingOrQcItemTitle || undefined,
      ipAddress: 'LAN-Station',
      lastSeenMs: Date.now(),
    };

    // 1. Update local multi-tab registry via localStorage & BroadcastChannel
    try {
      const raw = localStorage.getItem(LOCAL_PRESENCE_KEY);
      const parsed: ActiveLanSession[] = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const filtered = parsed.filter(
        (s) => s.clientId !== clientId && now - s.lastSeenMs < 60000
      );
      const nextLocal = [localSession, ...filtered];
      localStorage.setItem(LOCAL_PRESENCE_KEY, JSON.stringify(nextLocal));
      setSessions(nextLocal);

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('irib_isfahan_lan_presence');
        ch.postMessage(nextLocal);
        ch.close();
      }
    } catch {
      setSessions([localSession]);
    }

    // 2. Sync with LAN server endpoint on state change (event-driven)
    try {
      const res = await fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          roleId,
          roleTitle,
          personName,
          activeTab,
          editingItemId: activeEditingOrQcItemTitle || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions) && data.sessions.length > 0) {
          setSessions(data.sessions);
        }
      }
    } catch {
      // Offline single-browser fallback
    }
  }, [
    clientId,
    roleId,
    roleTitle,
    personName,
    activeTab,
    activeEditingOrQcItemTitle,
  ]);

  useEffect(() => {
    syncPresenceOnce();
  }, [syncPresenceOnce]);

  useEffect(() => {
    const ch =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('irib_isfahan_lan_presence')
        : null;

    if (ch) {
      ch.onmessage = (ev) => {
        if (Array.isArray(ev.data)) {
          setSessions(ev.data);
        }
      };
    }

    const handleStorage = (ev: StorageEvent) => {
      if (ev.key === LOCAL_PRESENCE_KEY && ev.newValue) {
        try {
          const parsed = JSON.parse(ev.newValue);
          if (Array.isArray(parsed)) setSessions(parsed);
        } catch {
          // Ignore parse error
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      ch?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleDownloadFullServerBackup = async () => {
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error('Backup failed');
      const bundle = await res.json();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IRIB-Isfahan-FullServerBackup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onStatusToast(
        'بسته پشتیبان جامع سرور محلی (کنداکتور، ممیزی، گرافیک و رمزها) دانلود شد.'
      );
    } catch {
      onStatusToast('خطا در دریافت فایل پشتیبان جامع از سرور محلی.');
    }
  };

  const handleRestoreFullServerBackup = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result));
        const res = await fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });
        if (res.ok) {
          onStatusToast(
            'بازیابی جامع سرور محلی با موفقیت انجام شد. اطلاعات بروزرسانی گردید.'
          );
          onBackupRestored();
        } else {
          onStatusToast('فرمت فایل پشتیبان جامع معتبر نیست.');
        }
      } catch {
        onStatusToast('خطا در خواندن یا بازیابی فایل پشتیبان جامع.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/90 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
      <input
        ref={restoreInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleRestoreFullServerBackup}
        className="hidden"
      />

      {/* Online LAN Stations & Concurrent Locks */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-teal-500/40 rounded-lg text-teal-300 font-semibold">
          <Users className="w-3.5 h-3.5" />
          <span>ایستگاه‌های فعال در شبکه داخلی (LAN): {sessions.length || 1}</span>
          <button
            type="button"
            onClick={syncPresenceOnce}
            title="بروزرسانی لیست ایستگاه‌های فعال شبکه"
            className="p-0.5 hover:text-teal-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {sessions.length === 0 ? (
            <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-md text-slate-300 flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>
                {currentRole.title} ({currentRole.personName}) — ایستگاه شما
              </span>
            </span>
          ) : (
            sessions.map((s) => {
              const isMe = s.clientId === clientId;
              return (
                <span
                  key={s.clientId}
                  className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                    isMe
                      ? 'bg-teal-950/40 border-teal-500/40 text-teal-200'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="font-semibold">{s.roleTitle}</span>
                  <span className="text-[11px] text-slate-400">
                    ({s.personName})
                  </span>
                  {s.editingItemId && (
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>مشغول: {s.editingItemId.slice(0, 20)}</span>
                    </span>
                  )}
                </span>
              );
            })
          )}
        </div>
      </div>

      {/* Security PIN Manager & Full Server Backup Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenRoleCredentials}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-300 rounded-lg transition-colors cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>مدیریت پین‌کد ۶ نقش</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadFullServerBackup}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-teal-300 rounded-lg transition-colors cursor-pointer"
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          <span>پشتیبان جامع سرور</span>
        </button>

        {currentRole.canDirectorOverride && (
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-300 rounded-lg transition-colors cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>بازیابی جامع سرور</span>
          </button>
        )}
      </div>
    </div>
  );
}
