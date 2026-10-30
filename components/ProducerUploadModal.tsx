'use client';

import React, { useState, useEffect } from 'react';
import {
  ScheduleItem,
  ProgramCategory,
  MediaVersionEntry,
  CATEGORY_META,
  QC_CATEGORY_META,
  formatDurationTotal,
  computeEndTime,
  parseTimeToSeconds,
} from '@/lib/conductor-data';
import {
  X,
  Upload,
  Film,
  CheckCircle2,
  AlertTriangle,
  Send,
  FolderSearch,
} from 'lucide-react';

interface ProducerUploadModalProps {
  isOpen: boolean;
  existingItem?: ScheduleItem | null;
  defaultStartTime: string;
  nextOrder: number;
  onClose: () => void;
  onSubmitDelivery: (
    item: ScheduleItem,
    isRevision: boolean,
    rawFile?: File | null
  ) => void;
}

interface WatchFolderFile {
  fileName: string;
  sizeMB: string;
  videoUrl: string;
}

export default function ProducerUploadModal({
  isOpen,
  existingItem,
  defaultStartTime,
  nextOrder,
  onClose,
  onSubmitDelivery,
}: ProducerUploadModalProps) {
  const [title, setTitle] = useState<string>('');
  const [episode, setEpisode] = useState<string>('');
  const [category, setCategory] = useState<ProgramCategory>('production');
  const [producerName, setProducerName] = useState<string>(
    'واحد تولید و تدوین مرکز اصفهان'
  );
  const [mediaCode, setMediaCode] = useState<string>('');
  const [durationStr, setDurationStr] = useState<string>('00:30:00');
  const [sourceDurationSec, setSourceDurationSec] = useState<number>(1800);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const [videoFileName, setVideoFileName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [watchFolderFiles, setWatchFolderFiles] = useState<WatchFolderFile[]>(
    []
  );
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (existingItem) {
      setTitle(existingItem.title);
      setEpisode(existingItem.episode || '');
      setCategory(existingItem.category);
      setProducerName(
        existingItem.producerName || 'واحد تولید و تدوین مرکز اصفهان'
      );
      setMediaCode(existingItem.mediaCode);
      setDurationStr(existingItem.duration);
      setSourceDurationSec(
        existingItem.sourceDurationSec ||
          parseTimeToSeconds(existingItem.duration)
      );
      setVideoUrl(existingItem.videoUrl);
      setVideoFileName(existingItem.videoFileName || '');
      setSelectedFile(null);
      setNotes(existingItem.notes || '');
    } else {
      setTitle('');
      setEpisode('');
      setCategory('production');
      setProducerName('واحد تولید و تدوین مرکز اصفهان');
      setMediaCode(`PROD-ISF-${100 + nextOrder}`);
      setDurationStr('00:30:00');
      setSourceDurationSec(1800);
      setVideoUrl(undefined);
      setVideoFileName('');
      setSelectedFile(null);
      setNotes('');
    }
  }, [existingItem, nextOrder, isOpen]);

  if (!isOpen) return null;

  const extractVideoMetadata = (url: string, fallbackName: string) => {
    if (!title) {
      setTitle(fallbackName.replace(/\.[^/.]+$/, ''));
    }
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = url;
    tempVideo.onloadedmetadata = () => {
      const sec = Math.max(5, Math.round(tempVideo.duration || 1800));
      setSourceDurationSec(sec);
      setDurationStr(formatDurationTotal(sec));
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoUrl(objectUrl);
    setVideoFileName(file.name);
    extractVideoMetadata(objectUrl, file.name);
  };

  const handleLoadWatchFolder = async () => {
    try {
      const res = await fetch('/api/media/watchfolder');
      if (res.ok) {
        const data = await res.json();
        setWatchFolderFiles(data.files || []);
      }
    } catch {
      setWatchFolderFiles([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    let finalServerUrl = videoUrl;
    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const uploaded = await res.json();
          if (uploaded.videoUrl) {
            finalServerUrl = uploaded.videoUrl;
          }
        }
      } catch {
        // Fallback to local IndexedDB / Blob URL
      }
    }

    const isRevision = Boolean(existingItem);
    const startTime = existingItem ? existingItem.startTime : defaultStartTime;
    const resolvedMarkers = (existingItem?.qcMarkers || []).map((m) => ({
      ...m,
      resolved: true,
    }));

    const nextVersion =
      isRevision && existingItem
        ? (existingItem.revisionVersion || 1) + 1
        : 1;
    const resolvedFileName =
      videoFileName || 'فایل تحویلی استودیو (Offline NAS)';

    const newVersionEntry: MediaVersionEntry = {
      versionNumber: nextVersion,
      videoFileName: resolvedFileName,
      videoUrl: finalServerUrl,
      duration: durationStr,
      uploadedBy: producerName,
      uploadedAt: new Date().toLocaleTimeString('fa-IR'),
      notes,
    };

    const updatedVersions: MediaVersionEntry[] =
      isRevision && existingItem
        ? [newVersionEntry, ...(existingItem.versions || [])]
        : [newVersionEntry];

    const deliveredItem: ScheduleItem = {
      ...(existingItem || {
        id: `item-${Date.now()}`,
        order: nextOrder,
        source: 'server1',
        status: 'ready',
        aspectRatio: '16:9 HD',
        audioTrack: 'stereo',
      }),
      title,
      episode,
      category,
      producerName,
      mediaCode: mediaCode.toUpperCase(),
      startTime,
      duration: durationStr,
      endTime: computeEndTime(startTime, durationStr),
      sourceDurationSec,
      trimInSec: 0,
      trimOutSec: sourceDurationSec,
      videoUrl: finalServerUrl,
      videoFileName: resolvedFileName,
      notes,
      revisionVersion: nextVersion,
      versions: updatedVersions,
      workflowStatus: 'uploaded_by_producer',
      status: 'ready',
      qcMarkers: resolvedMarkers,
    };

    setIsUploading(false);
    onSubmitDelivery(deliveredItem, isRevision, selectedFile);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {existingItem
                  ? `بارگذاری نسخه اصلاح‌شده (تدوین مجدد) — ردیف ${existingItem.order}`
                  : 'تحویل و بارگذاری برنامه جدید توسط تهیه‌کننده / تدوینگر'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ارسال مستقیم فایل ویدیویی به کارتابل واحد هماهنگی پخش شبکه اصفهان
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[84vh] overflow-y-auto"
        >
          {existingItem &&
            existingItem.qcMarkers &&
            existingItem.qcMarkers.length > 0 && (
              <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-xl space-y-2">
                <div className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>
                    موارد اصلاحیه ابلاغ‌شده از سمت بازبین و هماهنگی جهت رفع در
                    تدوین:
                  </span>
                </div>
                <div className="space-y-1.5">
                  {existingItem.qcMarkers.map((m) => (
                    <div
                      key={m.id}
                      className="text-xs bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded flex items-center justify-between gap-2"
                    >
                      <span>
                        <strong className="font-mono-tabular text-teal-300">
                          [{m.timecode}]
                        </strong>{' '}
                        <span className="text-amber-300">
                          ({QC_CATEGORY_META[m.category].label}):
                        </span>{' '}
                        {m.note}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {m.author}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="p-4 border-2 border-dashed border-slate-700 hover:border-teal-500/60 bg-slate-950/60 rounded-xl text-center space-y-2 transition-colors">
            <Upload className="w-6 h-6 text-teal-400 mx-auto" />
            <div className="text-xs font-semibold text-slate-200">
              انتخاب فایل ویدیویی برنامه از سیستم محلی یا پوشه شبکه (Watch-Folder)
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-200 text-xs font-semibold rounded-lg cursor-pointer">
                <span>انتخاب فایل ویدیو از کامپیوتر</span>
                <input
                  type="file"
                  accept="video/*,.mp4,.webm,.mov,.mkv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleLoadWatchFolder}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg cursor-pointer"
              >
                <FolderSearch className="w-3.5 h-3.5 text-sky-400" />
                <span>انتخاب از پوشه شبکه (Watch-Folder)</span>
              </button>
            </div>

            {watchFolderFiles.length > 0 && (
              <div className="pt-2 space-y-1 text-right">
                <div className="text-[11px] text-slate-400">
                  فایل‌های موجود در پوشه شبکه:
                </div>
                {watchFolderFiles.map((wf) => (
                  <button
                    key={wf.fileName}
                    type="button"
                    onClick={() => {
                      setVideoUrl(wf.videoUrl);
                      setVideoFileName(wf.fileName);
                      extractVideoMetadata(wf.videoUrl, wf.fileName);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs flex items-center justify-between text-slate-200 cursor-pointer"
                  >
                    <span className="font-mono-tabular">{wf.fileName}</span>
                    <span className="text-[11px] text-teal-300">
                      {wf.sizeMB} MB
                    </span>
                  </button>
                ))}
              </div>
            )}

            {videoFileName && (
              <div className="text-xs text-emerald-300 font-mono-tabular pt-1 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  فایل انتخاب شد: {videoFileName} (مدت:{' '}
                  {formatDurationTotal(sourceDurationSec)})
                </span>
              </div>
            )}

            {videoUrl && (
              <video
                src={videoUrl}
                controls
                className="w-full max-h-40 rounded-lg border border-slate-800 bg-black mt-2 mx-auto"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-300 mb-1">
                عنوان برنامه *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: مستند نگارستان نصف جهان"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                شماره قسمت / کلاکت
              </label>
              <input
                type="text"
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                placeholder="قسمت ۱۴"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                طبقه برنامه
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ProgramCategory)
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              >
                {Object.entries(CATEGORY_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                مدت زمان برنامه (HH:MM:SS)
              </label>
              <input
                type="text"
                dir="ltr"
                required
                value={durationStr}
                onChange={(e) => {
                  setDurationStr(e.target.value);
                  setSourceDurationSec(parseTimeToSeconds(e.target.value));
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono-tabular text-teal-300 text-center"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                کد مدیا (Media Code)
              </label>
              <input
                type="text"
                dir="ltr"
                required
                value={mediaCode}
                onChange={(e) => setMediaCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono-tabular text-slate-200 text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                نام تهیه‌کننده / تدوینگر تحویل‌دهنده
              </label>
              <input
                type="text"
                value={producerName}
                onChange={(e) => setProducerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                توضیحات تدوینگر برای هماهنگی و بازبین
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: اصلاح تراز صدا انجام شد / آماده بازبینی"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isUploading
                  ? 'در حال انتقال فایل به سرور شبکه...'
                  : existingItem
                  ? 'ثبت نسخه اصلاح‌شده و ارسال به هماهنگی'
                  : 'بارگذاری و ارسال به کارتابل هماهنگی'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
