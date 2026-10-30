'use client';

import React, { useState, useEffect } from 'react';
import {
  SHORTCUT_DEFINITIONS,
  ShortcutActionId,
  ShortcutMap,
  getDefaultShortcuts,
  loadSavedShortcuts,
  saveShortcuts,
  eventToShortcutString,
  formatShortcutBadge,
} from '@/lib/keyboard-shortcuts';
import {
  X,
  Keyboard,
  RotateCcw,
  Check,
  AlertCircle,
  Play,
  LayoutDashboard,
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShortcutsChanged?: (updated: ShortcutMap) => void;
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  onShortcutsChanged,
}: KeyboardShortcutsModalProps) {
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(getDefaultShortcuts);
  const [listeningActionId, setListeningActionId] =
    useState<ShortcutActionId | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setShortcuts(loadSavedShortcuts());
      setListeningActionId(null);
      setConflictWarning(null);
    }
  }, [isOpen]);

  // Capture key press when user is remapping a specific shortcut
  useEffect(() => {
    if (!isOpen || !listeningActionId) return;

    const handleCaptureKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setListeningActionId(null);
        return;
      }

      const binding = eventToShortcutString(e);
      if (!binding) return;

      // Check if another action in the same category or global uses this key
      const existingConflict = SHORTCUT_DEFINITIONS.find(
        (def) =>
          def.id !== listeningActionId && shortcuts[def.id] === binding
      );

      if (existingConflict) {
        setConflictWarning(
          `کلید «${formatShortcutBadge(binding)}» قبلاً برای «${
            existingConflict.label
          }» تنظیم شده بود و اکنون جایگزین شد.`
        );
      } else {
        setConflictWarning(null);
      }

      const next: ShortcutMap = {
        ...shortcuts,
        [listeningActionId]: binding,
      };
      setShortcuts(next);
      saveShortcuts(next);
      onShortcutsChanged?.(next);
      setListeningActionId(null);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    };

    window.addEventListener('keydown', handleCaptureKey, { capture: true });
    return () =>
      window.removeEventListener('keydown', handleCaptureKey, { capture: true });
  }, [isOpen, listeningActionId, shortcuts, onShortcutsChanged]);

  if (!isOpen) return null;

  const handleResetSingle = (id: ShortcutActionId, defaultKey: string) => {
    const next: ShortcutMap = {
      ...shortcuts,
      [id]: defaultKey,
    };
    setShortcuts(next);
    saveShortcuts(next);
    onShortcutsChanged?.(next);
    setConflictWarning(null);
  };

  const handleResetAll = () => {
    const defaults = getDefaultShortcuts();
    setShortcuts(defaults);
    saveShortcuts(defaults);
    onShortcutsChanged?.(defaults);
    setListeningActionId(null);
    setConflictWarning(null);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const playerDefs = SHORTCUT_DEFINITIONS.filter(
    (d) => d.category === 'player'
  );
  const workspaceDefs = SHORTCUT_DEFINITIONS.filter(
    (d) => d.category === 'workspace'
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                مدیریت و شخصی‌سازی کلیدهای میانبر صفحه‌کلید (Customizable
                Broadcast Shortcuts)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                روی دکمه «تغییر کلید» هر ردیف کلیک کرده و کلید یا ترکیب دلخواه
                خود را روی کیبورد فشار دهید.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-lg font-semibold">
                <Check className="w-3.5 h-3.5" />
                <span>ذخیره شد</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی همه به پیش‌فرض</span>
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

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          {conflictWarning && (
            <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-center gap-2 text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{conflictWarning}</span>
            </div>
          )}

          {/* Section 1: Broadcast Video Player Shortcuts */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-teal-300 border-b border-slate-800 pb-2">
              <Play className="w-4 h-4" />
              <span>
                ۱. شورتکات‌های پخش‌کننده داخلی ویدئو، میز بازبینی (QC) و تریم
                (۲۵ فریم بر ثانیه)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {playerDefs.map((def) => {
                const isListening = listeningActionId === def.id;
                const currentKey = shortcuts[def.id] || def.defaultBinding;
                const isModified = currentKey !== def.defaultBinding;

                return (
                  <div
                    key={def.id}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                      isListening
                        ? 'bg-teal-950/40 border-teal-400'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-100 flex items-center gap-2">
                        <span>{def.label}</span>
                        {isModified && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">
                            سفارشی‌شده
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {def.description}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <kbd
                        dir="ltr"
                        className={`px-3 py-1.5 rounded-lg font-mono-tabular font-bold text-xs border ${
                          isListening
                            ? 'bg-amber-400 text-slate-950 border-amber-300 animate-pulse'
                            : 'bg-slate-900 text-teal-300 border-slate-700'
                        }`}
                      >
                        {isListening
                          ? 'کلید جدید را فشار دهید... (ESC لغو)'
                          : formatShortcutBadge(currentKey)}
                      </kbd>

                      <button
                        type="button"
                        onClick={() =>
                          setListeningActionId(isListening ? null : def.id)
                        }
                        className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                          isListening
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {isListening ? 'لغو' : 'تغییر کلید'}
                      </button>

                      {isModified && (
                        <button
                          type="button"
                          onClick={() =>
                            handleResetSingle(def.id, def.defaultBinding)
                          }
                          title="بازگردانی به کلید پیش‌فرض"
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded-lg cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Global Workspace Shortcuts */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-sky-300 border-b border-slate-800 pb-2">
              <LayoutDashboard className="w-4 h-4" />
              <span>
                ۲. شورتکات‌های سراسری میز کار کنداکتور، صفحات ۵ گانه و عملیات
                سریع
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {workspaceDefs.map((def) => {
                const isListening = listeningActionId === def.id;
                const currentKey = shortcuts[def.id] || def.defaultBinding;
                const isModified = currentKey !== def.defaultBinding;

                return (
                  <div
                    key={def.id}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                      isListening
                        ? 'bg-teal-950/40 border-teal-400'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-100 flex items-center gap-2">
                        <span>{def.label}</span>
                        {isModified && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">
                            سفارشی‌شده
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {def.description}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <kbd
                        dir="ltr"
                        className={`px-3 py-1.5 rounded-lg font-mono-tabular font-bold text-xs border ${
                          isListening
                            ? 'bg-amber-400 text-slate-950 border-amber-300 animate-pulse'
                            : 'bg-slate-900 text-sky-300 border-slate-700'
                        }`}
                      >
                        {isListening
                          ? 'کلید جدید را فشار دهید... (ESC لغو)'
                          : formatShortcutBadge(currentKey)}
                      </kbd>

                      <button
                        type="button"
                        onClick={() =>
                          setListeningActionId(isListening ? null : def.id)
                        }
                        className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                          isListening
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {isListening ? 'لغو' : 'تغییر کلید'}
                      </button>

                      {isModified && (
                        <button
                          type="button"
                          onClick={() =>
                            handleResetSingle(def.id, def.defaultBinding)
                          }
                          title="بازگردانی به کلید پیش‌فرض"
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded-lg cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
