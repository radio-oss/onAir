'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  SHORTCUT_DEFINITIONS,
  PLAYER_SHORTCUT_PRESETS,
  SHORTCUT_STORAGE_KEY,
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
  Sliders,
  HardDrive,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface VideoPlayerShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShortcutsChanged?: (updated: ShortcutMap) => void;
}

const QUICK_PLAY_KEYS: { label: string; binding: string; hint: string }[] = [
  { label: 'Space (پیش‌فرض)', binding: 'Space', hint: 'کلید فاصله استاندارد' },
  { label: 'کلید K', binding: 'KeyK', hint: 'استاندارد تدوین J-K-L' },
  { label: 'کلید P', binding: 'KeyP', hint: 'مخفف Play / Pause' },
  { label: 'کلید Enter', binding: 'Enter', hint: 'تایید و پخش سریع' },
  { label: 'کلید 0 (Numpad)', binding: 'Numpad0', hint: 'مناسب اپراتور پلی‌اوت' },
];

export default function VideoPlayerShortcutsModal({
  isOpen,
  onClose,
  onShortcutsChanged,
}: VideoPlayerShortcutsModalProps) {
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(getDefaultShortcuts);
  const [listeningActionId, setListeningActionId] =
    useState<ShortcutActionId | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [lastTestedEvent, setLastTestedEvent] = useState<{
    binding: string;
    matchedLabel: string | null;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShortcuts(loadSavedShortcuts());
      setListeningActionId(null);
      setConflictWarning(null);
      setLastTestedEvent(null);
    }
  }, [isOpen]);

  const triggerSavedToast = (msg = 'در LocalStorage ذخیره شد') => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const applyBindingToAction = useCallback(
    (actionId: ShortcutActionId, newBinding: string) => {
      const existingConflict = SHORTCUT_DEFINITIONS.find(
        (def) => def.id !== actionId && shortcuts[def.id] === newBinding
      );

      if (existingConflict) {
        setConflictWarning(
          `توجه: کلید «${formatShortcutBadge(newBinding)}» قبلاً به «${
            existingConflict.label
          }» اختصاص داشت و اکنون برای این دستور جایگزین شد.`
        );
      } else {
        setConflictWarning(null);
      }

      const next: ShortcutMap = {
        ...shortcuts,
        [actionId]: newBinding,
      };
      setShortcuts(next);
      saveShortcuts(next);
      onShortcutsChanged?.(next);
      setListeningActionId(null);
      triggerSavedToast('کلید میان‌بر جدید در LocalStorage ذخیره شد');
    },
    [shortcuts, onShortcutsChanged]
  );

  // Capture key press when user is remapping a shortcut OR testing keys in the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleCaptureKey = (e: KeyboardEvent) => {
      // If user is actively capturing a new key for a specific action
      if (listeningActionId) {
        e.preventDefault();
        e.stopPropagation();

        if (e.code === 'Escape') {
          setListeningActionId(null);
          return;
        }

        const binding = eventToShortcutString(e);
        if (!binding) return;

        applyBindingToAction(listeningActionId, binding);
        return;
      }

      // Otherwise, if not inside an input, show live test feedback for player shortcuts
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Escape') {
        onClose();
        return;
      }

      const binding = eventToShortcutString(e);
      if (!binding) return;

      const playerDefs = SHORTCUT_DEFINITIONS.filter(
        (d) => d.category === 'player'
      );
      const matched = playerDefs.find((d) => shortcuts[d.id] === binding);
      if (matched) {
        e.preventDefault();
        e.stopPropagation();
      }
      setLastTestedEvent({
        binding,
        matchedLabel: matched ? matched.label : null,
      });
    };

    window.addEventListener('keydown', handleCaptureKey, { capture: true });
    return () =>
      window.removeEventListener('keydown', handleCaptureKey, {
        capture: true,
      });
  }, [isOpen, listeningActionId, shortcuts, onClose, applyBindingToAction]);

  if (!isOpen) return null;

  const playerDefs = SHORTCUT_DEFINITIONS.filter(
    (d) => d.category === 'player'
  );

  const handleApplyPreset = (overrides: Partial<ShortcutMap>, name: string) => {
    const next: ShortcutMap = {
      ...shortcuts,
      ...overrides,
    };
    setShortcuts(next);
    saveShortcuts(next);
    onShortcutsChanged?.(next);
    setListeningActionId(null);
    setConflictWarning(null);
    triggerSavedToast(`پروفایل «${name}» در LocalStorage ذخیره شد`);
  };

  const handleResetSingle = (id: ShortcutActionId, defaultKey: string) => {
    const next: ShortcutMap = {
      ...shortcuts,
      [id]: defaultKey,
    };
    setShortcuts(next);
    saveShortcuts(next);
    onShortcutsChanged?.(next);
    setConflictWarning(null);
    triggerSavedToast('به کلید پیش‌فرض بازنشانی و ذخیره شد');
  };

  const handleResetAllPlayerShortcuts = () => {
    const defaults = getDefaultShortcuts();
    const next: ShortcutMap = { ...shortcuts };
    for (const def of playerDefs) {
      next[def.id] = def.defaultBinding;
    }
    setShortcuts(next);
    saveShortcuts(next);
    onShortcutsChanged?.(next);
    setListeningActionId(null);
    setConflictWarning(null);
    triggerSavedToast('تمامی کلیدهای کنترلر پخش به پیش‌فرض بازنشانی شدند');
  };

  const currentPlayKey = shortcuts.player_toggle_play || 'Space';
  const isPlayKeyListening = listeningActionId === 'player_toggle_play';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 no-print"
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>
                  تنظیمات شخصی‌سازی کلیدهای میان‌بر کنترلر پخش ویدئو
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono-tabular bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-md">
                  LocalStorage Sync
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                جایگزینی کلید Space و تنظیم دلخواه تمامی کلیدهای کنترلی پلیر
                بازبینی (QC) و تریم پلی‌اوت با ذخیره‌سازی دائمی در مرورگر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-lg font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>{savedNotice}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetAllPlayerShortcuts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی پیش‌فرض پلیر</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="بستن پنجره (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Conflict Alert */}
          {conflictWarning && (
            <div className="p-3 bg-amber-950/50 border border-amber-500/50 rounded-xl flex items-center gap-2.5 text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{conflictWarning}</span>
            </div>
          )}

          {/* Featured Card: Quick Replacement for SPACE (Play / Pause) */}
          <div className="p-4 rounded-xl bg-gradient-to-l from-teal-950/50 via-slate-950 to-slate-950 border border-teal-500/40 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-teal-400 fill-teal-400" />
                  <h4 className="text-sm font-bold text-slate-100">
                    کلید اصلی پخش و توقف ویدئو (جایگزینی کلید Space با کلید
                    دلخواه)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-300">
                  به‌طور پیش‌فرض کلید{' '}
                  <strong className="text-teal-300 font-mono-tabular">
                    Space
                  </strong>{' '}
                  برای پخش/توقف تنظیم شده است. می‌توانید با یک کلیک یا فشردن هر
                  کلید دلخواه روی کیبورد، آن را تغییر دهید:
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">کلید فعلی:</span>
                  <kbd
                    dir="ltr"
                    className="px-2.5 py-0.5 rounded bg-teal-500/20 border border-teal-400/50 text-teal-300 font-mono-tabular font-bold text-xs"
                  >
                    {formatShortcutBadge(currentPlayKey)}
                  </kbd>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setListeningActionId(
                      isPlayKeyListening ? null : 'player_toggle_play'
                    )
                  }
                  className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isPlayKeyListening
                      ? 'bg-amber-400 text-slate-950 animate-pulse shadow-lg shadow-amber-500/20'
                      : 'bg-teal-400 hover:bg-teal-300 text-slate-950'
                  }`}
                >
                  <Keyboard className="w-4 h-4" />
                  <span>
                    {isPlayKeyListening
                      ? 'اکنون کلید دلخواه را فشار دهید... (ESC لغو)'
                      : 'فشردن کلید دلخواه جدید'}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick 1-Click Play/Pause Key Replacements */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400 ml-1">
                انتخاب سریع کلید پخش/توقف:
              </span>
              {QUICK_PLAY_KEYS.map((item) => {
                const isSelected = currentPlayKey === item.binding;
                return (
                  <button
                    key={item.binding}
                    type="button"
                    onClick={() =>
                      applyBindingToAction('player_toggle_play', item.binding)
                    }
                    title={item.hint}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono-tabular transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-teal-500/25 border-teal-400 text-teal-200 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    )}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ready-made NLE / Broadcast Presets */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>پروفایل‌های آماده استاندارد تدوین و پخش (Presets):</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {PLAYER_SHORTCUT_PRESETS.map((preset) => {
                const isPresetActive = Object.entries(preset.overrides).every(
                  ([k, v]) => shortcuts[k as ShortcutActionId] === v
                );
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      handleApplyPreset(preset.overrides, preset.name)
                    }
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isPresetActive
                        ? 'bg-teal-950/40 border-teal-400/70 text-teal-200'
                        : 'bg-slate-950/70 hover:bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="font-bold text-xs text-slate-100">
                        {preset.name}
                      </span>
                      {isPresetActive && (
                        <span className="px-1.5 py-0.5 bg-teal-500/20 text-teal-300 rounded text-[10px] font-bold">
                          فعال
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* All Video Playback Controller Shortcuts List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-teal-300">
                <Keyboard className="w-4 h-4" />
                <span>
                  فهرست کامل کلیدهای میان‌بر کنترلر پخش ویدئو (۲۵ فریم بر ثانیه)
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                برای تغییر هر دستور، روی «تغییر کلید» کلیک کنید
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
                        : 'bg-slate-950/85 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-100 flex flex-wrap items-center gap-2">
                        <span>{def.label}</span>
                        {isModified ? (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded text-[10px]">
                            شخصی‌سازی شده (پیش‌فرض:{' '}
                            {formatShortcutBadge(def.defaultBinding)})
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">
                            پیش‌فرض
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
                        onClick={() =>
                          setListeningActionId(isListening ? null : def.id)
                        }
                        title="برای تغییر کلید کلیک کنید"
                        className={`px-3 py-1.5 rounded-lg font-mono-tabular font-bold text-xs border cursor-pointer transition-colors ${
                          isListening
                            ? 'bg-amber-400 text-slate-950 border-amber-300 animate-pulse'
                            : isModified
                            ? 'bg-amber-950/40 text-amber-300 border-amber-500/50'
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
                        className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                          isListening
                            ? 'bg-rose-500 hover:bg-rose-400 text-white'
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
                          title={`بازگردانی به پیش‌فرض (${formatShortcutBadge(
                            def.defaultBinding
                          )})`}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-300 rounded-lg cursor-pointer"
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

          {/* Interactive Live Key Test Area */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <Keyboard className="w-4 h-4 text-sky-400" />
                <span>تست زنده کلیدهای شخصی‌سازی‌شده (Live Key Tester):</span>
              </div>
              <p className="text-[11px] text-slate-400">
                همین الان هر کلیدی را روی صفحه‌کلید فشار دهید تا عملکرد متصل به
                آن در کنترلر پخش ویدئو بررسی شود:
              </p>
            </div>

            <div className="flex items-center gap-2">
              {lastTestedEvent ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700">
                  <kbd
                    dir="ltr"
                    className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono-tabular font-bold"
                  >
                    {formatShortcutBadge(lastTestedEvent.binding)}
                  </kbd>
                  <span className="text-slate-400">←</span>
                  {lastTestedEvent.matchedLabel ? (
                    <span className="text-emerald-300 font-bold">
                      {lastTestedEvent.matchedLabel}
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      بدون دستور در کنترلر ویدئو
                    </span>
                  )}
                </div>
              ) : (
                <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                  منتظر فشردن کلید جهت تست...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <HardDrive className="w-4 h-4 text-teal-400" />
            <span>
              کلید ذخیره‌سازی در مرورگر:{' '}
              <code className="text-teal-300 font-mono-tabular">
                localStorage[&quot;{SHORTCUT_STORAGE_KEY}&quot;]
              </code>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                saveShortcuts(shortcuts);
                onShortcutsChanged?.(shortcuts);
                onClose();
              }}
              className="px-5 py-2 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>تایید و بازگشت به پلیر</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
