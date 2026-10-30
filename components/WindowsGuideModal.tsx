'use client';

import React from 'react';
import {
  X,
  Monitor,
  Terminal,
  FileText,
  Server,
  Tv,
} from 'lucide-react';

interface WindowsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportJson: () => void;
}

export default function WindowsGuideModal({
  isOpen,
  onClose,
  onExportJson,
}: WindowsGuideModalProps) {
  if (!isOpen) return null;

  const handleDownloadServerBat = () => {
    const batContent = [
      '@echo off',
      'chcp 65001 > nul',
      'title سرور مرکزی اتوماسیون تولید، بازبینی و پلی‌اوت شبکه اصفهان - طراح: شهاب‌الدین باقری دولت‌آبادی',
      'echo ======================================================================',
      'echo   سامانه جامع آفلاین کنداکتور، بازبینی (QC) و پلی‌اوت شبکه اصفهان',
      'echo   طراح و برنامه‌نویس: شهاب‌الدین باقری دولت‌آبادی',
      'echo ======================================================================',
      'echo.',
      'if not exist "offline-data\\media" mkdir "offline-data\\media"',
      'if not exist "offline-data\\watchfolder" mkdir "offline-data\\watchfolder"',
      'echo در حال راه‌اندازی سرور شبکه داخلی سازمان (LAN) روی پورت 3000...',
      'echo.',
      'for /f "tokens=2 delims=:" %%a in (\'ipconfig ^| findstr /c:"IPv4"\') do (',
      '    echo آدرس اتصال کاربران در شبکه داخلی سازمان: http://%%a:3000',
      ')',
      'echo.',
      'start "" "http://localhost:3000"',
      'npx next start -H 0.0.0.0 -p 3000',
      'pause',
    ].join('\r\n');

    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'اجرای سرور مرکزی کنداکتور در ویندوز.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCleanFeedKioskBat = () => {
    const kioskBat = [
      '@echo off',
      'chcp 65001 > nul',
      'title خروجی تمام‌صفحه آنتن (Clean Feed Kiosk) - شبکه اصفهان',
      'echo در حال باز کردن خروجی خالص آنتن (Clean Feed) در حالت تمام‌صفحه و پخش خودکار صدا و تصویر...',
      'start msedge --kiosk "http://localhost:3000/playout-output" --edge-kiosk-type=fullscreen --autoplay-policy=no-user-gesture-required',
    ].join('\r\n');

    const blob = new Blob([kioskBat], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'اجرای خروجی آنتن تمام‌صفحه (Clean Feed Kiosk).bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                معماری استقرار آفلاین در شبکه داخلی سازمان (LAN) و یکپارچه‌سازی پلی‌اوت
              </h3>
              <p className="text-xs text-slate-400">
                طراح و برنامه‌نویس: شهاب‌الدین باقری دولت‌آبادی — صدا و سیمای مرکز اصفهان
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-sm text-slate-300 leading-relaxed">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5">
            <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-teal-400" />
              <span>
                زیرساخت ۱۰۰٪ آفلاین، ذخیره‌سازی متمرکز محلی و اتصال به زنجیره پخش:
              </span>
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
              <li>
                <strong>عدم وابستگی به اینترنت:</strong> کلیه فایل‌های ویدئویی در پوشه محلی{' '}
                <code className="text-teal-300 font-mono-tabular">
                  ./offline-data/media
                </code>{' '}
                و اطلاعات کنداکتور، نسخه‌ها و سوابق بازبینی در{' '}
                <code className="text-teal-300 font-mono-tabular">
                  ./offline-data/conductor-state.json
                </code>{' '}
                روی سرور داخلی سازمان نگهداری می‌شوند.
              </li>
              <li>
                <strong>استریم داخلی بدون نیاز به دانلود:</strong> سرویس{' '}
                <code className="text-sky-300 font-mono-tabular">
                  /api/media/[filename]
                </code>{' '}
                با پشتیبانی از پروتکل <code>HTTP 206 Range</code> امکان جلو و عقب بردن آنی ویدئو را برای بازبین‌ها در مرورگر فراهم می‌کند.
              </li>
              <li>
                <strong>یکپارچه‌سازی با سامانه پلی‌اوت و آنتن:</strong> ارسال مستقیم فرامین از طریق سوکت{' '}
                <span className="text-amber-300">TCP/AMCP (پورت 5250)</span> به سرور پلی‌اوت محلی و همچنین اسکریپت کیوسک خروجی تصویر خالص{' '}
                <span className="font-mono-tabular text-rose-300">
                  /playout-output
                </span>{' '}
                جهت اتصال به مبدل سخت‌افزاری SDI.
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-slate-100 text-xs">
              تفکیک ۶ نقش کاربری و مسئولیت‌های عملیاتی در شبکه داخلی:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <div className="font-semibold text-purple-300">
                  الف) تهیه‌کننده و تدوینگر (پین: 1100)
                </div>
                <div className="text-slate-400 mt-1">
                  بارگذاری فایل ویدئویی، ثبت نسخه و مشخصات، مشاهده اصلاحیه‌های بازه‌ای و ارسال نسخه اصلاح‌شده جدید با حفظ سوابق قبلی
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <div className="font-semibold text-sky-300">
                  ب) واحد هماهنگی (پین: 2200)
                </div>
                <div className="text-slate-400 mt-1">
                  دریافت فایل از تولید، ارجاع به بازبین، بازگرداندن اصلاحیه‌ها به تولید و ارسال محتوای تأییدشده نهایی به صف پلی‌اوت
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <div className="font-semibold text-amber-300">
                  ج) بازبین QC (پین: 3300)
                </div>
                <div className="text-slate-400 mt-1">
                  مشاهده مستقیم ویدئو در پخش‌کننده داخلی، ثبت اصلاحیه در زمان دقیق یا بازه زمانی، و ثبت تأیید / درخواست اصلاح / ارجاع به مدیر پخش
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <div className="font-semibold text-teal-300">
                  د) مدیر پخش (پین: 1405)
                </div>
                <div className="text-slate-400 mt-1">
                  بررسی پرونده‌های ارجاع‌شده برای تصمیم‌گیری مدیریتی؛ تأیید و بازگشت به هماهنگی یا الزام به اصلاح از مسیر هماهنگی به تولید
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <div className="font-semibold text-emerald-300">
                  هـ) مسئول مدیریت پلی‌اوت (پین: 4400)
                </div>
                <div className="text-slate-400 mt-1">
                  دریافت فایل‌های تأییدشده، کنترل پیش از پخش، تعیین محدوده زمانی استفاده (Mark In / Out) و تنظیم چیدمان پلی‌لیست
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <div className="font-semibold text-rose-300">
                  و) اپراتور پایش پخش (پین: 5500)
                </div>
                <div className="text-slate-400 mt-1">
                  حالت پایش صرف (Read-Only): مشاهده وضعیت آمادگی فایل‌ها، زمان‌بندی و اجرای پخش و ثبت خطاها بدون مجوز تغییر یا ویرایش
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadServerBat}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>دانلود اسکریپت سرور شبکه (.bat)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCleanFeedKioskBat}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-200 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Tv className="w-3.5 h-3.5 text-rose-400" />
                <span>اسکریپت کیوسک خروجی آنتن (Clean Feed .bat)</span>
              </button>

              <button
                type="button"
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>پشتیبان JSON کنداکتور</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
