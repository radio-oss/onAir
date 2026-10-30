'use client';

import React, { useState, useEffect } from 'react';
import {
  ScheduleItem,
  QCMarker,
  QCMarkerCategory,
  QCMarkerSeverity,
  WorkflowStage,
  RoleDefinition,
  WORKFLOW_STAGE_META,
  QC_CATEGORY_META,
  formatDurationTotal,
} from '@/lib/conductor-data';
import { loadOfflineVideoBlobUrl } from '@/lib/offline-media-db';
import BroadcastVideoPlayer from './BroadcastVideoPlayer';
import {
  X,
  Plus,
  CheckCircle2,
  Send,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Check,
  Clock,
  History,
  Layers,
  AlertOctagon,
  PlayCircle,
} from 'lucide-react';

interface VideoQCModalProps {
  isOpen: boolean;
  item: ScheduleItem | null;
  currentRole: RoleDefinition;
  onClose: () => void;
  onSaveMarkersAndStage: (
    itemId: string,
    markers: QCMarker[],
    nextStage: WorkflowStage,
    comment?: string
  ) => void;
}

export default function VideoQCModal({
  isOpen,
  item,
  currentRole,
  onClose,
  onSaveMarkersAndStage,
}: VideoQCModalProps) {
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [markers, setMarkers] = useState<QCMarker[]>([]);
  const [previewVersionNum, setPreviewVersionNum] = useState<number>(1);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | undefined>(
    undefined
  );
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [category, setCategory] = useState<QCMarkerCategory>('editorial');
  const [severity, setSeverity] = useState<QCMarkerSeverity>('critical');
  const [useRangeMode, setUseRangeMode] = useState<boolean>(false);
  const [rangeStartSec, setRangeStartSec] = useState<number>(0);
  const [rangeEndSec, setRangeEndSec] = useState<number>(15);
  const [note, setNote] = useState<string>('');
  const [decisionComment, setDecisionComment] = useState<string>('');
  const [leftTab, setLeftTab] = useState<'markers' | 'versions' | 'history'>(
    'markers'
  );

  useEffect(() => {
    if (item) {
      const activeVer = item.revisionVersion || 1;
      setMarkers(item.qcMarkers || []);
      setPreviewVersionNum(activeVer);
      setPreviewVideoUrl(item.videoUrl);
      setPreviewFileName(item.videoFileName || '');
      const initSec = item.trimInSec || 0;
      setCurrentTimeSec(initSec);
      setRangeStartSec(initSec);
      setRangeEndSec(initSec + 15);
      setIsPlaying(false);
      setNote('');
      setDecisionComment('');
      setLeftTab('markers');
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const isViewingLatestVersion =
    previewVersionNum === (item.revisionVersion || 1);

  const canModifyMarkers =
    isViewingLatestVersion &&
    !currentRole.isMonitoringOnly &&
    (currentRole.canPerformQC || currentRole.canDirectorOverride);

  const handleSelectVersionPreview = async (verNum: number) => {
    setIsPlaying(false);
    setPreviewVersionNum(verNum);
    const foundVer = (item.versions || []).find(
      (v) => v.versionNumber === verNum
    );
    if (foundVer) {
      setPreviewFileName(foundVer.videoFileName);
      if (foundVer.videoUrl) {
        setPreviewVideoUrl(foundVer.videoUrl);
      } else {
        const blobUrl = await loadOfflineVideoBlobUrl(item.id, verNum);
        setPreviewVideoUrl(blobUrl || item.videoUrl);
      }
    }
    setCurrentTimeSec(0);
  };

  const handleAddMarker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || !canModifyMarkers) return;

    const startSec = useRangeMode
      ? Math.min(rangeStartSec, rangeEndSec)
      : Math.floor(currentTimeSec);
    const endSec = useRangeMode
      ? Math.max(rangeStartSec + 1, rangeEndSec)
      : undefined;

    const newMarker: QCMarker = {
      id: `qc-${Date.now()}`,
      timeSec: startSec,
      timecode: formatDurationTotal(startSec),
      endTimeSec: endSec,
      endTimecode: endSec !== undefined ? formatDurationTotal(endSec) : undefined,
      versionNumber: item.revisionVersion || 1,
      category,
      severity,
      note: note.trim(),
      author: `${currentRole.personName} (${currentRole.title})`,
      createdAt: new Date().toLocaleTimeString('fa-IR'),
      resolved: false,
    };
    const next = [...markers, newMarker].sort((a, b) => a.timeSec - b.timeSec);
    setMarkers(next);
    setNote('');
  };

  const handleToggleResolved = (markerId: string) => {
    if (!canModifyMarkers) return;
    setMarkers((prev) =>
      prev.map((m) => (m.id === markerId ? { ...m, resolved: !m.resolved } : m))
    );
  };

  const handleDeleteMarker = (markerId: string) => {
    if (!canModifyMarkers) return;
    setMarkers((prev) => prev.filter((m) => m.id !== markerId));
  };

  const unresolvedCount = markers.filter((m) => !m.resolved).length;
  const stageMeta =
    WORKFLOW_STAGE_META[item.workflowStatus || 'approved_for_playout'];
  const versionsList = item.versions || [];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-100">
                میز بازبینی داخلی (QC)، سوابق نسخه و تایملاین — ردیف {item.order}
              </h3>
              <span className="px-2 py-0.5 text-[11px] font-mono-tabular font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded-md">
                نسخه در حال مشاهده: v{previewVersionNum}
              </span>
              <span
                className={`px-2.5 py-0.5 text-[11px] font-medium border rounded-md ${stageMeta.badgeClass}`}
              >
                {stageMeta.label}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {item.title} ({item.mediaCode}) — نقش فعال: {currentRole.title} (
              {currentRole.personName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Right 7 Cols: Video Player + Add Marker Form */}
          <div className="lg:col-span-7 space-y-4">
            {!isViewingLatestVersion && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-lg flex items-center justify-between text-xs text-amber-200">
                <span>
                  شما در حال مشاهده نسخه آرشیوی{' '}
                  <strong className="font-mono-tabular">
                    v{previewVersionNum}
                  </strong>{' '}
                  هستید.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleSelectVersionPreview(item.revisionVersion || 1)
                  }
                  className="px-2.5 py-1 bg-amber-400 text-slate-950 font-bold rounded cursor-pointer"
                >
                  بازگشت به آخرین نسخه (v{item.revisionVersion || 1})
                </button>
              </div>
            )}

            <BroadcastVideoPlayer
              item={{
                ...item,
                revisionVersion: previewVersionNum,
                videoUrl: previewVideoUrl,
                videoFileName: previewFileName || item.videoFileName,
                qcMarkers: markers,
              }}
              currentTimeSec={currentTimeSec}
              isPlaying={isPlaying}
              draftRange={
                useRangeMode && rangeEndSec > rangeStartSec
                  ? { startSec: rangeStartSec, endSec: rangeEndSec }
                  : null
              }
              onTimeChange={setCurrentTimeSec}
              onPlayStateChange={setIsPlaying}
            />

            {/* Pin New Revision Marker on Exact Timestamp OR Time Range */}
            {canModifyMarkers ? (
              <form
                onSubmit={handleAddMarker}
                className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      ثبت اصلاحیه روی نسخه v{item.revisionVersion || 1} در{' '}
                      {useRangeMode ? (
                        <strong className="font-mono-tabular text-amber-300">
                          بازه {formatDurationTotal(rangeStartSec)} تا{' '}
                          {formatDurationTotal(rangeEndSec)}
                        </strong>
                      ) : (
                        <strong className="font-mono-tabular text-teal-300">
                          لحظه {formatDurationTotal(Math.floor(currentTimeSec))}
                        </strong>
                      )}
                    </span>
                  </span>

                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setUseRangeMode(false)}
                      className={`px-2.5 py-1 rounded cursor-pointer ${
                        !useRangeMode
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      زمان دقیق (تک‌نقطه)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUseRangeMode(true);
                        setRangeStartSec(Math.floor(currentTimeSec));
                        setRangeEndSec(Math.floor(currentTimeSec) + 15);
                      }}
                      className={`px-2.5 py-1 rounded cursor-pointer ${
                        useRangeMode
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      بازه زمانی (از ... تا ...)
                    </button>
                  </div>
                </div>

                {useRangeMode && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">شروع بازه:</span>
                      <span className="font-mono-tabular text-teal-300 font-bold">
                        {formatDurationTotal(rangeStartSec)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setRangeStartSec(Math.floor(currentTimeSec))
                        }
                        className="px-2 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 rounded cursor-pointer"
                      >
                        ثبت لحظه فعلی (Set In)
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">پایان بازه:</span>
                      <span className="font-mono-tabular text-amber-300 font-bold">
                        {formatDurationTotal(rangeEndSec)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setRangeEndSec(
                            Math.max(
                              rangeStartSec + 1,
                              Math.floor(currentTimeSec)
                            )
                          )
                        }
                        className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded cursor-pointer"
                      >
                        ثبت لحظه فعلی (Set Out)
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as QCMarkerCategory)
                    }
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                  >
                    {Object.entries(QC_CATEGORY_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={severity}
                    onChange={(e) =>
                      setSeverity(e.target.value as QCMarkerSeverity)
                    }
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                  >
                    <option value="critical">
                      خطای بحرانی (مانع پخش / نیازمند اصلاح حتمی)
                    </option>
                    <option value="warning">
                      تذکر فنی / قابل بررسی توسط مدیر پخش
                    </option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="شرح دقیق اصلاحیه یا توضیح بازبین برای تهیه‌کننده/تدوینگر..."
                    className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت اصلاحیه</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-400">
                شما در حال مشاهده تایملاین و نقاط اصلاحیه با نقش «
                {currentRole.title}» هستید. روی هر مارکر کلیک کنید تا ویدئو به
                همان ثانیه یا بازه زمانی منتقل شود.
              </div>
            )}
          </div>

          {/* Left 5 Cols: Markers List, Version History & Role-Aware Workflow Routing */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              {/* Sub-tabs: Markers vs Versions vs Workflow History (OS 26 Segmented Pill Control) */}
              <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/[0.08] shadow-inner w-full">
                <button
                  type="button"
                  onClick={() => setLeftTab('markers')}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                    leftTab === 'markers'
                      ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                      : 'text-slate-400 hover:text-slate-200 rounded-lg'
                  }`}
                >
                  اصلاحیه‌ها ({markers.length} — {unresolvedCount} باز)
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab('versions')}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 ${
                    leftTab === 'versions'
                      ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                      : 'text-slate-400 hover:text-slate-200 rounded-lg'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>نسخه‌های فایل ({versionsList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab('history')}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 ${
                    leftTab === 'history'
                      ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                      : 'text-slate-400 hover:text-slate-200 rounded-lg'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>سوابق گردش‌کار</span>
                </button>
              </div>

              {leftTab === 'markers' && (
                <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
                  {markers.length === 0 ? (
                    <div className="p-6 text-center bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-slate-400">
                      هیچ مورد اصلاحیه برای این برنامه ثبت نشده است.
                    </div>
                  ) : (
                    markers.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setCurrentTimeSec(m.timeSec);
                          setIsPlaying(false);
                        }}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          m.resolved
                            ? 'bg-slate-950/40 border-slate-800 opacity-60'
                            : m.severity === 'critical'
                            ? 'bg-rose-950/25 border-rose-500/40 hover:bg-rose-950/40'
                            : 'bg-amber-950/20 border-amber-500/40 hover:bg-amber-950/35'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded font-mono-tabular text-xs font-bold text-teal-300">
                              {m.endTimecode
                                ? `${m.timecode} تا ${m.endTimecode}`
                                : m.timecode}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono-tabular">
                              نسخه v{m.versionNumber || 1}
                            </span>
                            <span
                              className={`text-[11px] font-semibold ${
                                QC_CATEGORY_META[m.category].colorClass
                              }`}
                            >
                              {QC_CATEGORY_META[m.category].label}
                            </span>
                          </div>

                          {canModifyMarkers && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleToggleResolved(m.id);
                                }}
                                title="تغییر وضعیت به رفع‌شده"
                                className="p-1 text-slate-400 hover:text-emerald-400 rounded cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleDeleteMarker(m.id);
                                }}
                                title="حذف مارکر"
                                className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-slate-200 mt-1.5 leading-relaxed">
                          {m.note}
                        </p>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                          <span>ثبت توسط: {m.author}</span>
                          <span>
                            {m.resolved ? '✓ رفع‌شده در نسخه جدید' : 'نیازمند اصلاح'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {leftTab === 'versions' && (
                <div className="space-y-2.5 max-h-[310px] overflow-y-auto p-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs">
                  {versionsList.map((ver) => {
                    const isSelectedPreview =
                      ver.versionNumber === previewVersionNum;
                    return (
                      <div
                        key={ver.versionNumber}
                        className={`p-3 rounded-lg border space-y-1.5 ${
                          isSelectedPreview
                            ? 'bg-slate-900 border-teal-500/60'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-teal-300 font-mono-tabular">
                            نسخه v{ver.versionNumber} — {ver.videoFileName}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectVersionPreview(ver.versionNumber)
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                              isSelectedPreview
                                ? 'bg-teal-400 text-slate-950'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>
                              {isSelectedPreview
                                ? 'در حال نمایش در پلیر'
                                : 'مشاهده این نسخه در پلیر'}
                            </span>
                          </button>
                        </div>
                        <div className="text-slate-300 flex items-center justify-between">
                          <span>
                            تحویل‌دهنده: {ver.uploadedBy} | مدت: {ver.duration}
                          </span>
                          <span className="text-[11px] font-mono-tabular text-slate-400">
                            {ver.uploadedAt}
                          </span>
                        </div>
                        {ver.notes && (
                          <div className="text-slate-400 text-[11px]">
                            توضیحات نسخه: {ver.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {leftTab === 'history' && (
                <div className="space-y-2 max-h-[310px] overflow-y-auto p-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs">
                  {(item.workflowHistory || []).map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-200">
                          {log.actorName}
                        </span>
                        <span className="font-mono-tabular">
                          {log.timestamp}{' '}
                          {log.versionNumber ? `(v${log.versionNumber})` : ''}
                        </span>
                      </div>
                      <div className="text-teal-300 text-[11px]">
                        تغییر وضعیت به:{' '}
                        {WORKFLOW_STAGE_META[log.toStage]?.label || log.toStage}
                      </div>
                      {log.comment && (
                        <div className="text-slate-300 text-xs">
                          {log.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Role-Aware Workflow Routing Actions */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-200">
                ثبت تصمیم و ارجاع در چرخه پخش (نقش: {currentRole.title}):
              </div>
              <input
                type="text"
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                disabled={Boolean(currentRole.isMonitoringOnly)}
                placeholder="توضیح یا نظر کارشناسی جهت ثبت در سوابق نسخه..."
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 disabled:opacity-50"
              />

              {/* ۱. تصمیم‌های بازبین (QC Inspector) */}
              {currentRole.id === 'qc_inspector' && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          item.id,
                          markers,
                          'qc_approved',
                          decisionComment ||
                            `تأیید بازبین برای ادامه فرایند پخش (نسخه v${
                              item.revisionVersion || 1
                            })`
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>۱. تأیید برای ادامه فرایند پخش</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          item.id,
                          markers,
                          'qc_needs_revision',
                          decisionComment ||
                            `درخواست اصلاح توسط بازبین (${markers.length} مورد روی تایملاین)`
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>۲. درخواست اصلاح</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSaveMarkersAndStage(
                        item.id,
                        markers,
                        'referred_to_director',
                        decisionComment ||
                          'رد محتوا / ارجاع توسط بازبین به مدیر پخش جهت تصمیم‌گیری مدیریتی'
                      )
                    }
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/90 hover:bg-rose-500 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    <AlertOctagon className="w-4 h-4" />
                    <span>
                      ۳. رد محتوا یا ارجاع به مدیر پخش جهت تصمیم‌گیری بیشتر
                    </span>
                  </button>
                </div>
              )}

              {/* ۲. تصمیم‌های مدیر پخش (Broadcast Director) */}
              {currentRole.id === 'level_1' && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          item.id,
                          markers,
                          'approved_by_director',
                          decisionComment ||
                            'تأیید توسط مدیر پخش و بازگشت به هماهنگی برای ادامه فرایند پخش'
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأیید و بازگشت به هماهنگی</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          item.id,
                          markers,
                          'approved_for_playout',
                          decisionComment ||
                            'تأیید نهایی مستقیم مدیر پخش و ارسال به صف پلی‌اوت'
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>تأیید نهایی و ارسال مستقیم به پلی‌اوت</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSaveMarkersAndStage(
                        item.id,
                        markers,
                        'rejected_by_director',
                        decisionComment ||
                          'الزام به انجام اصلاحات توسط مدیر پخش — ارجاع به هماهنگی جهت عودت به تولید'
                      )
                    }
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>
                      الزام به اصلاح (ارجاع از مسیر هماهنگی به تهیه‌کننده/تدوینگر)
                    </span>
                  </button>
                </div>
              )}

              {/* ۳. اقدامات واحد هماهنگی (Coordination) */}
              {currentRole.id === 'level_2' && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          item.id,
                          markers,
                          'in_qc_review',
                          decisionComment ||
                            `ارجاع نسخه v${
                              item.revisionVersion || 1
                            } از هماهنگی به بازبین (QC)`
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>ارجاع به بازبین (QC)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          item.id,
                          markers,
                          'returned_to_producer',
                          decisionComment ||
                            'بازگرداندن پرونده و اصلاحیه‌ها از هماهنگی به تهیه‌کننده/تدوینگر'
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>عودت اصلاحیه به تهیه‌کننده/تدوینگر</span>
                    </button>
                  </div>

                  {(item.workflowStatus === 'qc_approved' ||
                    item.workflowStatus === 'approved_by_director' ||
                    item.workflowStatus === 'approved_for_playout') && (
                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          item.id,
                          markers,
                          'approved_for_playout',
                          decisionComment ||
                            'ارسال محتوای تأییدشده نهایی توسط هماهنگی به صف پلی‌اوت'
                        )
                      }
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ارسال محتوای تأییدشده به صف پلی‌اوت</span>
                    </button>
                  )}
                </div>
              )}

              {currentRole.isMonitoringOnly && (
                <div className="text-[11px] text-amber-300">
                  نقش «اپراتور پایش پخش» در حالت پایش صرف قرار دارد و مجاز به
                  تغییر وضعیت تأیید یا اصلاحیه‌ها نیست.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
