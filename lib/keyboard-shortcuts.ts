export type ShortcutActionId =
  | 'player_toggle_play'
  | 'player_frame_forward'
  | 'player_frame_backward'
  | 'player_jump_forward_1s'
  | 'player_jump_backward_1s'
  | 'player_jump_forward_5s'
  | 'player_jump_backward_5s'
  | 'player_jump_trim_in'
  | 'player_jump_trim_out'
  | 'player_reset_start'
  | 'player_toggle_mute'
  | 'nav_tab_dashboard'
  | 'nav_tab_schedule'
  | 'nav_tab_inbox'
  | 'nav_tab_playout'
  | 'nav_tab_archive'
  | 'action_open_upload'
  | 'action_open_media_library'
  | 'action_auto_resolve'
  | 'action_open_shortcuts';

export interface ShortcutDefinition {
  id: ShortcutActionId;
  category: 'player' | 'workspace';
  label: string;
  description: string;
  defaultBinding: string;
}

export type ShortcutMap = Record<ShortcutActionId, string>;

export interface PlayerShortcutPreset {
  id: string;
  name: string;
  description: string;
  overrides: Partial<ShortcutMap>;
}

export const SHORTCUT_STORAGE_KEY = 'irib_isfahan_keyboard_shortcuts_v1';

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  // Broadcast Video Player (QC & Playout Trim)
  {
    id: 'player_toggle_play',
    category: 'player',
    label: 'پخش / توقف ویدئو (Play / Pause)',
    description:
      'شروع یا توقف لحظه‌ای پخش در کنترلر ویدئو (پیش‌فرض Space؛ قابل جایگزینی با هر کلید دلخواه مانند K یا Enter)',
    defaultBinding: 'Space',
  },
  {
    id: 'player_frame_forward',
    category: 'player',
    label: 'حرکت دقیق ۱ فریم به جلو (+1 Frame @ 25fps)',
    description: 'جلو بردن ویدئو به اندازه ۰.۰۴ ثانیه (یک فریم استاندارد PAL)',
    defaultBinding: 'ArrowRight',
  },
  {
    id: 'player_frame_backward',
    category: 'player',
    label: 'حرکت دقیق ۱ فریم به عقب (-1 Frame @ 25fps)',
    description: 'عقب بردن ویدئو به اندازه ۰.۰۴ ثانیه (یک فریم استاندارد PAL)',
    defaultBinding: 'ArrowLeft',
  },
  {
    id: 'player_jump_forward_1s',
    category: 'player',
    label: 'پرش ۱ ثانیه به جلو (+1s Step)',
    description: 'جلو بردن هد پخش به اندازه ۱ ثانیه کامل (۲۵ فریم)',
    defaultBinding: 'KeyL',
  },
  {
    id: 'player_jump_backward_1s',
    category: 'player',
    label: 'پرش ۱ ثانیه به عقب (-1s Step)',
    description: 'عقب بردن هد پخش به اندازه ۱ ثانیه کامل (۲۵ فریم)',
    defaultBinding: 'KeyJ',
  },
  {
    id: 'player_jump_forward_5s',
    category: 'player',
    label: 'پرش ۵ ثانیه به جلو (+5s Fast Forward)',
    description: 'حرکت سریع ۵ ثانیه‌ای به جلو روی تایم‌لاین',
    defaultBinding: 'Shift+ArrowRight',
  },
  {
    id: 'player_jump_backward_5s',
    category: 'player',
    label: 'پرش ۵ ثانیه به عقب (-5s Rewind)',
    description: 'حرکت سریع ۵ ثانیه‌ای به عقب روی تایم‌لاین',
    defaultBinding: 'Shift+ArrowLeft',
  },
  {
    id: 'player_jump_trim_in',
    category: 'player',
    label: 'پرش به نقطه شروع پخش (Go to Trim In)',
    description: 'انتقال آنی هد پخش به ثانیه شروع محدوده مجاز (In)',
    defaultBinding: 'KeyI',
  },
  {
    id: 'player_jump_trim_out',
    category: 'player',
    label: 'پرش به نقطه پایان پخش (Go to Trim Out)',
    description: 'انتقال آنی هد پخش به ثانیه پایان محدوده مجاز (Out)',
    defaultBinding: 'KeyO',
  },
  {
    id: 'player_reset_start',
    category: 'player',
    label: 'بازگشت به ابتدای فایل (Jump to 00:00:00)',
    description: 'انتقال فوری هد پخش به ثانیه صفر ابتدای فایل تصویری',
    defaultBinding: 'Home',
  },
  {
    id: 'player_toggle_mute',
    category: 'player',
    label: 'قطع / وصل صدای مانیتورینگ (Mute / Unmute)',
    description: 'بی‌صدا یا وصل کردن خروجی صدای پلیر بازبینی',
    defaultBinding: 'KeyM',
  },

  // Global Workspace & MCR Operations
  {
    id: 'nav_tab_dashboard',
    category: 'workspace',
    label: 'صفحه ۱: داشبورد و ماتریس نقش‌ها',
    description: 'سوییچ سریع به صفحه فرماندهی و تشخیص تداخل‌ها',
    defaultBinding: 'Alt+Digit1',
  },
  {
    id: 'nav_tab_schedule',
    category: 'workspace',
    label: 'صفحه ۲: جدول ۲۴ ساعته کنداکتور',
    description: 'سوییچ سریع به جدول اصلی کنداکتور پخش',
    defaultBinding: 'Alt+Digit2',
  },
  {
    id: 'nav_tab_inbox',
    category: 'workspace',
    label: 'صفحه ۳: کارتابل بازبینی و تولید',
    description: 'سوییچ سریع به کارتابل ۱۱ مرحله‌ای گردش‌کار',
    defaultBinding: 'Alt+Digit3',
  },
  {
    id: 'nav_tab_playout',
    category: 'workspace',
    label: 'صفحه ۴: اتاق پلی‌اوت و رژی (MCR)',
    description: 'سوییچ سریع به مانیتورهای آنتن و کنترل سخت‌افزار پلی‌اوت',
    defaultBinding: 'Alt+Digit4',
  },
  {
    id: 'nav_tab_archive',
    category: 'workspace',
    label: 'صفحه ۵: آرشیو، تحویل شیفت و ابزارها',
    description: 'سوییچ سریع به ابزارهای آرشیو و صورتجلسه شیفت',
    defaultBinding: 'Alt+Digit5',
  },
  {
    id: 'action_open_upload',
    category: 'workspace',
    label: 'بارگذاری برنامه / نسخه جدید (Ingest)',
    description: 'باز کردن فرم تحویل فایل تهیه‌کننده و تدوینگر',
    defaultBinding: 'Alt+KeyU',
  },
  {
    id: 'action_open_media_library',
    category: 'workspace',
    label: 'مخزن متمرکز فایل‌های ویدئویی (NAS)',
    description: 'باز کردن پنجره مدیریت فایل‌های استوریج سرور محلی',
    defaultBinding: 'Alt+KeyM',
  },
  {
    id: 'action_auto_resolve',
    category: 'workspace',
    label: 'تراز خودکار زمان‌بندی کنداکتور',
    description: 'رفع خودکار شکاف‌ها و هم‌پوشانی‌های زمانی جدول ۲۴ ساعته',
    defaultBinding: 'Alt+KeyR',
  },
  {
    id: 'action_open_shortcuts',
    category: 'workspace',
    label: 'تنظیمات کلیدهای میانبر (Keyboard Shortcuts)',
    description: 'باز کردن پنجره مشاهده و تغییر شورتکات‌های کیبورد',
    defaultBinding: 'Alt+KeyK',
  },
];

export const PLAYER_SHORTCUT_PRESETS: PlayerShortcutPreset[] = [
  {
    id: 'broadcast_default',
    name: 'استاندارد برودکست (Space)',
    description: 'کلید Space برای پخش/توقف، جهت‌نماهای چپ و راست برای حرکت ۱ فریم',
    overrides: {
      player_toggle_play: 'Space',
      player_frame_forward: 'ArrowRight',
      player_frame_backward: 'ArrowLeft',
      player_jump_forward_1s: 'KeyL',
      player_jump_backward_1s: 'KeyJ',
      player_jump_forward_5s: 'Shift+ArrowRight',
      player_jump_backward_5s: 'Shift+ArrowLeft',
    },
  },
  {
    id: 'nle_jkl',
    name: 'تدوینگر حرفه‌ای (J / K / L)',
    description: 'جایگزینی Space با کلید K برای پخش/توقف (مطابق Avid / Premiere)',
    overrides: {
      player_toggle_play: 'KeyK',
      player_frame_forward: 'ArrowRight',
      player_frame_backward: 'ArrowLeft',
      player_jump_forward_1s: 'KeyL',
      player_jump_backward_1s: 'KeyJ',
      player_jump_forward_5s: 'Shift+KeyL',
      player_jump_backward_5s: 'Shift+KeyJ',
    },
  },
  {
    id: 'operator_enter',
    name: 'اپراتور پلی‌اوت (کلید Enter / P)',
    description: 'جایگزینی Space با کلید P برای جلوگیری از توقف ناخواسته با کلید فاصله',
    overrides: {
      player_toggle_play: 'KeyP',
      player_frame_forward: ' period' in {} ? 'Period' : 'ArrowRight',
      player_frame_backward: 'ArrowLeft',
      player_jump_forward_1s: 'KeyL',
      player_jump_backward_1s: 'KeyJ',
      player_jump_forward_5s: 'Shift+ArrowRight',
      player_jump_backward_5s: 'Shift+ArrowLeft',
    },
  },
];

export function getDefaultShortcuts(): ShortcutMap {
  const map = {} as ShortcutMap;
  for (const def of SHORTCUT_DEFINITIONS) {
    map[def.id] = def.defaultBinding;
  }
  return map;
}

export function loadSavedShortcuts(): ShortcutMap {
  const defaults = getDefaultShortcuts();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveShortcuts(map: ShortcutMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(map));
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel('irib_isfahan_shortcuts_sync');
      ch.postMessage(map);
      ch.close();
    }
    window.dispatchEvent(
      new CustomEvent('irib-shortcuts-updated', { detail: map })
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Converts a KeyboardEvent into a canonical binding string like:
 * "Space", "ArrowRight", "Shift+ArrowRight", "Alt+KeyK", "Ctrl+KeyS"
 */
export function eventToShortcutString(
  e: KeyboardEvent | React.KeyboardEvent
): string | null {
  const code = e.code || e.key;
  if (
    code === 'ShiftLeft' ||
    code === 'ShiftRight' ||
    code === 'ControlLeft' ||
    code === 'ControlRight' ||
    code === 'AltLeft' ||
    code === 'AltRight' ||
    code === 'MetaLeft' ||
    code === 'MetaRight'
  ) {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(code);
  return parts.join('+');
}

/**
 * Formats a binding string into a human-friendly badge label
 */
export function formatShortcutBadge(binding: string): string {
  if (!binding) return '—';
  return binding
    .split('+')
    .map((part) => {
      if (part === 'ArrowRight') return '→';
      if (part === 'ArrowLeft') return '←';
      if (part === 'ArrowUp') return '↑';
      if (part === 'ArrowDown') return '↓';
      if (part === 'Space') return 'Space (فاصله)';
      if (part === 'Enter') return 'Enter';
      if (part === 'NumpadEnter') return 'NumEnter';
      if (part === 'Numpad0') return 'Num 0';
      if (part === 'Home') return 'Home';
      if (part === 'End') return 'End';
      if (part === 'Period') return '.';
      if (part === 'Comma') return ',';
      if (part.startsWith('Key')) return part.slice(3);
      if (part.startsWith('Digit')) return part.slice(5);
      return part;
    })
    .join(' + ');
}
