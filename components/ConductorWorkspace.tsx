// components/ConductorWorkspace.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ATTACHED_CONDUCTOR_SCHEDULE,
  ConductorSchedule,
  ScheduleItem,
  AccessRoleLevel,
  RoleDefinition,
  WorkflowStage,
  QCMarker,
  WorkflowLogEntry,
  ROLES,
  CATEGORY_META,
  SOURCE_META,
  STATUS_META,
  WORKFLOW_STAGE_META,
  ProgramCategory,
  BroadcastStatus,
  parseTimeToSeconds,
  formatSecondsToTime,
  formatDurationTotal,
  computeEndTime,
  toBroadcastTimelineSeconds,
  recalculateScheduleItems,
  detectScheduleAnomalies,
  isItemApprovedForPlayout,
  mapWorkflowToBroadcastStatus,
  hydrateScheduleItem,
  ScheduleRevisionEntry,
} from '@/lib/conductor-data';
import {
  generateCasparCGCommands,
  generateCMX3600EDL,
} from '@/lib/playout-bridge';
import { appendAsRunLog } from '@/lib/as-run-logger';
import {
  saveOfflineVideoBlob,
  loadOfflineVideoBlobUrl,
} from '@/lib/offline-media-db';
import {
  calculateIsfahanPrayerTimes,
  getNextIsfahanAzanStatus,
} from '@/lib/isfahan-azan-calculator';
import {
  getArchivedSchedules,
  saveScheduleToArchive,
  ArchivedScheduleSummary,
} from '@/lib/schedule-templates';
import {
  ShortcutMap,
  getDefaultShortcuts,
  loadSavedShortcuts,
  eventToShortcutString,
  formatShortcutBadge,
} from '@/lib/keyboard-shortcuts';
import ItemEditorModal from './ItemEditorModal';
import WindowsGuideModal from './WindowsGuideModal';
import BroadcastVideoPlayer from './BroadcastVideoPlayer';
import VideoQCModal from './VideoQCModal';
import PlayoutTrimModal from './PlayoutTrimModal';
import ProducerUploadModal from './ProducerUploadModal';
import PlayoutManagementPanel from './PlayoutManagementPanel';
import QCCertificateModal from './QCCertificateModal';
import ShiftHandoverModal from './ShiftHandoverModal';
import RolePinModal from './RolePinModal';
import RoleCredentialsModal from './RoleCredentialsModal';
import ScheduleArchiveModal from './ScheduleArchiveModal';
import SystemAuditModal from './SystemAuditModal';
import MediaLibraryModal from './MediaLibraryModal';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import VideoPlayerShortcutsModal from './VideoPlayerShortcutsModal';
import LanPresenceAndBackupBar from './LanPresenceAndBackupBar';
import TomorrowAzanPreviewModal from './TomorrowAzanPreviewModal';
import SystemHealthWidget from './SystemHealthWidget';
import {
  AGENT_DEBUGGED_SPEC,
  LandingRoleGateway,
  ProducerSubmissionAndStatusPortal,
  CoordinationWorkflowPortal,
  QCInspectionPortal,
  ReadOnlyMonitoringPortal,
  DirectorDecisionAndMonitorPortal,
  DirectorPageMode,
  BroadcastExecutionIncident,
  PaginationControls,
} from './RoleIsolatedPortals';
import {
  Printer,
  Plus,
  Upload,
  Download,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  SkipForward,
  SlidersHorizontal,
  ShieldCheck,
  Clock,
  Monitor,
  Wrench,
  RotateCcw,
  FileCheck2,
  FolderSearch,
  SplitSquareHorizontal,
  Eye,
  Layers,
  KeyRound,
  Archive,
  Sun,
  History,
  Keyboard,
  Sliders,
  BellRing,
  CalendarClock,
  LogOut,
  X,
  Terminal,
} from 'lucide-react';

export { AGENT_DEBUGGED_SPEC };

const STORAGE_KEY = 'irib_isfahan_conductor_schedule_v2';

export type EmergencyOverrideMode =
  | 'normal'
  | 'standby_filler'
  | 'station_slate'
  | 'smpte_bars';

export default function ConductorWorkspace() {
  const [schedule, setSchedule] = useState<ConductorSchedule>(
    ATTACHED_CONDUCTOR_SCHEDULE
  );
  // 1. Landing Gateway state: authenticatedRole starts as null
  const [authenticatedRole, setAuthenticatedRole] =
    useState<AccessRoleLevel | null>(null);
  const [activeRole, setActiveRole] = useState<AccessRoleLevel>('level_1');
  const [directorPageMode, setDirectorPageMode] = useState<DirectorPageMode>(
    'DIRECTOR_DECISION_CENTER'
  );
  const [directorInspectedUnit, setDirectorInspectedUnit] =
    useState<AccessRoleLevel>('producer_editor');
  const [requirePinOnRoleSwitch, setRequirePinOnRoleSwitch] =
    useState<boolean>(false);
  const [pendingPinRole, setPendingPinRole] = useState<RoleDefinition | null>(
    null
  );

  // Read-only monitoring operator incident reports
  const [executionIncidents, setExecutionIncidents] = useState<
    BroadcastExecutionIncident[]
  >([
    {
      id: 'inc-init-1',
      itemOrder: 4,
      itemTitle: 'میان‌برنامه نمای نصف جهان و معرفی برنامه‌ها',
      mediaCode: 'IRIB-ISF-104',
      timecodeAtReport: '06:58:12',
      category: 'audio_drop',
      severity: 'warning',
      description:
        'افت ۳ دسی‌بلی تراز صدای کانال چپ در ثانیه 00:01:20 گزارش شد.',
      reportedBy: 'مهندس حسینی (اپراتور پایش پخش)',
      reportedAt: '۰۶:۵۸:۱۲',
      status: 'investigating',
      resolutionNote: 'در دست بررسی توسط مسئول پلی‌اوت جهت نرمال‌سازی EBU R128',
    },
  ]);

  const [activeTab, setActiveTab] = useState<
    'schedule' | 'workflow_inbox' | 'mcr_playout'
  >('schedule');
  const [coordinationPageMode, setCoordinationPageMode] = useState<
    'workflow_queues' | 'conductor_table'
  >('workflow_queues');
  const [schedulePage, setSchedulePage] = useState<number>(1);
  const [schedulePageSize, setSchedulePageSize] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<ProgramCategory | 'all'>(
    'all'
  );
  const [statusFilter, setStatusFilter] = useState<BroadcastStatus | 'all'>(
    'all'
  );

  // Master broadcast clockSec — deterministic on SSR, immediately synced with system clock on mount
  const [clockSec, setClockSec] = useState<number>(
    parseTimeToSeconds('07:25:10')
  );
  const studioClockSec = clockSec;
  const setStudioClockSec = setClockSec;
  const [isClockRunning, setIsClockRunning] = useState<boolean>(true);
  const [onAirRemainingReset, setOnAirRemainingReset] = useState<{
    itemId: string;
    remainingSec: number;
    startPlayheadTimeline: number;
    endTimelineSec: number;
  } | null>(null);

  // MCR Playout Preview & Emergency state
  const [previewItem, setPreviewItem] = useState<ScheduleItem | null>(null);
  const [previewTimeSec, setPreviewTimeSec] = useState<number>(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [cleanFeedFullscreen, setCleanFeedFullscreen] =
    useState<boolean>(false);
  const [emergencyMode, setEmergencyMode] =
    useState<EmergencyOverrideMode>(() => {
      try {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('irib_isfahan_emergency_mode_v1');
          if (
            saved === 'normal' ||
            saved === 'standby_filler' ||
            saved === 'station_slate' ||
            saved === 'smpte_bars'
          ) {
            return saved as EmergencyOverrideMode;
          }
        }
      } catch {
        // Fallback
      }
      return 'normal';
    });

  // Local Archive state
  const [archivedDays, setArchivedDays] = useState<ArchivedScheduleSummary[]>(
    []
  );

  // Customizable Keyboard Shortcuts state
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(getDefaultShortcuts);
  const [isPlayerShortcutsModalOpen, setIsPlayerShortcutsModalOpen] =
    useState<boolean>(false);
  const [isAllShortcutsModalOpen, setIsAllShortcutsModalOpen] =
    useState<boolean>(false);

  // Hover state for empty gaps on the 24h timeline bar
  const [hoveredGapInfo, setHoveredGapInfo] = useState<{
    gapSec: number;
    fromTime: string;
    toTime: string;
    afterTitle: string;
    beforeTitle: string;
  } | null>(null);

  // Modals & Panels
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [qcModalItem, setQcModalItem] = useState<ScheduleItem | null>(null);
  const [trimModalItem, setTrimModalItem] = useState<ScheduleItem | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [revisionTargetItem, setRevisionTargetItem] =
    useState<ScheduleItem | null>(null);
  const [certificateItem, setCertificateItem] = useState<ScheduleItem | null>(
    null
  );
  const [isHandoverModalOpen, setIsHandoverModalOpen] =
    useState<boolean>(false);
  const [isRoleCredentialsModalOpen, setIsRoleCredentialsModalOpen] =
    useState<boolean>(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState<boolean>(false);
  const [isWindowsGuideOpen, setIsWindowsGuideOpen] = useState<boolean>(false);
  const [isTomorrowAzanModalOpen, setIsTomorrowAzanModalOpen] =
    useState<boolean>(false);
  const [isCompactTable, setIsCompactTable] = useState<boolean>(false);
  const [showScheduleAuditLog, setShowScheduleAuditLog] =
    useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Load & sync customizable keyboard shortcuts from LocalStorage
  useEffect(() => {
    setShortcuts(loadSavedShortcuts());

    const handleCustomUpdate = (ev: Event) => {
      const customEv = ev as CustomEvent<ShortcutMap>;
      if (customEv.detail) {
        setShortcuts(customEv.detail);
      } else {
        setShortcuts(loadSavedShortcuts());
      }
    };

    window.addEventListener('irib-shortcuts-updated', handleCustomUpdate);
    const ch =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('irib_isfahan_shortcuts_sync')
        : null;
    if (ch) {
      ch.onmessage = (ev) => {
        if (ev.data) setShortcuts(ev.data);
      };
    }

    return () => {
      window.removeEventListener('irib-shortcuts-updated', handleCustomUpdate);
      ch?.close();
    };
  }, []);

  // Global Workspace Keyboard Shortcuts Listener

  // Escape key listener to exit Clean Feed Fullscreen overlay
  useEffect(() => {
    if (!cleanFeedFullscreen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCleanFeedFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [cleanFeedFullscreen]);

  // Sync Emergency Override Mode across tabs and antenna output page
  useEffect(() => {
    try {
      localStorage.setItem('irib_isfahan_emergency_mode_v1', emergencyMode);
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('irib_isfahan_emergency_sync');
        channel.postMessage({
          type: 'EMERGENCY_MODE_CHANGE',
          mode: emergencyMode,
        });
        channel.close();
      }
    } catch {
      // Ignore storage errors
    }
  }, [emergencyMode]);

  const currentRole = useMemo(
    () => ROLES.find((r) => r.id === activeRole) || ROLES[0],
    [activeRole]
  );

  // Helper to post immutable audit events to local server
  const recordServerAudit = (payload: {
    actionType:
      | 'UPLOAD_VERSION'
      | 'WORKFLOW_TRANSITION'
      | 'PLAYOUT_TRIM'
      | 'PLAYOUT_EXECUTE'
      | 'ROLE_AUTH'
      | 'SCHEDULE_UPDATE';
    details: string;
    item?: ScheduleItem;
    fromStage?: string;
    toStage?: string;
  }) => {
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorName: `${currentRole.personName} (${currentRole.title})`,
        itemOrder: payload.item?.order,
        mediaCode: payload.item?.mediaCode,
        itemTitle: payload.item?.title,
        versionNumber: payload.item?.revisionVersion || 1,
        fromStage: payload.fromStage,
        toStage: payload.toStage,
        actionType: payload.actionType,
        details: payload.details,
      }),
    }).catch(() => {});
  };

  // Helper to trigger hardware playout execution via local TCP/AMCP bridge
  const triggerHardwarePlayout = (
    item: ScheduleItem,
    action: 'PLAY_NOW' | 'LOADBG_QUEUE'
  ) => {
    fetch('/api/playout/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaCode: item.mediaCode,
        versionNumber: item.revisionVersion || 1,
        trimInSec: item.trimInSec || 0,
        durationSec: parseTimeToSeconds(item.duration),
        workflowStatus: item.workflowStatus || 'approved_for_playout',
        action,
      }),
    }).catch(() => {});
  };

  // Load saved schedule from localStorage / LAN API on mount & restore IndexedDB video blobs
  useEffect(() => {
    let mounted = true;
    async function initSchedule() {
      let baseSchedule = ATTACHED_CONDUCTOR_SCHEDULE;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            baseSchedule = parsed;
          }
        }
      } catch {
        // Fallback to default
      }

      try {
        const res = await fetch('/api/schedule');
        if (res.ok) {
          const lanData = await res.json();
          if (
            lanData &&
            Array.isArray(lanData.items) &&
            lanData.updatedAt > baseSchedule.updatedAt
          ) {
            baseSchedule = lanData;
          }
        }
      } catch {
        // Offline client-only fallback
      }

      const restoredItems = await Promise.all(
        baseSchedule.items.map(async (it) => {
          const hydrated = hydrateScheduleItem(it);
          const blobUrl = await loadOfflineVideoBlobUrl(
            hydrated.id,
            hydrated.revisionVersion || 1
          );
          return blobUrl ? { ...hydrated, videoUrl: blobUrl } : hydrated;
        })
      );

      if (mounted) {
        setSchedule({
          ...baseSchedule,
          title: 'کنداکتور ۲۴ ساعته پخش شبکه اصفهان',
          channel: 'شبکه اصفهان',
          items: restoredItems,
        });
        setArchivedDays(getArchivedSchedules());
      }
    }

    initSchedule();
    return () => {
      mounted = false;
    };
  }, []);

  // Multi-tab BroadcastChannel listener
  useEffect(() => {
    const channel =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('irib_isfahan_conductor_sync')
        : null;

    if (channel) {
      channel.onmessage = (ev) => {
        if (ev.data && ev.data.updatedAt !== schedule.updatedAt) {
          setSchedule(ev.data);
        }
      };
    }
    return () => channel?.close();
  }, [schedule.updatedAt]);

  // Centralized schedule updater + LAN & Multi-Tab broadcaster
  const updateScheduleAndSync = (nextSchedule: ConductorSchedule) => {
    setSchedule(nextSchedule);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSchedule));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('irib_isfahan_conductor_sync');
        ch.postMessage(nextSchedule);
        ch.close();
      }
      fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSchedule),
      }).catch(() => {});
    } catch {
      // Ignore storage quota errors
    }
  };

  // Helper to stamp Conductor Authoring (Created By) & Editing (Last Edited By) metadata
  const stampScheduleModification = (
    baseSched: ConductorSchedule,
    actionType: ScheduleRevisionEntry['actionType'],
    summary: string,
    markAsPrimaryAuthor = false
  ): ConductorSchedule => {
    const actorFullTitle = `${currentRole.personName} (${currentRole.title})`;
    const nowTimeStr = formatSecondsToTime(Math.floor(studioClockSec));
    const dateTimeStamp = `${baseSched.dateShamsi} - ${nowTimeStr}`;
    const entry: ScheduleRevisionEntry = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowTimeStr,
      actorName: actorFullTitle,
      actorRole: activeRole,
      actionType,
      summary,
    };

    return {
      ...baseSched,
      plannerName: markAsPrimaryAuthor
        ? currentRole.personName
        : baseSched.plannerName || 'خانم مرادی',
      createdBy: markAsPrimaryAuthor
        ? actorFullTitle
        : baseSched.createdBy || 'خانم مرادی (واحد هماهنگی)',
      createdByRole: markAsPrimaryAuthor
        ? activeRole
        : baseSched.createdByRole || 'level_2',
      createdAt: markAsPrimaryAuthor
        ? dateTimeStamp
        : baseSched.createdAt || `${baseSched.dateShamsi} - 05:30`,
      lastEditedBy: actorFullTitle,
      lastEditedByRole: activeRole,
      lastEditedAt: dateTimeStamp,
      lastEditSummary: summary,
      scheduleEditHistory: [
        entry,
        ...(baseSched.scheduleEditHistory || []),
      ].slice(0, 40),
      updatedAt: new Date().toISOString(),
    };
  };

  // Live studio clock — always synchronized with the system clock
  useEffect(() => {
    const syncToSystemTime = () => {
      const now = new Date();
      const sec =
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      setClockSec(sec);
    };
    syncToSystemTime();
    const timer = setInterval(syncToSystemTime, 250);
    return () => clearInterval(timer);
  }, []);

  // Offline Isfahan Horizon Prayer Times & Next Azan Readiness Status
  const isfahanAzanTimes = useMemo(
    () => calculateIsfahanPrayerTimes(schedule.dateGregorian || '2026-10-04'),
    [schedule.dateGregorian]
  );

  const nextAzanStatus = useMemo(
    () =>
      getNextIsfahanAzanStatus(
        studioClockSec,
        schedule.dateGregorian || '2026-10-04'
      ),
    [studioClockSec, schedule.dateGregorian]
  );

  // Detect time overlaps, antenna gaps, and rejected items
  const anomalies = useMemo(
    () => detectScheduleAnomalies(schedule),
    [schedule]
  );

  const itemAnomalyMap = useMemo(() => {
    const map = new Map<string, typeof anomalies>();
    for (const anomaly of anomalies) {
      const existing = map.get(anomaly.itemId) || [];
      existing.push(anomaly);
      map.set(anomaly.itemId, existing);
    }
    return map;
  }, [anomalies]);

  // Calculate aggregate gap ('dark' time) and overlap seconds across the entire schedule
  const anomalyAggregateMetrics = useMemo(() => {
    const dayStart = schedule.startTime || '06:00:00';
    let totalGapSec = 0;
    let totalOverlapSec = 0;
    let gapCount = 0;
    let overlapCount = 0;
    const gapsByAfterItemId = new Map<
      string,
      {
        gapSec: number;
        fromTime: string;
        toTime: string;
        afterTitle: string;
        beforeTitle: string;
      }
    >();

    for (let i = 0; i < schedule.items.length - 1; i++) {
      const curr = schedule.items[i];
      const next = schedule.items[i + 1];
      const currEnd =
        toBroadcastTimelineSeconds(curr.startTime, dayStart) +
        parseTimeToSeconds(curr.duration);
      const nextStart = toBroadcastTimelineSeconds(next.startTime, dayStart);
      const diff = nextStart - currEnd;

      if (diff > 1) {
        totalGapSec += diff;
        gapCount++;
        gapsByAfterItemId.set(curr.id, {
          gapSec: diff,
          fromTime: curr.endTime,
          toTime: next.startTime,
          afterTitle: curr.title,
          beforeTitle: next.title,
        });
      } else if (diff < -1) {
        totalOverlapSec += Math.abs(diff);
        overlapCount++;
      }
    }

    return {
      totalGapSec,
      totalOverlapSec,
      gapCount,
      overlapCount,
      gapsByAfterItemId,
    };
  }, [schedule]);

  // Calculate aggregate broadcast statistics
  const stats = useMemo(() => {
    let totalDurationSec = 0;
    let liveSec = 0;
    let adSec = 0;
    let readyOrOnAirCount = 0;
    let lockedCount = 0;

    for (const item of schedule.items) {
      const d = parseTimeToSeconds(item.duration);
      totalDurationSec += d;
      if (item.category === 'live' || item.category === 'news') {
        liveSec += d;
      }
      if (item.category === 'ad') {
        adSec += d;
      }
      if (isItemApprovedForPlayout(item)) {
        readyOrOnAirCount++;
      }
      if (item.lockStartTime) {
        lockedCount++;
      }
    }

    const targetSec = (schedule.targetDurationHours || 24) * 3600;
    const remainingVoidSec = Math.max(0, targetSec - totalDurationSec);

    return {
      totalDurationSec,
      targetSec,
      remainingVoidSec,
      liveSec,
      adSec,
      readyOrOnAirCount,
      lockedCount,
      totalItems: schedule.items.length,
    };
  }, [schedule]);

  // Helper to compute non-stale effective duration in seconds for any schedule item
  const getEffectiveItemDurationSec = (item: ScheduleItem): number => {
    const parsedDur = parseTimeToSeconds(item.duration);
    if (parsedDur > 0) return parsedDur;
    if (
      typeof item.trimOutSec === 'number' &&
      typeof item.trimInSec === 'number' &&
      item.trimOutSec > item.trimInSec
    ) {
      return item.trimOutSec - item.trimInSec;
    }
    if (
      typeof item.sourceDurationSec === 'number' &&
      item.sourceDurationSec > 0
    ) {
      return item.sourceDurationSec;
    }
    return 900;
  };

  // Determine currently playing item and remainingSec based on master clockSec
  const activePlayoutState = useMemo(() => {
    const dayStart = schedule.startTime || '06:00:00';
    const playheadTimeline = toBroadcastTimelineSeconds(
      formatSecondsToTime(Math.floor(clockSec)),
      dayStart
    );

    let currentIndex = -1;

    // 0. If an item was explicitly triggered on_air with an active remaining reset window, keep it active
    if (
      onAirRemainingReset &&
      playheadTimeline >= onAirRemainingReset.startPlayheadTimeline &&
      playheadTimeline <= onAirRemainingReset.endTimelineSec
    ) {
      const resetIdx = schedule.items.findIndex(
        (it) => it.id === onAirRemainingReset.itemId && it.status === 'on_air'
      );
      if (resetIdx >= 0) {
        currentIndex = resetIdx;
      }
    }

    // 1. Next priority: an explicitly 'on_air' item covering playheadTimeline
    if (currentIndex === -1) {
      for (let i = 0; i < schedule.items.length; i++) {
        const item = schedule.items[i];
        if (item.status !== 'on_air') continue;
        const startT = toBroadcastTimelineSeconds(item.startTime, dayStart);
        const endT = startT + getEffectiveItemDurationSec(item);
        if (playheadTimeline >= startT && playheadTimeline < endT) {
          currentIndex = i;
          break;
        }
      }
    }

    // 2. Second priority: any scheduled item covering playheadTimeline
    if (currentIndex === -1) {
      for (let i = 0; i < schedule.items.length; i++) {
        const item = schedule.items[i];
        const startT = toBroadcastTimelineSeconds(item.startTime, dayStart);
        const endT = startT + getEffectiveItemDurationSec(item);
        if (playheadTimeline >= startT && playheadTimeline < endT) {
          currentIndex = i;
          break;
        }
      }
    }

    // 3. Fallback to any item marked 'on_air' or first item
    if (currentIndex === -1 && schedule.items.length > 0) {
      const onAirIdx = schedule.items.findIndex((it) => it.status === 'on_air');
      currentIndex = onAirIdx >= 0 ? onAirIdx : 0;
    }

    const currentItem =
      currentIndex >= 0 ? schedule.items[currentIndex] : undefined;
    const nextItem =
      currentIndex >= 0 && currentIndex + 1 < schedule.items.length
        ? schedule.items[currentIndex + 1]
        : undefined;

    let remainingSec = 0;
    let progressPercent = 0;
    if (currentItem) {
      const startT = toBroadcastTimelineSeconds(
        currentItem.startTime,
        dayStart
      );
      const dur = Math.max(1, getEffectiveItemDurationSec(currentItem));
      const rawEndT = toBroadcastTimelineSeconds(
        currentItem.endTime ||
          computeEndTime(currentItem.startTime, currentItem.duration),
        dayStart
      );
      const endT = rawEndT > startT ? rawEndT : startT + dur;

      if (
        onAirRemainingReset &&
        onAirRemainingReset.itemId === currentItem.id &&
        playheadTimeline >= onAirRemainingReset.startPlayheadTimeline &&
        playheadTimeline <= onAirRemainingReset.endTimelineSec
      ) {
        const deltaSinceReset = Math.max(
          0,
          playheadTimeline - onAirRemainingReset.startPlayheadTimeline
        );
        remainingSec = Math.max(
          0,
          onAirRemainingReset.remainingSec - deltaSinceReset
        );
      } else {
        const clampedCurrent = Math.max(
          startT,
          Math.min(endT, playheadTimeline)
        );
        remainingSec = Math.max(0, endT - clampedCurrent);
      }

      const elapsed = Math.max(0, Math.min(dur, dur - remainingSec));
      progressPercent = Math.min(100, Math.round((elapsed / dur) * 100));
    }

    return {
      currentItem,
      nextItem,
      remainingSec,
      progressPercent,
    };
  }, [schedule, clockSec, onAirRemainingReset]);

  // Resolve live preview item from schedule.items to prevent stale duration in PVW player
  const resolvedPreviewItem = useMemo(() => {
    if (previewItem) {
      const liveMatch = schedule.items.find((it) => it.id === previewItem.id);
      if (liveMatch) return liveMatch;
    }
    return activePlayoutState.nextItem || schedule.items[0] || null;
  }, [previewItem, schedule.items, activePlayoutState.nextItem]);

  const resolvedPreviewItemId = resolvedPreviewItem?.id;
  const resolvedPreviewTrimIn = resolvedPreviewItem?.trimInSec || 0;
  useEffect(() => {
    if (!resolvedPreviewItemId) return;
    setPreviewTimeSec(resolvedPreviewTrimIn);
    setIsPreviewPlaying(false);
  }, [resolvedPreviewItemId, resolvedPreviewTrimIn]);

  // Filtered items for table view
  const filteredItems = useMemo(() => {
    return schedule.items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchCode = item.mediaCode.toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        const matchEpisode = (item.episode || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchNotes && !matchEpisode) {
          return false;
        }
      }
      return true;
    });
  }, [schedule.items, categoryFilter, statusFilter, searchQuery]);

  const paginatedScheduleItems = useMemo(() => {
    const safePage = Math.min(
      schedulePage,
      Math.max(1, Math.ceil(filteredItems.length / schedulePageSize))
    );
    const start = (safePage - 1) * schedulePageSize;
    return filteredItems.slice(start, start + schedulePageSize);
  }, [filteredItems, schedulePage, schedulePageSize]);

  // Handlers
  const handleOpenAddModal = (afterOrder?: number) => {
    if (!currentRole.canEditSchedule) {
      showToast('سطح دسترسی فعلی مجوز افزودن آیتم به کنداکتور را ندارد.');
      return;
    }
    const items = schedule.items;
    const insertIndex = afterOrder !== undefined ? afterOrder : items.length;
    const prevItem = insertIndex > 0 ? items[insertIndex - 1] : null;
    const startTime = prevItem
      ? prevItem.endTime
      : schedule.startTime || '06:00:00';
    const duration = '00:15:00';

    const newItem: ScheduleItem = {
      id: `item-${Date.now()}`,
      order: insertIndex + 1,
      title: '',
      episode: '',
      startTime,
      duration,
      endTime: computeEndTime(startTime, duration),
      category: 'production',
      source: 'server1',
      mediaCode: `IRIB-ISF-${100 + items.length + 1}`,
      status: 'ready',
      workflowStatus: 'approved_for_playout',
      revisionVersion: 1,
      sourceDurationSec: 900,
      trimInSec: 0,
      trimOutSec: 900,
      lockStartTime: false,
      notes: '',
      aspectRatio: '16:9 HD',
      audioTrack: 'stereo',
      createdBy: `${currentRole.personName} (${currentRole.title})`,
      createdByRole: activeRole,
    };

    setIsAddingNew(true);
    setEditingItem(newItem);
  };

  const handleSaveItem = (updatedItem: ScheduleItem, autoCascade: boolean) => {
    const actorFullTitle = `${currentRole.personName} (${currentRole.title})`;
    const nowTimeStr = formatSecondsToTime(Math.floor(studioClockSec));
    const stampedItem: ScheduleItem = isAddingNew
      ? {
          ...updatedItem,
          createdBy: updatedItem.createdBy || actorFullTitle,
          createdByRole: updatedItem.createdByRole || activeRole,
          lastEditedBy: actorFullTitle,
          lastEditedByRole: activeRole,
          lastEditedAt: nowTimeStr,
        }
      : {
          ...updatedItem,
          createdBy:
            updatedItem.createdBy || 'خانم مرادی (واحد هماهنگی)',
          lastEditedBy: actorFullTitle,
          lastEditedByRole: activeRole,
          lastEditedAt: nowTimeStr,
        };

    let nextItems: ScheduleItem[];
    if (isAddingNew) {
      const insertAt = Math.max(
        0,
        Math.min(schedule.items.length, stampedItem.order - 1)
      );
      nextItems = [
        ...schedule.items.slice(0, insertAt),
        stampedItem,
        ...schedule.items.slice(insertAt),
      ];
    } else {
      nextItems = schedule.items.map((it) =>
        it.id === stampedItem.id ? stampedItem : it
      );
    }

    if (autoCascade) {
      nextItems = recalculateScheduleItems(
        nextItems,
        schedule.startTime,
        true
      );
    } else {
      nextItems = nextItems.map((it, idx) => ({ ...it, order: idx + 1 }));
    }

    const actionDesc = isAddingNew
      ? `افزودن ردیف جدید «${stampedItem.title}» (ساعت ${stampedItem.startTime}) به کنداکتور`
      : `ویرایش ردیف ${stampedItem.order} «${stampedItem.title}» (${stampedItem.startTime} - مدت ${stampedItem.duration})`;

    updateScheduleAndSync(
      stampScheduleModification(
        {
          ...schedule,
          items: nextItems,
        },
        isAddingNew ? 'ITEM_ADDED' : 'EDITED',
        actionDesc
      )
    );
    recordServerAudit({
      actionType: 'SCHEDULE_UPDATE',
      item: stampedItem,
      details: `${actionDesc} توسط ${actorFullTitle}`,
    });
    setEditingItem(null);
    setIsAddingNew(false);
    showToast(
      isAddingNew
        ? `آیتم جدید توسط «${actorFullTitle}» نوشته و به کنداکتور اضافه شد.`
        : `ویرایش ردیف ${stampedItem.order} به نام «${actorFullTitle}» ثبت و جدول بروزرسانی شد.`
    );
  };

  // Save QC Markers & Transition Workflow Stage (preserving version snapshot)
  const handleSaveMarkersAndStage = (
    itemId: string,
    markers: QCMarker[],
    nextStage: WorkflowStage,
    comment?: string
  ) => {
    const targetItem = schedule.items.find((i) => i.id === itemId);
    const nextItems = schedule.items.map((it) => {
      if (it.id !== itemId) return it;
      const prevStage = it.workflowStatus || 'approved_for_playout';
      const nextBroadcastStatus = mapWorkflowToBroadcastStatus(nextStage);
      const activeVersion = it.revisionVersion || 1;

      const logEntry: WorkflowLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        fromStage: prevStage,
        toStage: nextStage,
        actorRole: activeRole,
        actorName: `${currentRole.personName} (${currentRole.title})`,
        versionNumber: activeVersion,
        comment,
      };

      const updatedVersions = (it.versions || []).map((v) =>
        v.versionNumber === activeVersion
          ? {
              ...v,
              qcDecision:
                nextStage === 'qc_approved' ||
                nextStage === 'approved_by_director' ||
                nextStage === 'approved_for_playout'
                  ? ('approved' as const)
                  : nextStage === 'qc_needs_revision' ||
                    nextStage === 'rejected_by_director' ||
                    nextStage === 'returned_to_producer'
                  ? ('needs_revision' as const)
                  : nextStage === 'referred_to_director'
                  ? ('referred_to_director' as const)
                  : v.qcDecision,
              qcMarkersSnapshot: markers,
            }
          : v
      );

      return {
        ...it,
        qcMarkers: markers,
        versions: updatedVersions,
        workflowStatus: nextStage,
        status: nextBroadcastStatus,
        workflowHistory: [logEntry, ...(it.workflowHistory || [])],
      };
    });

    updateScheduleAndSync({
      ...schedule,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    });
    if (targetItem) {
      recordServerAudit({
        actionType: 'WORKFLOW_TRANSITION',
        item: targetItem,
        fromStage: targetItem.workflowStatus,
        toStage: nextStage,
        details:
          comment ||
          `تغییر وضعیت پرونده به «${WORKFLOW_STAGE_META[nextStage].label}»`,
      });
    }
    setQcModalItem(null);
    showToast(
      `وضعیت پرونده به «${WORKFLOW_STAGE_META[nextStage].label}» تغییر یافت.`
    );
  };

  // Apply Non-Destructive Playout Trim & Cascade Schedule
  const handleApplyPlayoutTrim = (
    itemId: string,
    trimInSec: number,
    trimOutSec: number,
    sourceDurationSec: number,
    playImmediately = false
  ) => {
    if (!currentRole.canTrimPlayout) {
      showToast(
        'تنظیم محدوده زمانی پخش (Mark In / Out) فقط برای مسئول مدیریت پلی‌اوت و مدیر پخش مجاز است.'
      );
      return;
    }

    const targetItem = schedule.items.find((i) => i.id === itemId);
    if (playImmediately && targetItem && !isItemApprovedForPlayout(targetItem)) {
      showToast(
        'خطای ایمنی پخش: اجرای پخش تنها برای فایل‌هایی مجاز است که مراحل تأیید نهایی شبکه را گذرانده و به صف پلی‌اوت ارسال شده باشند!'
      );
      return;
    }

    const netSec = Math.max(1, trimOutSec - trimInSec);
    const netDurationStr = formatDurationTotal(netSec);

    const updated = schedule.items.map((it) =>
      it.id === itemId
        ? {
            ...it,
            sourceDurationSec,
            trimInSec,
            trimOutSec,
            duration: netDurationStr,
            workflowStatus: playImmediately
              ? ('on_air' as WorkflowStage)
              : it.workflowStatus,
            status: playImmediately ? ('on_air' as BroadcastStatus) : it.status,
          }
        : it
    );

    const recalculated = recalculateScheduleItems(
      updated,
      schedule.startTime,
      true
    );

    const target = recalculated.find((i) => i.id === itemId);
    if (target) {
      appendAsRunLog(
        target,
        formatSecondsToTime(studioClockSec),
        currentRole.personName,
        playImmediately ? 'MANUAL_TAKE' : 'TRIM_UPDATED',
        `Trim In: ${formatDurationTotal(trimInSec)} | Out: ${formatDurationTotal(trimOutSec)} (v${target.revisionVersion || 1})`
      );
      recordServerAudit({
        actionType: playImmediately ? 'PLAYOUT_EXECUTE' : 'PLAYOUT_TRIM',
        item: target,
        details: `تنظیم بازه زمانی استفاده (${formatDurationTotal(
          trimInSec
        )} تا ${formatDurationTotal(trimOutSec)})`,
      });
      if (playImmediately) {
        triggerHardwarePlayout(target, 'PLAY_NOW');
      }
    }

    updateScheduleAndSync({
      ...schedule,
      items: recalculated,
      updatedAt: new Date().toISOString(),
    });
    setTrimModalItem(null);
    showToast(
      `محدوده زمانی پخش (${formatDurationTotal(trimInSec)} تا ${formatDurationTotal(
        trimOutSec
      )}) ثبت و پلی‌لیست کنداکتور بازشماری شد.`
    );
  };

  // Producer Upload / Revision Delivery (with versioned IndexedDB persistence)
  const handleProducerDelivery = async (
    deliveredItem: ScheduleItem,
    isRevision: boolean,
    rawFile?: File | null
  ) => {
    let finalVideoUrl = deliveredItem.videoUrl;
    if (rawFile) {
      try {
        finalVideoUrl = await saveOfflineVideoBlob(
          deliveredItem.id,
          rawFile,
          deliveredItem.revisionVersion || 1
        );
      } catch {
        // Fallback to session object URL
      }
    }

    const enrichedItem: ScheduleItem = {
      ...deliveredItem,
      videoUrl: finalVideoUrl,
    };

    let nextItems: ScheduleItem[];
    if (isRevision) {
      nextItems = schedule.items.map((it) =>
        it.id === enrichedItem.id ? enrichedItem : it
      );
    } else {
      nextItems = [...schedule.items, enrichedItem];
    }

    const recalculated = recalculateScheduleItems(
      nextItems,
      schedule.startTime,
      true
    );

    updateScheduleAndSync({
      ...schedule,
      items: recalculated,
      updatedAt: new Date().toISOString(),
    });
    recordServerAudit({
      actionType: 'UPLOAD_VERSION',
      item: enrichedItem,
      toStage: 'uploaded_by_producer',
      details: isRevision
        ? `بارگذاری نسخه اصلاح‌شده v${enrichedItem.revisionVersion} توسط تهیه‌کننده/تدوینگر`
        : `بارگذاری اولیه نسخه v1 برنامه «${enrichedItem.title}»`,
    });
    setUploadModalOpen(false);
    setRevisionTargetItem(null);
    showToast(
      isRevision
        ? `نسخه جدید (v${enrichedItem.revisionVersion}) برنامه «${enrichedItem.title}» با حفظ سوابق نسخه قبلی تحویل هماهنگی شد.`
        : `برنامه جدید «${enrichedItem.title}» (نسخه v1) بارگذاری و به کارتابل هماهنگی ارسال شد.`
    );
  };

  // Split Program for Mid-Roll Ad Break
  const handleSplitProgramAtTimestamp = (
    itemId: string,
    splitPointSec: number,
    insertAdDurationSec = 180
  ) => {
    if (!currentRole.canEditSchedule && !currentRole.canTrimPlayout) {
      showToast('این عملیات در حالت پایش صرف مجاز نیست.');
      return;
    }

    const idx = schedule.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const orig = schedule.items[idx];
    const srcDur = orig.sourceDurationSec || parseTimeToSeconds(orig.duration);
    const inPoint = orig.trimInSec ?? 0;
    const outPoint = orig.trimOutSec ?? srcDur;

    if (splitPointSec <= inPoint + 10 || splitPointSec >= outPoint - 10) {
      showToast(
        'نقطه برش میان‌برنامه باید حداقل ۱۰ ثانیه از ابتدا و انتهای برنامه فاصله داشته باشد.'
      );
      return;
    }

    const part1DurSec = splitPointSec - inPoint;
    const part2DurSec = outPoint - splitPointSec;

    const part1: ScheduleItem = {
      ...orig,
      title: `${orig.title.replace(/ \(بخش .*\)/, '')} (بخش اول)`,
      trimInSec: inPoint,
      trimOutSec: splitPointSec,
      duration: formatDurationTotal(part1DurSec),
      notes: `${orig.notes || ''} — پخش تا ثانیه ${formatDurationTotal(splitPointSec)}`.trim(),
    };

    const adBreak: ScheduleItem = {
      id: `item-ad-${Date.now()}`,
      order: orig.order + 1,
      title: `باکس پیام بازرگانی میان‌برنامه (${orig.title})`,
      episode: 'آگهی میان‌برنامه',
      startTime: orig.startTime,
      duration: formatDurationTotal(insertAdDurationSec),
      endTime: orig.endTime,
      category: 'ad',
      source: 'server2',
      mediaCode: `AD-MID-${100 + idx}`,
      status: 'ready',
      workflowStatus: 'approved_for_playout',
      revisionVersion: 1,
      sourceDurationSec: insertAdDurationSec,
      trimInSec: 0,
      trimOutSec: insertAdDurationSec,
      lockStartTime: false,
      notes: 'درج خودکار بین دو بخش برنامه',
      aspectRatio: '16:9 HD',
      audioTrack: 'stereo',
    };

    const part2: ScheduleItem = {
      ...orig,
      id: `${orig.id}-part2-${Date.now()}`,
      order: orig.order + 2,
      title: `${orig.title.replace(/ \(بخش .*\)/, '')} (بخش دوم)`,
      trimInSec: splitPointSec,
      trimOutSec: outPoint,
      duration: formatDurationTotal(part2DurSec),
      lockStartTime: false,
      notes: `ادامه برنامه از تایم‌کد ${formatDurationTotal(splitPointSec)} تا ${formatDurationTotal(outPoint)}`,
    };

    const nextItems = [
      ...schedule.items.slice(0, idx),
      part1,
      adBreak,
      part2,
      ...schedule.items.slice(idx + 1),
    ];

    const recalculated = recalculateScheduleItems(
      nextItems,
      schedule.startTime,
      true
    );

    updateScheduleAndSync({
      ...schedule,
      items: recalculated,
      updatedAt: new Date().toISOString(),
    });
    setTrimModalItem(null);
    showToast(
      `برنامه «${orig.title}» در تایم‌کد ${formatDurationTotal(splitPointSec)} به ۲ بخش تقسیم شد و باکس آگهی بازرگانی درج گردید.`
    );
  };

  const handleSplitProgramForAd = (item: ScheduleItem) => {
    if (!currentRole.canEditSchedule && !currentRole.canTrimPlayout) {
      showToast(
        'تقسیم برنامه نیازمند دسترسی واحد هماهنگی، مدیریت پلی‌اوت یا مدیر پخش است.'
      );
      return;
    }
    const totalSrc =
      item.sourceDurationSec || parseTimeToSeconds(item.duration);
    const startTrim = item.trimInSec ?? 0;
    const endTrim = item.trimOutSec ?? totalSrc;
    const midpoint = Math.floor((startTrim + endTrim) / 2);

    if (endTrim - startTrim < 120) {
      showToast('مدت زمان برنامه برای تقسیم به دو بخش کوتاه است.');
      return;
    }

    handleSplitProgramAtTimestamp(item.id, midpoint, 180);
  };

  // Export CasparCG / EDL Playout Scripts
  const handleExportCasparScript = () => {
    const script = generateCasparCGCommands(schedule);
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CasparCG-Playout-${schedule.dateShamsi.replace(/\//g, '-')}.amcp.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('اسکریپت فرمان‌های پلی‌اوت CasparCG با نقاط Trim دانلود شد.');
  };

  const handleExportEDL = () => {
    const edl = generateCMX3600EDL(schedule);
    const blob = new Blob([edl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Isfahan-Timeline-${schedule.dateShamsi.replace(/\//g, '-')}.edl`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      'فایل تایم‌لاین EDL (شامل نقاط تریم و مارکرهای بازبینی) دانلود شد.'
    );
  };

  const handleDeleteItem = (id: string) => {
    if (!currentRole.canDeleteItems) return;
    const target = schedule.items.find((i) => i.id === id);
    if (target?.lockStartTime && !currentRole.canLockTimes) {
      showToast('حذف باکس قفل‌شده فقط با مجوز مدیر پخش امکان‌پذیر است.');
      return;
    }
    const filtered = schedule.items.filter((i) => i.id !== id);
    const recalculated = recalculateScheduleItems(
      filtered,
      schedule.startTime,
      true
    );
    updateScheduleAndSync(
      stampScheduleModification(
        {
          ...schedule,
          items: recalculated,
        },
        'ITEM_DELETED',
        `حذف ردیف ${target?.order || ''} («${target?.title || ''}») و بازشماری کنداکتور`
      )
    );
    showToast(
      `آیتم انتخاب‌شده توسط «${currentRole.personName} (${currentRole.title})» حذف و کنداکتور بازشماری شد.`
    );
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (!currentRole.canEditSchedule && !currentRole.canTrimPlayout) {
      showToast(
        'تغییر ترتیب پلی‌لیست فقط برای مسئول مدیریت پلی‌اوت، هماهنگی و مدیر پخش مجاز است.'
      );
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= schedule.items.length) return;

    const actorFullTitle = `${currentRole.personName} (${currentRole.title})`;
    const nowTimeStr = formatSecondsToTime(Math.floor(studioClockSec));
    const copy = [...schedule.items];
    const [moved] = copy.splice(index, 1);
    const stampedMoved: ScheduleItem = {
      ...moved,
      lastEditedBy: actorFullTitle,
      lastEditedByRole: activeRole,
      lastEditedAt: nowTimeStr,
    };
    copy.splice(targetIndex, 0, stampedMoved);

    const recalculated = recalculateScheduleItems(
      copy,
      schedule.startTime,
      true
    );
    updateScheduleAndSync(
      stampScheduleModification(
        {
          ...schedule,
          items: recalculated,
        },
        'REORDERED',
        `جابجایی چیدمان ردیف ${index + 1} («${moved.title}») به ردیف ${targetIndex + 1}`
      )
    );
    showToast(
      `چیدمان ردیف ${index + 1} توسط «${actorFullTitle}» جابجا و زمان‌بندی بروزرسانی شد.`
    );
  };

  const handleToggleLock = (id: string) => {
    if (!currentRole.canLockTimes) {
      showToast(
        'قفل یا باز کردن باکس رأس ساعت ویژه واحد هماهنگی و مدیر پخش است.'
      );
      return;
    }
    const actorFullTitle = `${currentRole.personName} (${currentRole.title})`;
    const nowTimeStr = formatSecondsToTime(Math.floor(studioClockSec));
    const target = schedule.items.find((i) => i.id === id);
    const nextItems = schedule.items.map((it) =>
      it.id === id
        ? {
            ...it,
            lockStartTime: !it.lockStartTime,
            lastEditedBy: actorFullTitle,
            lastEditedByRole: activeRole,
            lastEditedAt: nowTimeStr,
          }
        : it
    );
    updateScheduleAndSync(
      stampScheduleModification(
        {
          ...schedule,
          items: nextItems,
        },
        'EDITED',
        `${target?.lockStartTime ? 'باز کردن قفل' : 'قفل کردن رأس ساعت'} ردیف ${target?.order || ''} («${target?.title || ''}»)`
      )
    );
  };

  const handleChangeStatus = (
    id: string,
    nextStatus: BroadcastStatus,
    explicitRemainingSec?: number
  ) => {
    if (!currentRole.canChangePlayoutStatus && !currentRole.canApproveReject) {
      showToast(
        'این نقش در حالت پایش یا بدون مجوز تغییر وضعیت پخش قرار دارد.'
      );
      return;
    }
    const target = schedule.items.find((i) => i.id === id);
    if (!target) return;

    if (nextStatus === 'on_air' && !isItemApprovedForPlayout(target)) {
      showToast(
        `جلوگیری از پخش غیرمجاز: پرونده «${target.title}» هنوز تأیید نهایی نشده و در مرحله «${
          WORKFLOW_STAGE_META[target.workflowStatus || 'uploaded_by_producer']
            .shortLabel
        }» قرار دارد!`
      );
      return;
    }

    const effectiveDurSec = Math.max(1, getEffectiveItemDurationSec(target));
    const normalizedDuration = formatDurationTotal(effectiveDurSec);
    const normalizedTrimIn = target.trimInSec ?? 0;
    const normalizedTrimOut = normalizedTrimIn + effectiveDurSec;
    const normalizedSourceDur = Math.max(
      target.sourceDurationSec || 0,
      normalizedTrimOut,
      effectiveDurSec
    );
    const programEndTime = computeEndTime(target.startTime, normalizedDuration);

    const nextItems = schedule.items.map((it) => {
      if (it.id === id) {
        return {
          ...it,
          status: nextStatus,
          workflowStatus:
            nextStatus === 'on_air'
              ? ('on_air' as WorkflowStage)
              : nextStatus === 'aired'
              ? ('aired' as WorkflowStage)
              : it.workflowStatus,
          duration: normalizedDuration,
          endTime: programEndTime,
          trimInSec: normalizedTrimIn,
          trimOutSec: normalizedTrimOut,
          sourceDurationSec: normalizedSourceDur,
        };
      }
      if (nextStatus === 'on_air' && it.status === 'on_air') {
        const demotedStatus: BroadcastStatus =
          it.order < target.order ? 'aired' : 'ready';
        return {
          ...it,
          status: demotedStatus,
          workflowStatus:
            demotedStatus === 'aired'
              ? ('aired' as WorkflowStage)
              : ('approved_for_playout' as WorkflowStage),
        };
      }
      return it;
    });

    if (nextStatus === 'on_air') {
      const dayStart = schedule.startTime || '06:00:00';
      const item = {
        ...target,
        duration: normalizedDuration,
        trimInSec: normalizedTrimIn,
      };
      const start = toBroadcastTimelineSeconds(item.startTime, dayStart);
      const playableSpan = Math.max(
        1,
        parseTimeToSeconds(item.duration) - item.trimInSec
      );
      const rawCurrent = toBroadcastTimelineSeconds(
        formatSecondsToTime(Math.floor(clockSec)),
        dayStart
      );
      const currentTime =
        rawCurrent >= start && rawCurrent < start + playableSpan
          ? rawCurrent
          : start;

      const calculatedRemaining =
        parseTimeToSeconds(item.duration) -
        item.trimInSec -
        (currentTime - start);
      const remainingSec =
        typeof explicitRemainingSec === 'number' && explicitRemainingSec > 0
          ? explicitRemainingSec
          : Math.max(0, calculatedRemaining);
      const endTimelineSec =
        rawCurrent + Math.max(playableSpan, remainingSec);

      setIsClockRunning(true);
      setOnAirRemainingReset({
        itemId: id,
        remainingSec,
        startPlayheadTimeline: rawCurrent,
        endTimelineSec,
      });

      appendAsRunLog(
        target,
        target.startTime,
        currentRole.personName,
        'MANUAL_TAKE',
        `اجرای پخش روی آنتن (نسخه معتبر v${target.revisionVersion || 1})`
      );
      triggerHardwarePlayout(target, 'PLAY_NOW');
      recordServerAudit({
        actionType: 'PLAYOUT_EXECUTE',
        item: target,
        details: `اجرای پخش روی آنتن (نسخه معتبر v${target.revisionVersion || 1})`,
      });
    } else if (onAirRemainingReset?.itemId === id) {
      setOnAirRemainingReset(null);
    }

    updateScheduleAndSync({
      ...schedule,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    });
    showToast(`وضعیت آیتم به «${STATUS_META[nextStatus].label}» تغییر یافت.`);
  };

  const handleAutoResolveAllAnomalies = () => {
    if (!currentRole.canEditSchedule && !currentRole.canApproveReject) {
      showToast('رفع خودکار تداخل‌ها نیازمند دسترسی مدیر پخش یا هماهنگی است.');
      return;
    }

    const dayStart = schedule.startTime || '06:00:00';
    const updatedItems: ScheduleItem[] = [];
    let cursorSec = parseTimeToSeconds(dayStart);

    for (let i = 0; i < schedule.items.length; i++) {
      const current = { ...schedule.items[i] };
      if (current.status === 'rejected' && currentRole.canDirectorOverride) {
        current.status = 'ready';
        current.workflowStatus = 'approved_for_playout';
      }

      const durSec = parseTimeToSeconds(current.duration);
      const next = i < schedule.items.length - 1 ? schedule.items[i + 1] : null;

      if (next && next.lockStartTime) {
        const lockedNextStart = toBroadcastTimelineSeconds(
          next.startTime,
          dayStart
        );
        const currentTimelineStart = toBroadcastTimelineSeconds(
          formatSecondsToTime(cursorSec),
          dayStart
        );
        const availableSec = lockedNextStart - currentTimelineStart;

        if (availableSec > 0 && availableSec !== durSec) {
          current.startTime = formatSecondsToTime(cursorSec);
          current.duration = formatDurationTotal(availableSec);
          current.endTime = formatSecondsToTime(cursorSec + availableSec);
          cursorSec += availableSec;
          updatedItems.push(current);
          continue;
        }
      }

      if (current.lockStartTime && i > 0) {
        cursorSec = parseTimeToSeconds(current.startTime);
      }

      current.startTime = formatSecondsToTime(cursorSec);
      current.endTime = formatSecondsToTime(cursorSec + durSec);
      cursorSec += durSec;
      updatedItems.push(current);
    }

    const normalized = updatedItems.map((it, idx) => ({
      ...it,
      order: idx + 1,
    }));

    updateScheduleAndSync(
      stampScheduleModification(
        {
          ...schedule,
          items: normalized,
        },
        'RECALCULATED',
        'تراز خودکار زمان‌بندی و رفع کلیه تداخل‌ها و خلاءهای آنتن'
      )
    );
    showToast(
      `کلیه تداخل‌های زمانی و خلاءهای آنتن توسط «${currentRole.personName} (${currentRole.title})» تراز و رفع شدند.`
    );
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isPlayerShortcutsModalOpen || isAllShortcutsModalOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const pressed = eventToShortcutString(e);
      if (!pressed) return;

      if (pressed === shortcuts.nav_tab_dashboard) {
        e.preventDefault();
        if (activeRole === 'level_1') {
          setDirectorPageMode('DIRECTOR_DECISION_CENTER');
        } else if (activeRole === 'level_2') {
          setCoordinationPageMode('workflow_queues');
        }
        setActiveTab('schedule');
      } else if (pressed === shortcuts.nav_tab_schedule) {
        e.preventDefault();
        if (activeRole === 'level_1') {
          setDirectorPageMode('LIVE_ALL_UNITS_MONITOR');
        } else if (activeRole === 'level_2') {
          setCoordinationPageMode('conductor_table');
        }
        setActiveTab('schedule');
      } else if (pressed === shortcuts.nav_tab_inbox) {
        e.preventDefault();
        if (activeRole === 'level_1') {
          setDirectorPageMode('CONDUCTOR_24H_MASTER');
        } else if (activeRole === 'level_2') {
          setCoordinationPageMode('workflow_queues');
        }
        setActiveTab('workflow_inbox');
      } else if (pressed === shortcuts.nav_tab_playout) {
        e.preventDefault();
        if (activeRole === 'level_1') {
          setDirectorPageMode('PLAYOUT_AND_AUDIT');
        } else if (activeRole === 'level_2') {
          setCoordinationPageMode('conductor_table');
        }
        setActiveTab('mcr_playout');
      } else if (pressed === shortcuts.action_open_upload) {
        e.preventDefault();
        setRevisionTargetItem(null);
        setUploadModalOpen(true);
      } else if (pressed === shortcuts.action_open_media_library) {
        e.preventDefault();
        setIsMediaLibraryOpen(true);
      } else if (pressed === shortcuts.action_open_shortcuts) {
        e.preventDefault();
        setIsPlayerShortcutsModalOpen(true);
      } else if (pressed === shortcuts.action_auto_resolve) {
        e.preventDefault();
        handleAutoResolveAllAnomalies();
      } else if (pressed === shortcuts.nav_tab_archive) {
        e.preventDefault();
        setIsArchiveModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  });

  const handleSimulateConflictTest = () => {
    if (!currentRole.canEditSchedule) return;
    const mutated = schedule.items.map((item, idx) => {
      if (idx === 3) {
        return {
          ...item,
          duration: '00:01:30',
          endTime: '06:58:00',
        };
      }
      if (idx === 16) {
        return {
          ...item,
          duration: '00:20:00',
          endTime: '13:05:00',
        };
      }
      return item;
    });
    updateScheduleAndSync({
      ...schedule,
      items: mutated,
      updatedAt: new Date().toISOString(),
    });
    showToast(
      'تست عیب‌یاب: یک خلاء آنتن (۱۲۰ ثانیه) و یک تداخل با باکس خبر (۳۰۰ ثانیه) جهت آزمایش سامانه ایجاد شد.'
    );
  };

  const handleTakeNextCue = () => {
    if (!currentRole.canChangePlayoutStatus) {
      showToast(
        'اپراتور پایش پخش اجازه تغییر وضعیت پخش یا اجرای دستی پلی‌لیست را ندارد.'
      );
      return;
    }

    const { currentItem, nextItem } = activePlayoutState;
    if (!nextItem) return;

    if (!isItemApprovedForPlayout(nextItem)) {
      showToast(
        `خطای ایمنی پخش: برنامه بعدی («${nextItem.title}») تأیید نهایی نشده است و امکان ارسال به آنتن را ندارد!`
      );
      return;
    }

    const updated = schedule.items.map((it) => {
      if (currentItem && it.id === currentItem.id) {
        return {
          ...it,
          status: 'aired' as BroadcastStatus,
          workflowStatus: 'aired' as WorkflowStage,
        };
      }
      if (it.id === nextItem.id) {
        return {
          ...it,
          status: 'on_air' as BroadcastStatus,
          workflowStatus: 'on_air' as WorkflowStage,
        };
      }
      return it;
    });

    appendAsRunLog(
      nextItem,
      formatSecondsToTime(studioClockSec),
      currentRole.personName,
      'MANUAL_TAKE',
      `سوییچ به برنامه بعدی (نسخه معتبر v${nextItem.revisionVersion || 1})`
    );
    triggerHardwarePlayout(nextItem, 'PLAY_NOW');
    recordServerAudit({
      actionType: 'PLAYOUT_EXECUTE',
      item: nextItem,
      details: `سوییچ پلی‌اوت به «${nextItem.title}» (نسخه v${
        nextItem.revisionVersion || 1
      })`,
    });

    setStudioClockSec(parseTimeToSeconds(nextItem.startTime));
    updateScheduleAndSync({
      ...schedule,
      items: updated,
      updatedAt: new Date().toISOString(),
    });
    showToast(`سوییچ آنتن انجام شد: «${nextItem.title}» روی آنتن قرار گرفت.`);
  };

  const handleArchiveCurrentSchedule = () => {
    const updatedArchives = saveScheduleToArchive(schedule);
    setArchivedDays(updatedArchives);
    showToast(
      `کنداکتور تاریخ ${schedule.dateShamsi} در آرشیو محلی سازمان ذخیره شد.`
    );
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(schedule, null, 2);
    const blob = new Blob([dataStr], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conductor-schedule-isfahan-${schedule.dateShamsi.replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('فایل JSON کنداکتور با موفقیت ذخیره شد.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result));
        if (parsed && Array.isArray(parsed.items)) {
          updateScheduleAndSync({
            ...ATTACHED_CONDUCTOR_SCHEDULE,
            ...parsed,
            directorName: parsed.directorName || 'محمود فرشچیان',
          });
          showToast(
            `کنداکتور «${parsed.title || file.name}» با ${parsed.items.length} ردیف بارگذاری شد.`
          );
        } else {
          showToast('فرمت فایل JSON انتخاب‌شده معتبر نیست.');
        }
      } catch {
        showToast('خطا در خواندن فایل JSON کنداکتور.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportExcel = () => {
    const headers = [
      'ردیف',
      'عنوان برنامه',
      'قسمت / فصل',
      'نسخه معتبر',
      'ساعت شروع',
      'مدت زمان خالص',
      'ساعت پایان',
      'نقطه شروع (Mark In)',
      'نقطه پایان (Mark Out)',
      'طبقه برنامه',
      'منبع سیگنال',
      'کد مدیا / سرور',
      'وضعیت گردش کار',
      'تعداد اصلاحیه بازبین',
      'قفل رأس ساعت',
      'توضیحات و زیرنویس',
    ];

    const rows = schedule.items.map((item) => [
      item.order,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${(item.episode || '').replace(/"/g, '""')}"`,
      `v${item.revisionVersion || 1}`,
      item.startTime,
      item.duration,
      item.endTime,
      formatDurationTotal(item.trimInSec || 0),
      formatDurationTotal(
        item.trimOutSec ||
          item.sourceDurationSec ||
          parseTimeToSeconds(item.duration)
      ),
      CATEGORY_META[item.category]?.label || item.category,
      SOURCE_META[item.source]?.label || item.source,
      item.mediaCode,
      WORKFLOW_STAGE_META[item.workflowStatus || 'approved_for_playout']
        ?.label || item.status,
      (item.qcMarkers || []).length,
      item.lockStartTime ? 'بله (ثابت)' : 'خیر',
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `کنداکتور-شبکه-اصفهان-${schedule.dateShamsi.replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('خروجی اکسل (CSV با کدینگ فارسی ویندوز) آماده و دانلود شد.');
  };

  const handleResetToDefault = () => {
    updateScheduleAndSync(ATTACHED_CONDUCTOR_SCHEDULE);
    localStorage.removeItem(STORAGE_KEY);
    showToast('کنداکتور به نسخه اولیه پیوست‌شده بازنشانی شد.');
  };

  const isPlayablePlayoutViewVisible =
    authenticatedRole === 'level_3' ||
    (authenticatedRole === 'level_1' &&
      (directorPageMode === 'PLAYOUT_AND_AUDIT' ||
        (directorPageMode === 'LIVE_ALL_UNITS_MONITOR' &&
          directorInspectedUnit === 'level_3')));

  const isMasterScheduleViewVisible =
    (authenticatedRole === 'level_2' &&
      coordinationPageMode === 'conductor_table') ||
    (authenticatedRole === 'level_1' &&
      directorPageMode === 'CONDUCTOR_24H_MASTER');

  const playoutQueueItems = useMemo(() => {
    if (authenticatedRole === 'level_3') {
      return schedule.items.filter((item) => isItemApprovedForPlayout(item));
    }
    return schedule.items;
  }, [schedule.items, authenticatedRole]);

  // ۱. صفحه اصلی ورود و انتخاب نقش (بدون نمایش رمز روی صفحه و با امکان فعال‌سازی قفل پین‌کد)
  if (!authenticatedRole) {
    return (
      <>
        <LandingRoleGateway
          channelTitle={schedule.title}
          dateShamsi={schedule.dateShamsi}
          dayOfWeek={schedule.dayOfWeek}
          clockSec={clockSec}
          requirePinOnLogin={requirePinOnRoleSwitch}
          onToggleRequirePin={setRequirePinOnRoleSwitch}
          onAuthenticated={(role) => {
            if (requirePinOnRoleSwitch) {
              setPendingPinRole(role);
              return;
            }
            setAuthenticatedRole(role.id);
            setActiveRole(role.id);
            if (role.id === 'level_1') {
              setDirectorPageMode('DIRECTOR_DECISION_CENTER');
            } else if (role.id === 'level_2') {
              setActiveTab('schedule');
            } else if (role.id === 'level_3' || role.id === 'operator') {
              setActiveTab('mcr_playout');
            } else {
              setActiveTab('workflow_inbox');
            }
            recordServerAudit({
              actionType: 'ROLE_AUTH',
              details: `ورود رسمی از درگاه انتخاب نقش به پنل ایزوله «${role.title} (${role.personName})»`,
            });
            showToast(
              `خوش آمدید — ورود به پرتال اختصاصی «${role.title} (${role.personName})» انجام شد.`
            );
          }}
        />
        <RolePinModal
          isOpen={Boolean(pendingPinRole)}
          targetRole={pendingPinRole}
          onClose={() => setPendingPinRole(null)}
          onAuthorized={(authorizedRole) => {
            setAuthenticatedRole(authorizedRole.id);
            setActiveRole(authorizedRole.id);
            setPendingPinRole(null);
            if (authorizedRole.id === 'level_1') {
              setDirectorPageMode('DIRECTOR_DECISION_CENTER');
            } else if (authorizedRole.id === 'level_2') {
              setActiveTab('schedule');
            } else if (
              authorizedRole.id === 'level_3' ||
              authorizedRole.id === 'operator'
            ) {
              setActiveTab('mcr_playout');
            } else {
              setActiveTab('workflow_inbox');
            }
            recordServerAudit({
              actionType: 'ROLE_AUTH',
              details: `ورود با پین‌کد امنیتی به نقش «${authorizedRole.title} (${authorizedRole.personName})»`,
            });
            showToast(
              `احراز هویت امنیتی انجام شد — ورود به پرتال «${authorizedRole.title} (${authorizedRole.personName})»`
            );
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-slate-200">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportJson}
        className="hidden"
      />

      {toastMessage && (
        <div className="spatial-modal-content fixed bottom-6 left-6 z-50 max-w-md backdrop-blur-2xl bg-slate-900/90 border border-teal-500/40 shadow-[0_16px_40px_rgba(0,0,0,0.65)] text-slate-100 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs no-print">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-300" />
            </span>
            <span className="leading-relaxed">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 cursor-pointer shrink-0"
            title="بستن اعلان"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Spatial Broadcast OS Specular Top Status Strip */}
      <header className="sticky top-0 z-40 bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6 h-12 flex items-center justify-between gap-4 text-xs select-none no-print">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              setAuthenticatedRole(null);
              setQcModalItem(null);
              setTrimModalItem(null);
              setEditingItem(null);
            }}
            className="font-bold text-white tracking-tight flex items-center gap-2 hover:text-teal-300 transition-colors cursor-pointer shrink-0"
            title="بازگشت به درگاه انتخاب واحد سازمانی"
          >
            <Monitor className="w-3.5 h-3.5 text-teal-400" />
            <span>شبکه اصفهان</span>
          </button>

          <span className="text-slate-600">·</span>

          <span className="font-medium text-teal-300 truncate">
            {currentRole.title} ({currentRole.personName})
          </span>

          {activePlayoutState.currentItem && (
            <>
              <span className="hidden lg:inline text-slate-600">·</span>
              <span className="hidden lg:inline-flex items-center gap-2 text-rose-100 bg-rose-500/20 border border-rose-500/45 px-2.5 py-0.5 rounded-full text-[11px] font-medium shadow-[0_0_14px_-3px_rgba(244,63,94,0.45)] truncate">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span>
                  ON-AIR: {activePlayoutState.currentItem.title} (
                  <strong className="font-mono-tabular text-rose-200">
                    {formatDurationTotal(activePlayoutState.remainingSec)}
                  </strong>
                  )
                </span>
                <span className="w-16 h-1.5 rounded-full bg-slate-950/90 border border-rose-500/30 overflow-hidden shrink-0">
                  <span
                    style={{ width: `${activePlayoutState.progressPercent}%` }}
                    className="block h-full bg-gradient-to-l from-rose-500 to-teal-400 transition-all duration-300"
                  />
                </span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-300">
          <button
            type="button"
            onClick={() => setIsTomorrowAzanModalOpen(true)}
            title="مشاهده اوقات شرعی به افق اصفهان و تنظیم باکس‌های اذان"
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono-tabular transition-all cursor-pointer ${
              nextAzanStatus.isOnNow || nextAzanStatus.isImminent
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-950/85 border-amber-500/30 text-amber-300 hover:border-amber-400/60'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-sans font-semibold">{nextAzanStatus.label}:</span>
            <span className="font-bold">{nextAzanStatus.exactTime}</span>
            <span className="text-[10px] text-amber-200/80">
              (مانده: {nextAzanStatus.remainingFormatted})
            </span>
          </button>

          <span className="hidden sm:inline text-slate-600">·</span>

          <span className="hidden sm:inline text-slate-300">
            {schedule.dayOfWeek} {schedule.dateShamsi}
          </span>

          <span
            suppressHydrationWarning
            title="Master Studio Clock"
            className="px-3 py-1 rounded-full bg-slate-950/95 border border-teal-500/35 font-mono-tabular font-bold text-teal-300 tracking-wider shadow-[inset_0_1px_3px_rgba(0,0,0,0.85),0_0_12px_-3px_rgba(20,184,166,0.3)]"
          >
            {formatSecondsToTime(studioClockSec)}
          </span>
        </div>
      </header>

      {/* Main Spatial Broadcast Workspace Container */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-5 pt-4 pb-8 no-print">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {/* Studio Workspace Header & Sub-Navigation */}
          <div className="px-4 sm:px-6 py-3.5 bg-slate-950/75 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  {schedule.title} — {currentRole.title}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {currentRole.department} · مسئول شیفت:{' '}
                  <span className="text-teal-300 font-medium">
                    {currentRole.personName}
                  </span>
                </div>
              </div>
            </div>

            {/* Segmented View Selector (OS 26 Segmented Glass Pill) */}
            <nav className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/[0.08] shadow-inner text-xs">
              {authenticatedRole === 'level_1' ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setDirectorPageMode('DIRECTOR_DECISION_CENTER')
                    }
                    className={`cursor-pointer ${
                      directorPageMode === 'DIRECTOR_DECISION_CENTER'
                        ? 'bg-gradient-to-b from-teal-400 to-teal-500 text-slate-950 font-bold shadow-[0_2px_10px_rgba(20,184,166,0.35)] rounded-lg px-3.5 py-1.5'
                        : 'text-slate-400 hover:text-slate-100 px-3.5 py-1.5 rounded-lg transition-all'
                    }`}
                  >
                    مرکز تصمیم‌گیری مدیر پخش
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDirectorPageMode('LIVE_ALL_UNITS_MONITOR')
                    }
                    className={`cursor-pointer ${
                      directorPageMode === 'LIVE_ALL_UNITS_MONITOR'
                        ? 'bg-gradient-to-b from-teal-400 to-teal-500 text-slate-950 font-bold shadow-[0_2px_10px_rgba(20,184,166,0.35)] rounded-lg px-3.5 py-1.5'
                        : 'text-slate-400 hover:text-slate-100 px-3.5 py-1.5 rounded-lg transition-all'
                    }`}
                  >
                    مانیتورینگ زنده ۵ واحد
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectorPageMode('CONDUCTOR_24H_MASTER')}
                    className={`cursor-pointer ${
                      directorPageMode === 'CONDUCTOR_24H_MASTER'
                        ? 'bg-gradient-to-b from-teal-400 to-teal-500 text-slate-950 font-bold shadow-[0_2px_10px_rgba(20,184,166,0.35)] rounded-lg px-3.5 py-1.5'
                        : 'text-slate-400 hover:text-slate-100 px-3.5 py-1.5 rounded-lg transition-all'
                    }`}
                  >
                    جدول کنداکتور ۲۴ ساعته (نگارش / ویرایش)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectorPageMode('PLAYOUT_AND_AUDIT')}
                    className={`cursor-pointer ${
                      directorPageMode === 'PLAYOUT_AND_AUDIT'
                        ? 'bg-gradient-to-b from-teal-400 to-teal-500 text-slate-950 font-bold shadow-[0_2px_10px_rgba(20,184,166,0.35)] rounded-lg px-3.5 py-1.5'
                        : 'text-slate-400 hover:text-slate-100 px-3.5 py-1.5 rounded-lg transition-all'
                    }`}
                  >
                    پلی‌اوت و ممیزی
                  </button>
                </>
              ) : authenticatedRole === 'level_2' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCoordinationPageMode('workflow_queues')}
                    className={`cursor-pointer ${
                      coordinationPageMode === 'workflow_queues'
                        ? 'bg-gradient-to-b from-teal-400 to-teal-500 text-slate-950 font-bold shadow-[0_2px_10px_rgba(20,184,166,0.35)] rounded-lg px-3.5 py-1.5'
                        : 'text-slate-400 hover:text-slate-100 px-3.5 py-1.5 rounded-lg transition-all'
                    }`}
                  >
                    ۱. کارتابل گردش‌کار هماهنگی
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoordinationPageMode('conductor_table')}
                    className={`cursor-pointer ${
                      coordinationPageMode === 'conductor_table'
                        ? 'bg-gradient-to-b from-teal-400 to-teal-500 text-slate-950 font-bold shadow-[0_2px_10px_rgba(20,184,166,0.35)] rounded-lg px-3.5 py-1.5'
                        : 'text-slate-400 hover:text-slate-100 px-3.5 py-1.5 rounded-lg transition-all'
                    }`}
                  >
                    ۲. نگارش و ویرایش جدول کنداکتور ۲۴ ساعته ({schedule.items.length} ردیف)
                  </button>
                </>
              ) : (
                <span className="px-3 py-1 text-xs text-teal-300 font-medium">
                  میز کار اختصاصی {currentRole.title}
                </span>
              )}
            </nav>

            {/* Studio Console Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {activePlayoutState.currentItem && (
                <button
                  type="button"
                  onClick={() => setCleanFeedFullscreen(true)}
                  className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="نمایش تمام‌صفحه خروجی آنتن (Clean Feed)"
                >
                  <Monitor className="w-3.5 h-3.5 text-teal-300" />
                  <span>خروجی آنتن</span>
                </button>
              )}

              {!currentRole.isMonitoringOnly && (
                <button
                  type="button"
                  onClick={() => setIsPlayerShortcutsModalOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="شخصی‌سازی کلیدهای میان‌بر کنترلر پخش ویدئو"
                >
                  <Sliders className="w-3.5 h-3.5 text-teal-300" />
                  <span>
                    میان‌بر پلیر (
                    {formatShortcutBadge(shortcuts.player_toggle_play)})
                  </span>
                </button>
              )}

              {authenticatedRole === 'level_1' && (
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(true)}
                  className="px-2.5 py-1.5 text-xs font-medium text-amber-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                >
                  لاگ ممیزی
                </button>
              )}

              {(authenticatedRole === 'level_1' ||
                authenticatedRole === 'level_2') && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-teal-400 hover:bg-teal-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ رسمی</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setAuthenticatedRole(null);
                  setQcModalItem(null);
                  setTrimModalItem(null);
                  setEditingItem(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>تغییر واحد سازمانی</span>
              </button>
            </div>
          </div>

          <main id="top" className="p-4 sm:p-6 space-y-5">
            {(authenticatedRole === 'level_1' ||
              authenticatedRole === 'level_2' ||
              authenticatedRole === 'level_3') && (
              <LanPresenceAndBackupBar
                currentRole={currentRole}
                activeTab={
                  authenticatedRole === 'level_1'
                    ? directorPageMode
                    : authenticatedRole === 'level_2'
                    ? coordinationPageMode
                    : activeTab
                }
                activeEditingOrQcItemTitle={
                  editingItem?.title || qcModalItem?.title || trimModalItem?.title
                }
                onOpenRoleCredentials={() =>
                  setIsRoleCredentialsModalOpen(true)
                }
                onBackupRestored={() => {
                  fetch('/api/schedule')
                    .then((res) => res.json())
                    .then((lanData) => {
                      if (lanData && Array.isArray(lanData.items)) {
                        updateScheduleAndSync(lanData);
                      }
                    })
                    .catch(() => {});
                }}
                onStatusToast={showToast}
              />
            )}

        {/* =================================================================
            STRICT ROLE-ISOLATED PORTALS (DOM ISOLATION PER AGENT_DEBUGGED_SPEC)
           ================================================================= */}

        {/* ۱. نقش مدیر پخش (level_1): دسترسی کامل + مرکز تصمیم‌گیری + مانیتورینگ زنده ۵ واحد */}
        {authenticatedRole === 'level_1' && (
          <DirectorDecisionAndMonitorPortal
            mode={directorPageMode}
            items={schedule.items}
            incidents={executionIncidents}
            inspectedUnitRole={directorInspectedUnit}
            onSelectInspectedUnitRole={setDirectorInspectedUnit}
            onDirectorDecision={(itemId, markers, decisionStage, comment) =>
              handleSaveMarkersAndStage(
                itemId,
                markers,
                decisionStage,
                comment
              )
            }
            onOpenQCModal={(item) => setQcModalItem(item)}
            onUpdateIncidentStatus={(incId, status, note) => {
              setExecutionIncidents((prev) =>
                prev.map((inc) =>
                  inc.id === incId
                    ? { ...inc, status, resolutionNote: note }
                    : inc
                )
              );
              showToast('وضعیت گزارش خطای پایش آنتن بروزرسانی شد.');
            }}
          />
        )}

        {/* ۲. نقش تهیه‌کننده و تدوینگر (producer_editor): ایزوله کامل (سایر صفحات از DOM حذف شده‌اند) */}
        {(authenticatedRole === 'producer_editor' ||
          (authenticatedRole === 'level_1' &&
            directorPageMode === 'LIVE_ALL_UNITS_MONITOR' &&
            directorInspectedUnit === 'producer_editor')) && (
          <ProducerSubmissionAndStatusPortal
            items={schedule.items}
            currentRole={
              ROLES.find((r) => r.id === 'producer_editor') || currentRole
            }
            onOpenNewUpload={() => {
              setRevisionTargetItem(null);
              setUploadModalOpen(true);
            }}
            onOpenRevisionUpload={(item) => {
              setRevisionTargetItem(item);
              setUploadModalOpen(true);
            }}
          />
        )}

        {/* ۳. نقش واحد هماهنگی (level_2): کارتابل گردش‌کار و جدول کنداکتور در ۲ تب مجزا */}
        {((authenticatedRole === 'level_2' &&
          coordinationPageMode === 'workflow_queues') ||
          (authenticatedRole === 'level_1' &&
            directorPageMode === 'LIVE_ALL_UNITS_MONITOR' &&
            directorInspectedUnit === 'level_2')) && (
          <CoordinationWorkflowPortal
            items={schedule.items}
            createdBy={schedule.createdBy}
            lastEditedBy={schedule.lastEditedBy}
            lastEditedAt={schedule.lastEditedAt}
            onTransitionStage={(itemId, markers, nextStage, comment) =>
              handleSaveMarkersAndStage(itemId, markers, nextStage, comment)
            }
            onOpenQCModal={(item) => setQcModalItem(item)}
            onOpenConductorTable={() => {
              if (authenticatedRole === 'level_1') {
                setDirectorPageMode('CONDUCTOR_24H_MASTER');
              } else {
                setCoordinationPageMode('conductor_table');
              }
            }}
            onAddNewConductorItem={() => {
              if (authenticatedRole === 'level_1') {
                setDirectorPageMode('CONDUCTOR_24H_MASTER');
              } else {
                setCoordinationPageMode('conductor_table');
              }
              handleOpenAddModal();
            }}
          />
        )}

        {/* ۴. نقش بازبین (qc_inspector): ایزوله کامل (فقط پرونده‌های ارجاع‌شده از هماهنگی و رهگیری بازبینی‌های قبلی) */}
        {(authenticatedRole === 'qc_inspector' ||
          (authenticatedRole === 'level_1' &&
            directorPageMode === 'LIVE_ALL_UNITS_MONITOR' &&
            directorInspectedUnit === 'qc_inspector')) && (
          <QCInspectionPortal
            items={schedule.items}
            currentRole={
              ROLES.find((r) => r.id === 'qc_inspector') || currentRole
            }
            onSaveMarkersAndStage={(itemId, markers, nextStage, comment) =>
              handleSaveMarkersAndStage(itemId, markers, nextStage, comment)
            }
          />
        )}

        {/* ۶. نقش اپراتور پایش پخش (operator): ایزوله کامل و کاملاً Read-Only بدون هیچ دکمه ویرایش در DOM */}
        {(authenticatedRole === 'operator' ||
          (authenticatedRole === 'level_1' &&
            directorPageMode === 'LIVE_ALL_UNITS_MONITOR' &&
            directorInspectedUnit === 'operator')) && (
          <ReadOnlyMonitoringPortal
            items={schedule.items}
            currentItem={activePlayoutState.currentItem}
            nextItem={activePlayoutState.nextItem}
            remainingSec={activePlayoutState.remainingSec}
            progressPercent={activePlayoutState.progressPercent}
            clockSec={clockSec}
            dayStartSec={parseTimeToSeconds(schedule.startTime || '06:00:00')}
            nextAzanStatus={nextAzanStatus}
            incidents={executionIncidents}
            reporterName={
              (ROLES.find((r) => r.id === 'operator') || currentRole)
                .personName + ' (اپراتور پایش پخش)'
            }
            onAddIncident={(inc) => {
              const newIncident: BroadcastExecutionIncident = {
                ...inc,
                id: `inc-${Date.now()}`,
                reportedAt: new Date().toLocaleTimeString('fa-IR'),
                status: 'open',
              };
              setExecutionIncidents((prev) => [newIncident, ...prev]);
              showToast(
                'گزارش خطای اجرای پخش ثبت و برای مسئول پلی‌اوت و مدیر پخش ارسال شد.'
              );
            }}
            onOpenTomorrowAzan={() => setIsTomorrowAzanModalOpen(true)}
          />
        )}

        {/* ۵. نقش مسئول مدیریت پلی‌اوت (level_3) یا نمای پلی‌اوت مدیر پخش */}
        {isPlayablePlayoutViewVisible && (
          <PlayoutManagementPanel
            scheduleStartTime={schedule.startTime || '06:00:00'}
            allScheduleItems={schedule.items}
            playoutQueueItems={playoutQueueItems}
            activePlayoutState={activePlayoutState}
            resolvedPreviewItem={resolvedPreviewItem}
            previewTimeSec={previewTimeSec}
            isPreviewPlaying={isPreviewPlaying}
            clockSec={clockSec}
            isClockRunning={isClockRunning}
            emergencyMode={emergencyMode}
            currentRole={currentRole}
            nextAzanStatus={nextAzanStatus}
            isfahanAzanTimes={isfahanAzanTimes}
            getEffectiveItemDurationSec={getEffectiveItemDurationSec}
            onChangeStatus={handleChangeStatus}
            onSetStudioClockSec={setStudioClockSec}
            onSetIsClockRunning={setIsClockRunning}
            onSetEmergencyMode={setEmergencyMode}
            onOpenTrimModal={setTrimModalItem}
            onSetPreviewItem={setPreviewItem}
            onSetPreviewTimeSec={setPreviewTimeSec}
            onSetIsPreviewPlaying={setIsPreviewPlaying}
            onOpenCleanFeed={() => setCleanFeedFullscreen(true)}
            onOpenTomorrowAzan={() => setIsTomorrowAzanModalOpen(true)}
            onExportCasparScript={handleExportCasparScript}
            onExportEDL={handleExportEDL}
            onMoveItem={handleMoveItem}
            onStatusToast={showToast}
            onTakeNextCue={handleTakeNextCue}
          />
        )}

        {/* جدول کنداکتور ۲۴ ساعته (صرفاً برای واحد هماهنگی و مدیر پخش در DOM رندر می‌شود) */}
        {isMasterScheduleViewVisible && (
          <>
            {/* Quantitative Broadcast Metrics Strip (Bento Metrics Grid) & 24h Visual Timeline */}
            <section className="bg-slate-900/60 border border-slate-800/90 rounded-xl p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/[0.07] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>مجموع زمان کنداکتور</span>
                      <span className="w-2 h-2 rounded-full bg-teal-400" />
                    </div>
                    <div className="text-lg font-bold font-mono-tabular text-slate-100 mt-1">
                      {formatDurationTotal(stats.totalDurationSec)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      هدف شیفت: {schedule.targetDurationHours} ساعت
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-900 overflow-hidden mt-2.5">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (stats.totalDurationSec / Math.max(1, stats.targetSec)) *
                              100
                          )
                        )}%`,
                      }}
                      className="h-full bg-teal-400"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/[0.07] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>تعداد کل باکس‌ها</span>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                    <div className="text-lg font-bold font-mono-tabular text-slate-100 mt-1">
                      {stats.totalItems} برنامه
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {stats.lockedCount} باکس قفل رأس ساعت
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-900 overflow-hidden mt-2.5">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (stats.lockedCount / Math.max(1, stats.totalItems)) *
                              100
                          )
                        )}%`,
                      }}
                      className="h-full bg-amber-400"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/[0.07] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>سهم برنامه‌های زنده و خبر</span>
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                    </div>
                    <div className="text-lg font-bold font-mono-tabular text-rose-300 mt-1">
                      {formatDurationTotal(stats.liveSec)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      استودیوهای زنده و نود خبر
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-900 overflow-hidden mt-2.5">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (stats.liveSec / Math.max(1, stats.totalDurationSec)) *
                              100
                          )
                        )}%`,
                      }}
                      className="h-full bg-rose-500"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/[0.07] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>مجموع باکس بازرگانی</span>
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                    </div>
                    <div className="text-lg font-bold font-mono-tabular text-purple-300 mt-1">
                      {formatDurationTotal(stats.adSec)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      آگهی‌های صبح، عصر و طلایی
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-900 overflow-hidden mt-2.5">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            6,
                            Math.round(
                              (stats.adSec / Math.max(1, stats.totalDurationSec)) *
                                100
                            )
                          )
                        )}%`,
                      }}
                      className="h-full bg-purple-400"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/[0.07] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>تداخل یا خلاء آنتن</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          anomalies.length === 0 ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                    </div>
                    <div
                      className={`text-lg font-bold font-mono-tabular mt-1 ${
                        anomalies.length === 0
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {anomalies.length === 0
                        ? '۰ مورد (تراز)'
                        : `${anomalies.length} هشدار`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      پایش خودکار پیوستگی آنتن
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-900 overflow-hidden mt-2.5">
                    <div
                      style={{
                        width: anomalies.length === 0 ? '100%' : '35%',
                      }}
                      className={`h-full ${
                        anomalies.length === 0 ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/[0.07] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>دارای مجوز پلی‌اوت</span>
                      <span className="w-2 h-2 rounded-full bg-teal-400" />
                    </div>
                    <div className="text-lg font-bold font-mono-tabular text-teal-300 mt-1">
                      {stats.readyOrOnAirCount} / {stats.totalItems}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      فایل‌های تأیید نهایی شده
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-900 overflow-hidden mt-2.5">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (stats.readyOrOnAirCount /
                              Math.max(1, stats.totalItems)) *
                              100
                          )
                        )}%`,
                      }}
                      className="h-full bg-teal-400"
                    />
                  </div>
                </div>
              </div>

              {/* 24-Hour Interactive Timeline Strip with Category Color Legend & Hoverable Empty Gaps */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-300">
                    نوار گرافیکی پیوستگی کنداکتور (هاور روی فضاهای خالی جهت
                    مشاهده مقدار خلاء آنتن به ثانیه)
                  </span>
                  {hoveredGapInfo ? (
                    <span className="px-2.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 font-mono-tabular font-bold animate-pulse">
                      هشدار خلاء آنتن: {hoveredGapInfo.gapSec} ثانیه (
                      {formatDurationTotal(hoveredGapInfo.gapSec)}) بین «
                      {hoveredGapInfo.afterTitle}» و «
                      {hoveredGapInfo.beforeTitle}» ({hoveredGapInfo.fromTime}{' '}
                      تا {hoveredGapInfo.toTime})
                    </span>
                  ) : anomalyAggregateMetrics.totalGapSec > 0 ? (
                    <span className="text-[11px] text-rose-300 font-mono-tabular">
                      مجموع خلاء آنتن شناسایی‌شده در نوار:{' '}
                      {anomalyAggregateMetrics.totalGapSec} ثانیه (روی شکاف‌های
                      قرمز هاور کنید)
                    </span>
                  ) : null}
                </div>

                {/* Category Color Legend */}
                <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-950/75 border border-white/[0.06] text-[11px] text-slate-300">
                  <span className="text-slate-400 font-semibold">راهنمای رنگ طبقات:</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                    <span>زنده</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                    <span>خبر</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500" />
                    <span>نمایشی / سریال</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-teal-500" />
                    <span>تولیدی</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                    <span>معارف و اذان</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-purple-500" />
                    <span>بازرگانی</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-500" />
                    <span>تیزر</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-600" />
                    <span>میان‌برنامه</span>
                  </span>
                </div>

                {/* 24-Hour Time Ruler (RTL aligned: 06:00 on the right matching Item #1, 24:00 on the left) */}
                <div
                  dir="rtl"
                  className="flex items-center justify-between px-1 font-mono-tabular text-[10px] text-slate-400 select-none"
                >
                  <span dir="ltr" className="inline-block">06:00</span>
                  <span dir="ltr" className="inline-block">09:00</span>
                  <span dir="ltr" className="inline-block">12:00</span>
                  <span dir="ltr" className="inline-block">15:00</span>
                  <span dir="ltr" className="inline-block">18:00</span>
                  <span dir="ltr" className="inline-block">21:00</span>
                  <span dir="ltr" className="inline-block">24:00 (+06:00)</span>
                </div>

                <div className="relative w-full h-9 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex">
                  {/* Live Studio Playhead Needle on 24h Continuity Strip */}
                  {(() => {
                    const dayStart = schedule.startTime || '06:00:00';
                    const timelineSec = toBroadcastTimelineSeconds(
                      formatSecondsToTime(Math.floor(studioClockSec)),
                      dayStart
                    );
                    const startBase = parseTimeToSeconds(dayStart);
                    const totalSpan = Math.max(
                      1,
                      stats.totalDurationSec +
                        anomalyAggregateMetrics.totalGapSec
                    );
                    const pct = Math.min(
                      99.5,
                      Math.max(0.5, ((timelineSec - startBase) / totalSpan) * 100)
                    );
                    return (
                      <div
                        style={{ right: `${pct}%` }}
                        title={`عقربه زمان فعلی استودیو: ${formatSecondsToTime(
                          studioClockSec
                        )}`}
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_#2dd4bf] z-30 pointer-events-none"
                      />
                    );
                  })()}

                  {schedule.items.map((item) => {
                    const dur = Math.max(
                      120,
                      parseTimeToSeconds(item.duration)
                    );
                    const totalSpan = Math.max(
                      1,
                      stats.totalDurationSec +
                        anomalyAggregateMetrics.totalGapSec
                    );
                    const weight = dur / totalSpan;
                    const gapAfter =
                      anomalyAggregateMetrics.gapsByAfterItemId.get(item.id);
                    const gapWeight = gapAfter
                      ? Math.max(0.018, gapAfter.gapSec / totalSpan)
                      : 0;

                    const bgMap: Record<ProgramCategory, string> = {
                      live: 'bg-rose-500/75 hover:bg-rose-400',
                      news: 'bg-amber-500/75 hover:bg-amber-400',
                      series: 'bg-cyan-500/70 hover:bg-cyan-400',
                      production: 'bg-teal-500/70 hover:bg-teal-400',
                      religious: 'bg-emerald-500/75 hover:bg-emerald-400',
                      ad: 'bg-purple-500/70 hover:bg-purple-400',
                      promo: 'bg-sky-500/70 hover:bg-sky-400',
                      filler: 'bg-slate-700/80 hover:bg-slate-600',
                    };
                    return (
                      <React.Fragment key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            const rowEl = document.getElementById(
                              `row-${item.id}`
                            );
                            rowEl?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            });
                          }}
                          style={{ width: `${Math.max(1.2, weight * 100)}%` }}
                          title={`ردیف ${item.order}: ${item.title} (${item.startTime} - ${item.endTime})`}
                          className={`h-full border-l border-slate-950/60 transition-colors relative group cursor-pointer ${
                            bgMap[item.category]
                          } ${
                            item.status === 'rejected'
                              ? 'ring-2 ring-rose-400 z-10'
                              : ''
                          }`}
                        >
                          {item.lockStartTime && (
                            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-300 rounded-full" />
                          )}
                        </button>

                        {gapAfter && (
                          <div
                            onMouseEnter={() => setHoveredGapInfo(gapAfter)}
                            onMouseLeave={() => setHoveredGapInfo(null)}
                            onClick={() => {
                              const rowEl = document.getElementById(
                                `row-${item.id}`
                              );
                              rowEl?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                              });
                            }}
                            style={{
                              width: `${Math.max(1.8, gapWeight * 100)}%`,
                            }}
                            title={`خلاء آنتن: ${gapAfter.gapSec} ثانیه (${formatDurationTotal(
                              gapAfter.gapSec
                            )}) از ${gapAfter.fromTime} تا ${gapAfter.toTime}`}
                            className="h-full bg-rose-950 border-x-2 border-rose-500 flex items-center justify-center cursor-pointer relative group animate-pulse"
                          >
                            <span className="text-[9px] font-mono-tabular font-bold text-rose-200 truncate px-0.5">
                              {gapAfter.gapSec}s
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Automatic Conflict & Antenna Gap Inspector (#anomaly-inspector) */}
            <section
              id="anomaly-inspector"
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {anomalies.length === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-100">
                        سامانه هوشمند تشخیص تداخل‌های زمانی، خلاء آنتن و وضعیت
                        تأییدها
                      </h2>
                      <span
                        className={`px-2.5 py-0.5 rounded-md border text-[11px] font-mono-tabular font-bold ${
                          anomalyAggregateMetrics.totalGapSec > 0
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        مجموع خلاء آنتن (Gaps):{' '}
                        {anomalyAggregateMetrics.totalGapSec} ثانیه (
                        {formatDurationTotal(
                          anomalyAggregateMetrics.totalGapSec
                        )}
                        )
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-md border text-[11px] font-mono-tabular font-bold ${
                          anomalyAggregateMetrics.totalOverlapSec > 0
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        مجموع هم‌پوشانی زمانی (Overlaps):{' '}
                        {anomalyAggregateMetrics.totalOverlapSec} ثانیه (
                        {formatDurationTotal(
                          anomalyAggregateMetrics.totalOverlapSec
                        )}
                        )
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      بررسی پیوستگی لحظه‌به‌لحظه آیتم‌ها، حفاظت از باکس‌های
                      قفل‌شده (اخبار و اذان) و کنترل مجوزهای پخش پیش از اجرا
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {anomalies.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoResolveAllAnomalies}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>
                        رفع خودکار خطاها و تراز زمان‌بندی ({anomalies.length})
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSimulateConflictTest}
                    disabled={!currentRole.canEditSchedule}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>تست شبیه‌سازی تداخل / خلاء آنتن</span>
                  </button>
                </div>
              </div>

              {/* Interactive Anomaly Cards List */}
              {anomalies.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-3 border-t border-white/[0.08]">
                  {anomalies.map((anomaly, idx) => (
                    <button
                      key={`${anomaly.itemId}-${anomaly.type}-${idx}`}
                      type="button"
                      onClick={() => {
                        const rowEl = document.getElementById(
                          `row-${anomaly.itemId}`
                        );
                        rowEl?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                        });
                      }}
                      className={`p-3 rounded-xl border text-right flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                        anomaly.severity === 'error'
                          ? 'bg-rose-950/30 border-rose-500/45 hover:bg-rose-950/45 text-rose-200'
                          : 'bg-amber-950/30 border-amber-500/45 hover:bg-amber-950/45 text-amber-200'
                      }`}
                    >
                      <div className="flex items-start gap-2 text-xs">
                        <AlertTriangle
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            anomaly.severity === 'error'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        />
                        <span>{anomaly.message}</span>
                      </div>
                      <span className="text-[10px] font-mono-tabular px-2 py-0.5 rounded bg-slate-950/80 border border-white/[0.1] shrink-0">
                        پرش به ردیف ←
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Conductor Action Toolbar, Author/Editor Audit Banner, Filters & Table */}
            <section
              id="schedule-table"
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4"
            >
              {/* شناسنامه نگارش و سوابق ویرایش کنداکتور (ثبت نویسنده هماهنگی/مدیر و آخرین ویرایشگر) */}
              <div className="p-3.5 rounded-xl bg-slate-950/85 border border-teal-500/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300 font-bold text-[11px]">
                        نویسنده و تنظیم‌کننده کنداکتور
                      </span>
                      <span className="font-bold text-slate-100">
                        {schedule.createdBy || 'خانم مرادی (واحد هماهنگی)'}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-slate-400">
                        ({schedule.createdAt || `${schedule.dateShamsi} - 05:30`})
                      </span>
                    </div>

                    <span className="text-slate-700 hidden md:inline">|</span>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/40 text-teal-300 font-bold text-[11px]">
                        آخرین ویرایش‌کننده کنداکتور
                      </span>
                      <span className="font-bold text-slate-100">
                        {schedule.lastEditedBy || 'محمود فرشچیان (مدیر پخش)'}
                      </span>
                      {schedule.lastEditedAt && (
                        <span className="text-[11px] font-mono-tabular text-slate-400">
                          ({schedule.lastEditedAt})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentRole.canEditSchedule && (
                      <button
                        type="button"
                        onClick={() => {
                          const actorFull = `${currentRole.personName} (${currentRole.title})`;
                          updateScheduleAndSync(
                            stampScheduleModification(
                              schedule,
                              'CREATED',
                              `ثبت و امضای نگارش کامل کنداکتور ۲۴ ساعته توسط ${actorFull}`,
                              true
                            )
                          );
                          recordServerAudit({
                            actionType: 'SCHEDULE_UPDATE',
                            details: `ثبت نگارش کنداکتور ۲۴ ساعته به نام ${actorFull}`,
                          });
                          showToast(
                            `کنداکتور ۲۴ ساعته به نام «${actorFull}» به عنوان نویسنده و تنظیم‌کننده ثبت شد.`
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-semibold text-[11px] cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>
                          ثبت نگارش کنداکتور به نام {currentRole.personName} (
                          {currentRole.title})
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowScheduleAuditLog((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-teal-300 font-semibold text-[11px] cursor-pointer transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>
                        سوابق نگارش و ویرایش کنداکتور (
                        {(schedule.scheduleEditHistory || []).length})
                      </span>
                    </button>
                  </div>
                </div>

                {schedule.lastEditSummary && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                    <span className="text-teal-300 font-semibold">
                      شرح آخرین تغییر ثبت‌شده:
                    </span>
                    <span className="text-slate-300">
                      {schedule.lastEditSummary}
                    </span>
                  </div>
                )}

                {showScheduleAuditLog && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5 max-h-44 overflow-y-auto">
                    <div className="text-[11px] font-bold text-slate-300">
                      لاگ کامل نویسندگان و ویرایشگران جدول کنداکتور (Coordination &
                      Director Schedule Revision Log):
                    </div>
                    {(schedule.scheduleEditHistory || []).map((rev) => (
                      <div
                        key={rev.id}
                        className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              rev.actionType === 'CREATED'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            }`}
                          >
                            {rev.actionType === 'CREATED'
                              ? 'نگارش کنداکتور'
                              : rev.actionType === 'ITEM_ADDED'
                              ? 'افزودن ردیف'
                              : rev.actionType === 'ITEM_DELETED'
                              ? 'حذف ردیف'
                              : rev.actionType === 'REORDERED'
                              ? 'جابجایی چیدمان'
                              : 'ویرایش کنداکتور'}
                          </span>
                          <span className="font-bold text-white">
                            {rev.actorName}
                          </span>
                          <span className="text-slate-400">—</span>
                          <span className="text-slate-200">{rev.summary}</span>
                        </div>
                        <span className="font-mono-tabular text-slate-400">
                          ساعت {rev.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!currentRole.canEditSchedule}
                    onClick={() => handleOpenAddModal()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن برنامه جدید به کنداکتور</span>
                  </button>

                  <button
                    type="button"
                    disabled={!currentRole.canEditSchedule}
                    onClick={() => {
                      const recalculated = recalculateScheduleItems(
                        schedule.items,
                        schedule.startTime,
                        true
                      );
                      updateScheduleAndSync(
                        stampScheduleModification(
                          {
                            ...schedule,
                            items: recalculated,
                          },
                          'RECALCULATED',
                          'بازشماری خودکار ساعت شروع و پایان کلیه ردیف‌های کنداکتور'
                        )
                      );
                      showToast(
                        `ساعت شروع و پایان تمام آیتم‌ها توسط «${currentRole.personName} (${currentRole.title})» بازشماری شد.`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                    <span>بازشماری خودکار زمان‌ها</span>
                  </button>

                  {activePlayoutState.currentItem && (
                    <button
                      type="button"
                      onClick={() => {
                        const onAirItem = activePlayoutState.currentItem;
                        if (!onAirItem) return;
                        const idxInFiltered = filteredItems.findIndex(
                          (i) => i.id === onAirItem.id
                        );
                        if (idxInFiltered >= 0) {
                          const targetPage =
                            Math.floor(idxInFiltered / schedulePageSize) + 1;
                          setSchedulePage(targetPage);
                        } else {
                          setCategoryFilter('all');
                          setStatusFilter('all');
                          setSearchQuery('');
                          const rawIdx = schedule.items.findIndex(
                            (i) => i.id === onAirItem.id
                          );
                          if (rawIdx >= 0) {
                            setSchedulePage(
                              Math.floor(rawIdx / schedulePageSize) + 1
                            );
                          }
                        }
                        setTimeout(() => {
                          const rowEl = document.getElementById(
                            `row-${onAirItem.id}`
                          );
                          rowEl?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }, 80);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-200 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span>پرش به ردیف روی آنتن (Locate On-Air)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCompactTable((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isCompactTable
                        ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>
                      تراکم جدول: {isCompactTable ? 'فشرده' : 'استاندارد'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMediaLibraryOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FolderSearch className="w-3.5 h-3.5 text-teal-400" />
                    <span>مخزن متمرکز مدیا</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>بارگذاری JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-400" />
                    <span>خروجی JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>خروجی اکسل (Excel)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsArchiveModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-400" />
                    <span>آرشیو چندروزه ({archivedDays.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsHandoverModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-300 bg-slate-950 border border-teal-500/40 rounded-lg cursor-pointer"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>صورتجلسه تحویل شیفت</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>بازنشانی پیش‌فرض</span>
                  </button>
                </div>
              </div>

              {/* Enhanced Real-Time Search & Filter Toolbar */}
              <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Real-time Instant Search Input with Counter & Clear Button */}
                  <div className="relative flex-1 max-w-xl">
                    <Search className="w-4 h-4 text-teal-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSchedulePage(1);
                      }}
                      placeholder="فیلتر لحظه‌ای کنداکتور بر اساس نام برنامه، کد مدیا، شماره قسمت یا توضیحات رژی..."
                      className="w-full pr-10 pl-28 py-2 bg-slate-950 border border-slate-700/80 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/50 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 transition-all shadow-inner"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {searchQuery.trim() !== '' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSchedulePage(1);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer transition-colors"
                          title="پاک کردن متن جستجو"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="font-mono-tabular text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-teal-300 font-bold shrink-0">
                        {filteredItems.length} از {schedule.items.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(
                          e.target.value as BroadcastStatus | 'all'
                        );
                        setSchedulePage(1);
                      }}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer shadow-inner"
                    >
                      <option value="all">همه وضعیت‌های پخش</option>
                      <option value="on_air">در نوبت / روی آنتن</option>
                      <option value="ready">آماده پخش</option>
                      <option value="aired">پخش شده</option>
                      <option value="rejected">نیازمند اصلاح / رد شده</option>
                    </select>
                  </div>
                </div>

                {/* Category Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 ml-1">
                    دسته‌بندی موضوعی:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('all');
                      setSchedulePage(1);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      categoryFilter === 'all'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    همه ({schedule.items.length})
                  </button>
                  {(Object.keys(CATEGORY_META) as ProgramCategory[]).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategoryFilter(cat);
                          setSchedulePage(1);
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          categoryFilter === cat
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {CATEGORY_META[cat].shortLabel}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* HIGH-DENSITY BROADCAST SCHEDULE TABLE (Sticky Header + Scrollable Well + Edge Scroll Shadows) */}
              <div className="max-h-[640px] overflow-y-auto overflow-x-auto border border-white/[0.08] rounded-xl bg-slate-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),inset_-12px_0_16px_-12px_rgba(0,0,0,0.6),inset_12px_0_16px_-12px_rgba(0,0,0,0.6)]">
                <table className="w-full text-right border-collapse">
                  <thead className="sticky top-0 z-20 backdrop-blur-xl bg-slate-900/95 shadow-sm">
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                      <th className="py-3 px-3 text-center w-12 whitespace-nowrap">#</th>
                      <th className="py-3 px-3 text-center w-24 whitespace-nowrap">ساعت شروع</th>
                      <th className="py-3 px-3 text-center w-24 whitespace-nowrap">مدت زمان</th>
                      <th className="py-3 px-3 text-center w-24 whitespace-nowrap">ساعت پایان</th>
                      <th className="py-3 px-4 min-w-[280px]">
                        عنوان برنامه، نسخه، وضعیت گردش‌کار و تایم‌لاین بازبینی
                      </th>
                      <th className="py-3 px-3 w-36 whitespace-nowrap">طبقه و منبع سیگنال</th>
                      <th className="py-3 px-3 w-36 text-left whitespace-nowrap">
                        شناسه مدیا (ID)
                      </th>
                      <th className="py-3 px-3 w-36 whitespace-nowrap">وضعیت پخش</th>
                      <th className="py-3 px-3 w-52 text-center whitespace-nowrap">
                        عملیات چیدمان کنداکتور
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {paginatedScheduleItems.map((item) => {
                      const actualIdx = schedule.items.findIndex(
                        (i) => i.id === item.id
                      );
                      const rowAnomalies = itemAnomalyMap.get(item.id) || [];
                      const isCurrentOnAir =
                        activePlayoutState.currentItem?.id === item.id;
                      const catMeta = CATEGORY_META[item.category];
                      const srcMeta = SOURCE_META[item.source];
                      const statMeta = STATUS_META[item.status];
                      const wfStage =
                        item.workflowStatus || 'approved_for_playout';
                      const wfMeta = WORKFLOW_STAGE_META[wfStage];
                      const unresolvedMarkers = (item.qcMarkers || []).filter(
                        (m) => !m.resolved
                      ).length;

                      const cellPy = isCompactTable ? 'py-1.5' : 'py-2.5';

                      return (
                        <tr
                          id={`row-${item.id}`}
                          key={item.id}
                          className={`transition-colors group ${
                            isCurrentOnAir
                              ? 'bg-rose-950/25 hover:bg-rose-950/35 border-r-4 border-r-rose-500'
                              : rowAnomalies.length > 0
                              ? 'bg-rose-950/20 hover:bg-rose-950/30'
                              : item.lockStartTime
                              ? 'bg-amber-950/10 hover:bg-amber-950/20 border-r-2 border-r-amber-400/70'
                              : 'hover:bg-slate-900/60'
                          }`}
                        >
                          <td className={`${cellPy} px-3 text-center font-mono-tabular`}>
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-bold text-slate-300">
                                {item.order}
                              </span>
                              {item.lockStartTime && (
                                <span title="قفل رأس ساعت (ثابت)">
                                  <Lock className="w-3 h-3 text-amber-400" />
                                </span>
                              )}
                            </div>
                          </td>

                          <td className={`${cellPy} px-3 text-center font-mono-tabular font-semibold text-teal-300 whitespace-nowrap`}>
                            <div>{item.startTime}</div>
                            {item.lockStartTime && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-sans text-[9px] font-bold">
                                رأس ساعت (ثابت)
                              </span>
                            )}
                          </td>

                          <td className={`${cellPy} px-3 text-center font-mono-tabular text-amber-300/90 whitespace-nowrap`}>
                            {item.duration}
                          </td>

                          <td className={`${cellPy} px-3 text-center font-mono-tabular text-slate-300 whitespace-nowrap`}>
                            {item.endTime}
                          </td>

                          <td className={`${cellPy} px-4`}>
                            <div className="font-semibold text-slate-100 leading-snug flex flex-wrap items-center gap-2">
                              <span>{item.title}</span>
                              <span className="px-1.5 py-0.5 text-[10px] font-mono-tabular bg-slate-900 border border-slate-700 text-teal-300 rounded">
                                v{item.revisionVersion || 1}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-medium border rounded ${wfMeta.badgeClass}`}
                              >
                                {wfMeta.shortLabel}
                              </span>
                              {unresolvedMarkers > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setQcModalItem(item)}
                                  className="px-2 py-0.5 text-[10px] bg-rose-500/20 border border-rose-500/50 text-rose-300 rounded font-medium cursor-pointer"
                                >
                                  {unresolvedMarkers} اصلاحیه بازبین
                                </button>
                              )}
                              {(item.trimInSec ||
                                (item.trimOutSec &&
                                  item.sourceDurationSec &&
                                  item.trimOutSec < item.sourceDurationSec)) && (
                                <span className="px-2 py-0.5 text-[10px] bg-teal-950 border border-teal-500/40 text-teal-300 rounded font-mono-tabular">
                                  TRIM:{' '}
                                  {formatDurationTotal(item.trimInSec || 0)} -{' '}
                                  {formatDurationTotal(
                                    item.trimOutSec ||
                                      parseTimeToSeconds(item.duration)
                                  )}
                                </span>
                              )}
                            </div>

                            {!isCompactTable && (
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                                {item.episode && (
                                  <>
                                    <span className="text-slate-300">
                                      {item.episode}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                <span>{item.aspectRatio || '16:9 HD'}</span>
                                {item.notes && (
                                  <>
                                    <span aria-hidden="true">—</span>
                                    <span className="text-slate-400">
                                      {item.notes}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1">
                              <span>
                                تنظیم:{' '}
                                <strong className="text-sky-300/90 font-normal">
                                  {item.createdBy || 'خانم مرادی (واحد هماهنگی)'}
                                </strong>
                              </span>
                              {item.lastEditedBy && (
                                <>
                                  <span>·</span>
                                  <span>
                                    ویرایش:{' '}
                                    <strong className="text-teal-300/90 font-normal">
                                      {item.lastEditedBy}
                                      {item.lastEditedAt
                                        ? ` (${item.lastEditedAt})`
                                        : ''}
                                    </strong>
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className={`${cellPy} px-3 whitespace-nowrap`}>
                            <div className={`font-medium ${catMeta.colorClass}`}>
                              {catMeta.shortLabel}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {srcMeta.label}
                            </div>
                          </td>

                          <td
                            dir="ltr"
                            className={`${cellPy} px-3 text-left font-mono-tabular text-slate-200 whitespace-nowrap`}
                          >
                            <div>{item.mediaCode}</div>
                            <div className="text-[10px] text-slate-500">
                              {srcMeta.code}
                            </div>
                          </td>

                          <td className={`${cellPy} px-3 whitespace-nowrap`}>
                            <select
                              value={item.status}
                              disabled={
                                !currentRole.canChangePlayoutStatus &&
                                !currentRole.canApproveReject
                              }
                              onChange={(e) =>
                                handleChangeStatus(
                                  item.id,
                                  e.target.value as BroadcastStatus
                                )
                              }
                              className={`bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-[11px] font-medium focus:outline-none focus:border-teal-500 disabled:opacity-60 ${statMeta.colorClass}`}
                            >
                              <option value="ready">آماده پخش</option>
                              <option value="on_air">در نوبت / روی آنتن</option>
                              <option value="aired">پخش شده</option>
                              <option value="rejected">نیازمند اصلاح / رد</option>
                            </select>
                          </td>

                          <td className={`${cellPy} px-3 text-center whitespace-nowrap`}>
                            <div className="inline-flex items-center gap-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setQcModalItem(item)}
                                title="مشاهده پرونده و سوابق بازبینی"
                                className="px-2 py-1 text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                پرونده
                              </button>

                              <button
                                type="button"
                                onClick={() => setCertificateItem(item)}
                                title="چاپ گواهی بازبینی (QC)"
                                className="p-1.5 text-teal-300 hover:bg-slate-800 rounded-md transition-colors shrink-0 cursor-pointer"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>

                              {currentRole.canTrimPlayout && (
                                <button
                                  type="button"
                                  onClick={() => setTrimModalItem(item)}
                                  title="تنظیم محدوده زمانی پخش (Mark In / Out)"
                                  className="px-2 py-1 text-[11px] font-semibold bg-teal-500/15 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  تریم
                                </button>
                              )}

                              {(currentRole.canEditSchedule ||
                                currentRole.canTrimPlayout) && (
                                <button
                                  type="button"
                                  onClick={() => handleSplitProgramForAd(item)}
                                  title="تقسیم برنامه به ۲ بخش و درج باکس آگهی میان‌برنامه"
                                  className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                                >
                                  <SplitSquareHorizontal className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={!currentRole.canEditSchedule}
                                onClick={() => handleOpenAddModal(item.order)}
                                title="درج برنامه جدید بلافاصله بعد از این ردیف"
                                className="p-1.5 text-slate-400 hover:text-teal-300 hover:bg-slate-800 disabled:opacity-30 rounded-md transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                disabled={!currentRole.canEditSchedule}
                                onClick={() => {
                                  setIsAddingNew(false);
                                  setEditingItem(item);
                                }}
                                title="ویرایش برنامه"
                                className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 rounded-md transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                disabled={!currentRole.canLockTimes}
                                onClick={() => handleToggleLock(item.id)}
                                title="قفل کردن رأس ساعت"
                                className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-30 ${
                                  item.lockStartTime
                                    ? 'text-amber-400 bg-amber-950/40'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                {item.lockStartTime ? (
                                  <Lock className="w-3.5 h-3.5" />
                                ) : (
                                  <Unlock className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={
                                  !currentRole.canEditSchedule || actualIdx <= 0
                                }
                                onClick={() => handleMoveItem(actualIdx, 'up')}
                                className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-25 rounded-md transition-colors cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                disabled={
                                  !currentRole.canEditSchedule ||
                                  actualIdx >= schedule.items.length - 1
                                }
                                onClick={() =>
                                  handleMoveItem(actualIdx, 'down')
                                }
                                className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-25 rounded-md transition-colors cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                disabled={!currentRole.canDeleteItems}
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-25 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                currentPage={schedulePage}
                totalItems={filteredItems.length}
                pageSize={schedulePageSize}
                onPageChange={setSchedulePage}
                onPageSizeChange={setSchedulePageSize}
              />
            </section>
          </>
        )}
          </main>

          {/* Studio Workspace Bottom Status Bar (OS 26 Telemetry Bar) */}
          <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/75 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>شبکه داخلی (LAN Sync Active)</span>
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono-tabular text-slate-300">
                SMPTE 25fps PAL Non-Drop
              </span>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setIsWindowsGuideOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-teal-300 font-semibold cursor-pointer transition-colors"
              >
                <Terminal className="w-3 h-3" />
                <span>راهنمای استقرار LAN و کیوسک آنتن (.bat)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAllShortcutsModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-semibold cursor-pointer transition-colors"
              >
                <Keyboard className="w-3 h-3" />
                <span>شورتکات‌های سراسری میز کار</span>
              </button>
            </div>

            <span className="px-3 py-1 rounded-full bg-slate-900/80 border border-white/[0.08] text-teal-300 font-medium">
              طراح و برنامه‌نویس: شهاب‌الدین باقری دولت‌آبادی
            </span>
          </div>
        </div>
      </div>

      {/* OFFICIAL PRINTABLE 24-HOUR CONDUCTOR SHEET (.print-only) */}
      <section className="hidden print-only print-container p-4">
        <div className="border-b-2 border-black pb-3 mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">
              صدا و سیمای جمهوری اسلامی ایران — مرکز اصفهان ({schedule.channel})
            </h1>
            <p className="text-xs mt-0.5">
              برگه رسمی کنداکتور ۲۴ ساعته پخش، وضعیت بازبینی (QC) و پلی‌اوت —
              طراح سامانه: شهاب‌الدین باقری دولت‌آبادی
            </p>
            <p className="text-[11px] mt-1">
              نویسنده و تنظیم‌کننده کنداکتور:{' '}
              <strong>{schedule.createdBy || 'خانم مرادی (واحد هماهنگی)'}</strong>
              {schedule.lastEditedBy
                ? ` | آخرین ویرایش‌کننده: ${schedule.lastEditedBy} (${schedule.lastEditedAt || ''})`
                : ''}
            </p>
          </div>
          <div className="text-left text-xs font-mono-tabular">
            <div>
              روز و تاریخ: {schedule.dayOfWeek} {schedule.dateShamsi}
            </div>
            <div>تعداد کل برنامه‌ها: {schedule.items.length} ردیف</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ردیف</th>
              <th>ساعت شروع</th>
              <th>مدت خالص</th>
              <th>ساعت پایان</th>
              <th>عنوان برنامه و توضیحات رژی</th>
              <th>شناسه و نسخه</th>
              <th>بازه تریم (In - Out)</th>
              <th>وضعیت تأیید و پخش</th>
            </tr>
          </thead>
          <tbody>
            {schedule.items.map((item) => {
              const trimIn = item.trimInSec ?? 0;
              const trimOut =
                item.trimOutSec ??
                (item.sourceDurationSec || parseTimeToSeconds(item.duration));
              const wfLabel =
                WORKFLOW_STAGE_META[
                  item.workflowStatus || 'approved_for_playout'
                ].shortLabel;

              return (
                <tr key={item.id}>
                  <td className="text-center font-mono-tabular">{item.order}</td>
                  <td className="text-center font-mono-tabular">
                    {item.startTime}
                  </td>
                  <td className="text-center font-mono-tabular">
                    {item.duration}
                  </td>
                  <td className="text-center font-mono-tabular">
                    {item.endTime}
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    {item.episode ? ` (${item.episode})` : ''}
                    {item.notes ? ` — ${item.notes}` : ''}
                  </td>
                  <td className="text-center font-mono-tabular">
                    {item.mediaCode} (v{item.revisionVersion || 1})
                  </td>
                  <td className="text-center font-mono-tabular">
                    {formatDurationTotal(trimIn)} -{' '}
                    {formatDurationTotal(trimOut)}
                  </td>
                  <td className="text-center">{wfLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-black text-center text-xs">
          <div className="border border-black p-3">
            <div className="font-bold">واحد هماهنگی و کنداکتور</div>
            <div className="mt-1">{schedule.plannerName}</div>
            <div className="mt-6 text-[10px]">مهر و امضا</div>
          </div>
          <div className="border border-black p-3">
            <div className="font-bold">واحد بازبینی و کنترل کیفی (QC)</div>
            <div className="mt-1">مهندس کریمی</div>
            <div className="mt-6 text-[10px]">مهر و امضا</div>
          </div>
          <div className="border border-black p-3">
            <div className="font-bold">مسئول مدیریت پلی‌اوت و پایش</div>
            <div className="mt-1">{schedule.supervisorName}</div>
            <div className="mt-6 text-[10px]">مهر و امضا</div>
          </div>
          <div className="border border-black p-3">
            <div className="font-bold">مدیر پخش سیمای مرکز اصفهان</div>
            <div className="mt-1">{schedule.directorName || 'محمود فرشچیان'}</div>
            <div className="mt-6 text-[10px]">مهر و امضای نهایی</div>
          </div>
        </div>
      </section>

      {/* CLEAN FEED FULLSCREEN ANTENNA OUTPUT OVERLAY */}
      {cleanFeedFullscreen && activePlayoutState.currentItem && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-center items-center no-print">
          <div className="w-full h-full relative">
            {/* Slim Top Azan Readiness Bar on Fullscreen Antenna Output */}
            <div
              className={`absolute top-0 inset-x-0 z-30 px-5 py-1.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs backdrop-blur-md ${
                nextAzanStatus.isImminent
                  ? 'bg-amber-950/90 border-amber-400 text-amber-100'
                  : 'bg-slate-950/85 border-teal-500/40 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-teal-300">
                  آماده‌باش سوئیچ اذان ({nextAzanStatus.label}):
                </span>
                <span className="font-mono-tabular font-bold text-amber-300">
                  {nextAzanStatus.exactTime}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono-tabular">
                  مانده: {nextAzanStatus.remainingFormatted}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTomorrowAzanModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-500/40 rounded text-[11px] font-bold cursor-pointer"
                >
                  <CalendarClock className="w-3.5 h-3.5 text-amber-300" />
                  <span>پیش‌نمایش اوقات شرعی فردا</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCleanFeedFullscreen(false)}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded text-[11px] cursor-pointer"
                >
                  خروج از حالت خروجی آنتن (ESC)
                </button>
              </div>
            </div>

            <BroadcastVideoPlayer
              item={activePlayoutState.currentItem}
              currentTimeSec={
                (activePlayoutState.currentItem.trimInSec || 0) +
                Math.max(
                  0,
                  getEffectiveItemDurationSec(activePlayoutState.currentItem) -
                    activePlayoutState.remainingSec
                )
              }
              clockSec={clockSec}
              dayStartSec={parseTimeToSeconds(schedule.startTime || '06:00:00')}
              isPlaying={isClockRunning}
              enforceTrim={true}
              emergencyMode={emergencyMode}
              cleanFeedMode={true}
              onTimeChange={() => {}}
              onPlayStateChange={setIsClockRunning}
            />
          </div>
        </div>
      )}

      {/* MODALS */}
      <VideoPlayerShortcutsModal
        isOpen={isPlayerShortcutsModalOpen}
        onClose={() => setIsPlayerShortcutsModalOpen(false)}
        onShortcutsChanged={(updated) => setShortcuts(updated)}
      />

      <KeyboardShortcutsModal
        isOpen={isAllShortcutsModalOpen}
        onClose={() => setIsAllShortcutsModalOpen(false)}
        onShortcutsChanged={(updated) => setShortcuts(updated)}
      />

      <RolePinModal
        isOpen={Boolean(pendingPinRole)}
        targetRole={pendingPinRole}
        onClose={() => setPendingPinRole(null)}
        onAuthorized={(authorizedRole) => {
          setActiveRole(authorizedRole.id);
          setPendingPinRole(null);
          recordServerAudit({
            actionType: 'ROLE_AUTH',
            details: `ورود با احراز هویت محلی به نقش «${authorizedRole.title}»`,
          });
          showToast(
            `احراز هویت انجام شد — نقش فعال: «${authorizedRole.title} (${authorizedRole.personName})»`
          );
        }}
      />

      <RoleCredentialsModal
        isOpen={isRoleCredentialsModalOpen}
        canManageSecurity={Boolean(currentRole.canDirectorOverride)}
        onClose={() => setIsRoleCredentialsModalOpen(false)}
        onSavedToast={showToast}
      />

      <ScheduleArchiveModal
        isOpen={isArchiveModalOpen}
        currentSchedule={schedule}
        archivedList={archivedDays}
        canEditSchedule={currentRole.canEditSchedule}
        onClose={() => setIsArchiveModalOpen(false)}
        onSaveCurrentToArchive={handleArchiveCurrentSchedule}
        onRestoreArchivedSchedule={(restored) => {
          updateScheduleAndSync({
            ...restored,
            updatedAt: new Date().toISOString(),
          });
          showToast(
            `کنداکتور تاریخ ${restored.dateShamsi} از آرشیو محلی بازیابی شد.`
          );
        }}
        onCreateNewDaySchedule={(newDate, newDay, resetStat) => {
          saveScheduleToArchive(schedule);
          const actorFull = `${currentRole.personName} (${currentRole.title})`;
          const nextItems = schedule.items.map((it) => ({
            ...it,
            createdBy: actorFull,
            createdByRole: activeRole,
            lastEditedBy: undefined,
            lastEditedAt: undefined,
            status:
              resetStat && it.status === 'aired'
                ? ('ready' as const)
                : it.status,
            workflowStatus:
              resetStat && it.workflowStatus === 'aired'
                ? ('approved_for_playout' as const)
                : it.workflowStatus,
          }));
          const nextSched: ConductorSchedule = stampScheduleModification(
            {
              ...schedule,
              dateShamsi: newDate,
              dayOfWeek: newDay,
              items: nextItems,
            },
            'CREATED',
            `نگارش و ایجاد جدول کنداکتور روز جدید (${newDay} ${newDate}) توسط ${actorFull}`,
            true
          );
          updateScheduleAndSync(nextSched);
          setArchivedDays(getArchivedSchedules());
          showToast(
            `کنداکتور روز جدید (${newDay} ${newDate}) به نام «${actorFull}» ایجاد و ثبت شد.`
          );
        }}
        onArchiveListChanged={setArchivedDays}
      />

      <SystemAuditModal
        isOpen={isAuditModalOpen}
        schedule={schedule}
        onClose={() => setIsAuditModalOpen(false)}
      />

      <MediaLibraryModal
        isOpen={isMediaLibraryOpen}
        scheduleItems={schedule.items}
        canManageStorage={
          currentRole.canUploadMedia ||
          currentRole.canSendToQC ||
          currentRole.canTrimPlayout
        }
        onClose={() => setIsMediaLibraryOpen(false)}
        onAttachFileToScheduleItem={(itemId, videoUrl, fileName) => {
          const nextItems = schedule.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  videoUrl,
                  videoFileName: fileName,
                }
              : it
          );
          updateScheduleAndSync({
            ...schedule,
            items: nextItems,
            updatedAt: new Date().toISOString(),
          });
          showToast(
            `فایل «${fileName}» از مخزن محلی به ردیف انتخاب‌شده متصل شد.`
          );
        }}
      />

      <ItemEditorModal
        isOpen={Boolean(editingItem)}
        item={editingItem}
        isNew={isAddingNew}
        canLockTimes={currentRole.canLockTimes}
        canApproveReject={currentRole.canApproveReject}
        onClose={() => {
          setEditingItem(null);
          setIsAddingNew(false);
        }}
        onSave={handleSaveItem}
      />

      <VideoQCModal
        isOpen={Boolean(qcModalItem)}
        item={qcModalItem}
        currentRole={currentRole}
        onClose={() => setQcModalItem(null)}
        onSaveMarkersAndStage={handleSaveMarkersAndStage}
      />

      <PlayoutTrimModal
        isOpen={Boolean(trimModalItem)}
        item={trimModalItem}
        onClose={() => setTrimModalItem(null)}
        onApplyTrim={handleApplyPlayoutTrim}
        onSplitProgram={handleSplitProgramAtTimestamp}
      />

      <ProducerUploadModal
        isOpen={uploadModalOpen}
        existingItem={revisionTargetItem}
        defaultStartTime={
          schedule.items.length > 0
            ? schedule.items[schedule.items.length - 1].endTime
            : schedule.startTime
        }
        nextOrder={schedule.items.length + 1}
        onClose={() => {
          setUploadModalOpen(false);
          setRevisionTargetItem(null);
        }}
        onSubmitDelivery={handleProducerDelivery}
      />

      <QCCertificateModal
        isOpen={Boolean(certificateItem)}
        item={certificateItem}
        dateShamsi={schedule.dateShamsi}
        directorName={schedule.directorName || 'محمود فرشچیان'}
        plannerName={schedule.plannerName}
        onClose={() => setCertificateItem(null)}
      />

      <ShiftHandoverModal
        isOpen={isHandoverModalOpen}
        schedule={schedule}
        onClose={() => setIsHandoverModalOpen(false)}
        onSaveShiftReport={(notes, nextSup) => {
          updateScheduleAndSync({
            ...schedule,
            notes,
            supervisorName: nextSup,
            updatedAt: new Date().toISOString(),
          });
          showToast('صورتجلسه تحویل شیفت نظارت و پلی‌اوت ثبت شد.');
        }}
      />

      <WindowsGuideModal
        isOpen={isWindowsGuideOpen}
        onClose={() => setIsWindowsGuideOpen(false)}
        onExportJson={handleExportJson}
      />

      <TomorrowAzanPreviewModal
        isOpen={isTomorrowAzanModalOpen}
        baseDateGregorian={schedule.dateGregorian || '2026-10-04'}
        baseDateJalali={schedule.dateShamsi}
        onClose={() => setIsTomorrowAzanModalOpen(false)}
        onApplyTomorrowAzanToSchedule={
          currentRole.canEditSchedule || currentRole.canTrimPlayout
            ? (tomorrowTimes) => {
                const dhuhrPreStart = formatSecondsToTime(
                  Math.max(0, parseTimeToSeconds(tomorrowTimes.dhuhr) - 300)
                );
                const maghribPreStart = formatSecondsToTime(
                  Math.max(0, parseTimeToSeconds(tomorrowTimes.maghrib) - 300)
                );
                const nextItems = schedule.items.map((it) => {
                  if (
                    it.category === 'religious' &&
                    (it.title.includes('ظهر') ||
                      parseTimeToSeconds(it.startTime) < 15 * 3600)
                  ) {
                    return {
                      ...it,
                      startTime: dhuhrPreStart,
                      endTime: computeEndTime(dhuhrPreStart, it.duration),
                      lockStartTime: true,
                      notes: `باکس اذان ظهر به افق اصفهان (اذان دقیق: ${tomorrowTimes.dhuhr})`,
                    };
                  }
                  if (
                    it.category === 'religious' &&
                    (it.title.includes('مغرب') ||
                      parseTimeToSeconds(it.startTime) >= 15 * 3600)
                  ) {
                    return {
                      ...it,
                      startTime: maghribPreStart,
                      endTime: computeEndTime(maghribPreStart, it.duration),
                      lockStartTime: true,
                      notes: `باکس اذان مغرب به افق اصفهان (اذان دقیق: ${tomorrowTimes.maghrib})`,
                    };
                  }
                  return it;
                });
                const recalculated = recalculateScheduleItems(
                  nextItems,
                  schedule.startTime,
                  true
                );
                updateScheduleAndSync({
                  ...schedule,
                  items: recalculated,
                  updatedAt: new Date().toISOString(),
                });
                setIsTomorrowAzanModalOpen(false);
                showToast(
                  `باکس‌های اذان کنداکتور با اوقات شرعی روز آینده (ظهر: ${tomorrowTimes.dhuhr} | مغرب: ${tomorrowTimes.maghrib}) همگام‌سازی و قفل شدند.`
                );
              }
            : undefined
        }
      />

      {/* Floating System Health Widget in Bottom-Right Corner */}
      <SystemHealthWidget
        totalItemsCount={schedule.items.length}
        lastScheduleUpdate={schedule.updatedAt}
        emergencyModeActive={emergencyMode !== 'normal'}
      />
    </div>
  );
}
