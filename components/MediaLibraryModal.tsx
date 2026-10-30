'use client';

import React, { useEffect, useState } from 'react';
import { ScheduleItem } from '@/lib/conductor-data';
import {
  X,
  HardDrive,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Trash2,
  FolderSearch,
  Play,
} from 'lucide-react';

interface StoredMediaItem {
  fileName: string;
  videoUrl: string;
  sizeBytes: number;
  sizeMB: string;
  modifiedAt: string;
  extension: string;
  detectedVersion: string;
  integrityStatus: 'valid' | 'corrupted_zero_byte';
  checksumShort: string;
}

interface MediaLibraryModalProps {
  isOpen: boolean;
  scheduleItems: ScheduleItem[];
  canManageStorage: boolean;
  onClose: () => void;
  onAttachFileToScheduleItem: (
    itemId: string,
    videoUrl: string,
    fileName: string
  ) => void;
}

export default function MediaLibraryModal({
  isOpen,
  scheduleItems,
  canManageStorage,
  onClose,
  onAttachFileToScheduleItem,
}: MediaLibraryModalProps) {
  const [files, setFiles] = useState<StoredMediaItem[]>([]);
  const [previewFile, setPreviewFile] = useState<StoredMediaItem | null>(null);
  const [totalSizeMB, setTotalSizeMB] = useState<string>('0.00');
  const [storagePath, setStoragePath] = useState<string>('./offline-data/media');
  const [transferErrors, setTransferErrors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>(
    scheduleItems[0]?.id || ''
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      // First trigger watchfolder sync so any newly dropped LAN files are ingested
      await fetch('/api/media/watchfolder').catch(() => {});
      const res = await fetch('/api/media/library');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setTotalSizeMB(data.totalSizeMB || '0.00');
        setStoragePath(data.storagePath || './offline-data/media');
        setTransferErrors(data.errors || []);
      }
    } catch {
      // Offline browser fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLibrary();
      if (scheduleItems.length > 0 && !selectedItemId) {
        setSelectedItemId(scheduleItems[0].id);
      }
    }
  }, [isOpen, scheduleItems, selectedItemId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDeleteBrokenFile = async (fileName: string) => {
    if (!canManageStorage) return;
    try {
      const res = await fetch('/api/media/library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      if (res.ok) {
        loadLibrary();
      }
    } catch {
      // Ignore
    }
  };

  const filteredFiles = files.filter((f) =>
    f.fileName.toLowerCase().includes(searchQuery.trim().toLowerCase())
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                مخزن متمرکز فایل‌های ویدئویی سازمان و مدیریت خطاهای انتقال (Local
                NAS / Media Repository)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                مسیر ذخیره‌سازی متمرکز سرور:{' '}
                <code className="font-mono-tabular text-teal-300">
                  {storagePath}
                </code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadLibrary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-teal-300 rounded-lg cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              <span>پویش مجدد استوریج و Watch-Folder</span>
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

        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Storage Telemetry */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
            <div>
              <div className="text-slate-400">تعداد کل فایل‌های فیزیکی سرور</div>
              <div className="text-base font-bold font-mono-tabular text-slate-100 mt-1">
                {files.length} فایل ویدئویی
              </div>
            </div>
            <div>
              <div className="text-slate-400">حجم مصرفی استوریج محلی</div>
              <div className="text-base font-bold font-mono-tabular text-teal-300 mt-1">
                {totalSizeMB} MB
              </div>
            </div>
            <div>
              <div className="text-slate-400">وضعیت سلامت انتقال فایل‌ها</div>
              <div
                className={`text-xs font-bold mt-1.5 flex items-center gap-1 ${
                  transferErrors.length === 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {transferErrors.length === 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تمامی فایل‌ها سالم و دارای Checksum معتبر</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>{transferErrors.length} خطای انتقال فایل شناسایی شد</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Transfer Errors Alert */}
          {transferErrors.length > 0 && (
            <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-xl space-y-1.5">
              <div className="font-bold text-rose-300">
                فهرست خطاهای بارگذاری یا انتقال ناقص فایل در شبکه:
              </div>
              {transferErrors.map((err, i) => (
                <div key={i} className="text-rose-200">
                  • {err}
                </div>
              ))}
            </div>
          )}

          {/* Search & Target Schedule Item Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام فایل یا شماره نسخه در استوریج محلی..."
                className="w-full pr-9 pl-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 shrink-0">اتصال به ردیف:</span>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
              >
                {scheduleItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    ردیف {it.order}: {it.title.slice(0, 34)} ({it.mediaCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Video Preview Player */}
          {previewFile && (
            <div className="p-3.5 bg-slate-950 border border-teal-500/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-teal-300" />
                  <span className="font-bold text-slate-100">
                    پیش‌نمایش مدیا: {previewFile.fileName}
                  </span>
                  <span className="text-teal-300 font-mono-tabular">
                    ({previewFile.detectedVersion} — {previewFile.sizeMB} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md cursor-pointer transition-colors"
                >
                  بستن پیش‌نمایش
                </button>
              </div>
              <video
                src={previewFile.videoUrl}
                controls
                autoPlay
                className="w-full max-h-44 rounded-lg bg-black border border-slate-800"
              />
            </div>
          )}

          {/* Physical Files Table */}
          <div className="border border-slate-800 rounded-lg bg-slate-950 overflow-x-auto max-h-72">
            {filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <FolderSearch className="w-7 h-7 text-slate-500 mx-auto" />
                <div>
                  هنوز فایل ویدئویی فیزیکی در پوشه{' '}
                  <code className="font-mono-tabular text-teal-300">
                    ./offline-data/media
                  </code>{' '}
                  یا{' '}
                  <code className="font-mono-tabular text-sky-300">
                    ./offline-data/watchfolder
                  </code>{' '}
                  قرار نگرفته است.
                </div>
                <div className="text-[11px] text-slate-500">
                  تهیه‌کنندگان و تدوینگران می‌توانند از طریق دکمه «بارگذاری برنامه
                  جدید» فایل‌های خود را به این مخزن ارسال کنند.
                </div>
              </div>
            ) : (
              <table className="w-full text-right">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md">
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-2.5">نام فایل در استوریج</th>
                    <th className="p-2.5 text-center">نسخه</th>
                    <th className="p-2.5 text-center">فرمت / حجم</th>
                    <th className="p-2.5 text-center">امضای سلامت (SHA-256)</th>
                    <th className="p-2.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredFiles.map((f) => (
                    <tr key={f.fileName} className="hover:bg-slate-900/60">
                      <td className="p-2.5 font-mono-tabular text-slate-100">
                        {f.fileName}
                      </td>
                      <td className="p-2.5 text-center font-mono-tabular text-teal-300 font-bold">
                        {f.detectedVersion}
                      </td>
                      <td className="p-2.5 text-center font-mono-tabular text-slate-300">
                        {f.extension} — {f.sizeMB} MB
                      </td>
                      <td className="p-2.5 text-center font-mono-tabular">
                        {f.integrityStatus === 'valid' ? (
                          <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded text-[10px]">
                            ✓ {f.checksumShort}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded text-[10px]">
                            ✕ فایل ناقص (0B)
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {f.integrityStatus === 'valid' && (
                            <button
                              type="button"
                              onClick={() => setPreviewFile(f)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold rounded text-xs cursor-pointer transition-colors"
                              title="پیش‌نمایش ویدئو در پلیر"
                            >
                              <Play className="w-3 h-3" />
                              <span>پیش‌نمایش</span>
                            </button>
                          )}
                          {f.integrityStatus === 'valid' && canManageStorage && (
                            <button
                              type="button"
                              onClick={() => {
                                onAttachFileToScheduleItem(
                                  selectedItemId,
                                  f.videoUrl,
                                  f.fileName
                                );
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold rounded text-xs cursor-pointer transition-colors"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              <span>اتصال به ردیف انتخابی</span>
                            </button>
                          )}
                          {canManageStorage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBrokenFile(f.fileName)}
                              className="p-1 text-slate-400 hover:text-rose-400 bg-slate-900 rounded cursor-pointer"
                              title="حذف فایل از استوریج"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
