'use client';

import React, { useState, useMemo } from 'react';
import {
  AccessRoleLevel,
  RoleDefinition,
  ROLES,
  ScheduleItem,
  WorkflowStage,
  QCMarker,
  QCMarkerCategory,
  QCMarkerSeverity,
  WORKFLOW_STAGE_META,
  QC_CATEGORY_META,
  parseTimeToSeconds,
  formatDurationTotal,
  formatSecondsToTime,
  isItemApprovedForPlayout,
} from '@/lib/conductor-data';
import BroadcastVideoPlayer from './BroadcastVideoPlayer';
import {
  ShieldCheck,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Play,
  Activity,
  Flag,
  Sun,
  BellRing,
  CalendarClock,
  ChevronRight,
  ChevronLeft,
  KeyRound,
  Layers,
} from 'lucide-react';

/**
 * ============================================================================
 * REUSABLE PAGINATION COMPONENT FOR ALL TABLES & PORTAL LISTS
 * ============================================================================
 */
interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
      <div className="flex items-center gap-3">
        <span className="font-mono-tabular">
          ردیف <strong className="text-slate-200">{startIdx}</strong> تا{' '}
          <strong className="text-slate-200">{endIdx}</strong> از{' '}
          <strong className="text-teal-300">{totalItems}</strong>
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-slate-200 text-[11px] focus:outline-none"
          >
            <option value={5}>۵ ردیف</option>
            <option value={8}>۸ ردیف</option>
            <option value={10}>۱۰ ردیف</option>
            <option value={15}>۱۵ ردیف</option>
            <option value={35}>نمایش همه</option>
          </select>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 cursor-pointer transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span>قبلی</span>
          </button>

          <div className="flex items-center gap-1 px-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`w-7 h-7 rounded-md font-mono-tabular text-xs cursor-pointer transition-colors ${
                  p === safePage
                    ? 'bg-teal-400 text-slate-950 font-bold'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 cursor-pointer transition-colors"
          >
            <span>بعدی</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * ============================================================================
 * DEBUGGED AGENT PROMPT (SPECIFICATION IN CODE FORMAT)
 * ============================================================================
 */
export const AGENT_DEBUGGED_SPEC = {
  landingGateway: {
    route: '/',
    initialState: 'authenticatedRole = null',
    authMechanism:
      'هر کاربر روی نقش سازمانی خود کلیک کرده و مستقیماً وارد پرتال ایزوله و صفحه‌بندی‌شده همان نقش می‌شود.',
    logoutAction:
      'دکمه «خروج و بازگشت به صفحه اصلی» در هدر تمام صفحات که authenticatedRole را به null برمی‌گرداند.',
  },
  isolatedRolePortals: {
    level_1_director: {
      roleName: 'مدیر پخش',
      allowedPages: [
        'DIRECTOR_DECISION_CENTER',
        'LIVE_ALL_UNITS_MONITOR',
        'CONDUCTOR_24H_MASTER',
        'PLAYOUT_AND_AUDIT',
      ],
    },
    producer_editor: {
      roleName: 'تهیه‌کننده و تدوینگر',
      allowedPages: ['PRODUCER_SUBMISSION_AND_STATUS_PORTAL'],
    },
    level_2_coordination: {
      roleName: 'واحد هماهنگی',
      allowedPages: ['COORDINATION_WORKFLOW_AND_SCHEDULE_PORTAL'],
    },
    qc_inspector: {
      roleName: 'بازبین (QC)',
      allowedPages: ['QC_INSPECTION_PORTAL'],
    },
    level_3_playout_manager: {
      roleName: 'مسئول مدیریت پلی‌اوت',
      allowedPages: ['PLAYOUT_MANAGEMENT_PORTAL'],
    },
    operator_monitor: {
      roleName: 'اپراتور پایش پخش',
      allowedPages: ['READ_ONLY_MONITORING_PORTAL'],
    },
  },
} as const;

export interface BroadcastExecutionIncident {
  id: string;
  itemOrder: number;
  itemTitle: string;
  mediaCode: string;
  timecodeAtReport: string;
  category:
    | 'audio_drop'
    | 'switch_delay'
    | 'frame_freeze'
    | 'cg_mismatch'
    | 'file_error';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  reportedBy: string;
  reportedAt: string;
  status: 'open' | 'investigating' | 'resolved';
  resolutionNote?: string;
}

/**
 * ============================================================================
 * 1. LANDING GATEWAY (Spatial Broadcast OS Role Selector)
 * ============================================================================
 */
interface LandingRoleGatewayProps {
  channelTitle: string;
  dateShamsi: string;
  dayOfWeek: string;
  clockSec: number;
  requirePinOnLogin?: boolean;
  onToggleRequirePin?: (enabled: boolean) => void;
  onAuthenticated: (role: RoleDefinition) => void;
}

const ROLE_SIGNAL_THEME: Record<
  AccessRoleLevel,
  {
    icon: React.ReactNode;
    topBarGradient: string;
    iconBoxClass: string;
    hoverBorderClass: string;
    accentTextClass: string;
    groupHoverTextClass: string;
  }
> = {
  level_1: {
    icon: <ShieldCheck className="w-4 h-4 text-teal-300" />,
    topBarGradient: 'from-teal-400 via-teal-500/60 to-transparent',
    iconBoxClass:
      'bg-teal-500/10 border-teal-400/30 shadow-[0_0_15px_-3px_rgba(45,212,191,0.3)]',
    hoverBorderClass: 'hover:border-teal-400/45',
    accentTextClass: 'text-teal-300',
    groupHoverTextClass: 'group-hover:text-teal-300',
  },
  level_2: {
    icon: <CalendarClock className="w-4 h-4 text-sky-300" />,
    topBarGradient: 'from-sky-400 via-sky-500/60 to-transparent',
    iconBoxClass:
      'bg-sky-500/10 border-sky-400/30 shadow-[0_0_15px_-3px_rgba(56,189,248,0.3)]',
    hoverBorderClass: 'hover:border-sky-400/45',
    accentTextClass: 'text-sky-300',
    groupHoverTextClass: 'group-hover:text-sky-300',
  },
  qc_inspector: {
    icon: <Eye className="w-4 h-4 text-amber-300" />,
    topBarGradient: 'from-amber-400 via-amber-500/60 to-transparent',
    iconBoxClass:
      'bg-amber-500/10 border-amber-400/30 shadow-[0_0_15px_-3px_rgba(251,291,36,0.3)]',
    hoverBorderClass: 'hover:border-amber-400/45',
    accentTextClass: 'text-amber-300',
    groupHoverTextClass: 'group-hover:text-amber-300',
  },
  level_3: {
    icon: <Play className="w-4 h-4 text-rose-300" />,
    topBarGradient: 'from-rose-500 via-rose-500/60 to-transparent',
    iconBoxClass:
      'bg-rose-500/10 border-rose-400/35 shadow-[0_0_15px_-3px_rgba(244,63,94,0.35)]',
    hoverBorderClass: 'hover:border-rose-400/50',
    accentTextClass: 'text-rose-300',
    groupHoverTextClass: 'group-hover:text-rose-300',
  },
  operator: {
    icon: <Activity className="w-4 h-4 text-indigo-300" />,
    topBarGradient: 'from-indigo-400 via-indigo-500/60 to-transparent',
    iconBoxClass:
      'bg-indigo-500/10 border-indigo-400/30 shadow-[0_0_15px_-3px_rgba(129,140,248,0.3)]',
    hoverBorderClass: 'hover:border-indigo-400/45',
    accentTextClass: 'text-indigo-300',
    groupHoverTextClass: 'group-hover:text-indigo-300',
  },
  producer_editor: {
    icon: <Upload className="w-4 h-4 text-emerald-300" />,
    topBarGradient: 'from-emerald-400 via-emerald-500/60 to-transparent',
    iconBoxClass:
      'bg-emerald-500/10 border-emerald-400/30 shadow-[0_0_15px_-3px_rgba(52,211,153,0.3)]',
    hoverBorderClass: 'hover:border-emerald-400/45',
    accentTextClass: 'text-emerald-300',
    groupHoverTextClass: 'group-hover:text-emerald-300',
  },
};

export function LandingRoleGateway({
  channelTitle,
  dateShamsi,
  dayOfWeek,
  clockSec,
  requirePinOnLogin = false,
  onToggleRequirePin,
  onAuthenticated,
}: LandingRoleGatewayProps) {
  return (
    <div
      id="landing-gateway"
      className="min-h-screen text-slate-200 flex flex-col justify-between"
    >
      {/* Spatial Broadcast OS Specular Glass Top Bar (3-Zone Contract) */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-8">
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.8)]" />
            <span>شبکه اصفهان</span>
          </span>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
            <span>اتوماسیون تولید، بازبینی (QC)، کنداکتور و پلی‌اوت</span>
            <span aria-hidden="true">·</span>
            <span className="text-teal-300 font-medium">
              {dayOfWeek} {dateShamsi}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 text-xs font-mono-tabular text-slate-200">
            <span className="text-slate-400 font-sans text-[11px]">
              ساعت استودیو
            </span>
            <span
              suppressHydrationWarning
              className="px-3 py-1 rounded-full bg-slate-950/95 border border-teal-500/30 font-semibold tracking-wider text-teal-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
            >
              {formatSecondsToTime(clockSec)}
            </span>
          </div>
        </div>
      </header>

      {/* Spatial Broadcast OS Role Selection Grid */}
      <main className="max-w-5xl w-full mx-auto px-6 py-10 my-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-lg font-semibold text-white">
              انتخاب واحد عملیاتی و ورود به محیط کاری
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {channelTitle || 'کنداکتور ۲۴ ساعته پخش شبکه اصفهان'} · صدا و سیمای
              مرکز اصفهان
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onToggleRequirePin && (
              <button
                type="button"
                onClick={() => onToggleRequirePin(!requirePinOnLogin)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  requirePinOnLogin
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  {requirePinOnLogin
                    ? 'قفل پین‌کد امنیتی فعال'
                    : 'ورود مستقیم شیفت (امکان فعال‌سازی پین‌کد)'}
                </span>
              </button>
            )}
            <span className="text-xs text-teal-300 font-medium">
              ۶ واحد ایزوله سازمانی
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLES.map((role, index) => {
            const theme = ROLE_SIGNAL_THEME[role.id] || ROLE_SIGNAL_THEME.level_1;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => onAuthenticated(role)}
                className={`group relative overflow-hidden p-5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 ${theme.hoverBorderClass} text-right transition-all cursor-pointer flex flex-col justify-between gap-5`}
              >
                {/* 2px Signal Top Bar */}
                <div
                  className={`absolute top-0 inset-x-0 h-0.5 w-full bg-gradient-to-l ${theme.topBarGradient}`}
                />

                <div className="space-y-3 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${theme.iconBoxClass}`}
                    >
                      {theme.icon}
                    </div>
                    <span
                      className={`text-[11px] font-mono-tabular text-slate-400 transition-colors ${theme.groupHoverTextClass}`}
                    >
                      0{index + 1} · {role.levelLabel}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-slate-100 group-hover:text-white">
                      {role.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {role.department} · {role.personName}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-slate-800/90">
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950/75 border border-white/[0.06]">
                    <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>آماده به کار در شبکه محلی</span>
                    </span>
                    <span className="font-mono-tabular text-slate-400">
                      {role.inboxStages.length} گام عملیاتی
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-100">
                    <span>ورود به کارتابل اختصاصی</span>
                    <span
                      aria-hidden="true"
                      className={`transition-transform group-hover:-translate-x-1 ${theme.accentTextClass}`}
                    >
                      ←
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* Minimal Quiet Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/80 px-6 py-4 text-xs text-slate-400">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            سامانه آفلاین مدیریت تولید، هماهنگی، بازبینی (QC)، کنداکتور و پلی‌اوت
            شبکه اصفهان
          </span>
          <span className="text-teal-300 font-medium">
            طراح و برنامه‌نویس: شهاب‌الدین باقری دولت‌آبادی
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * ============================================================================
 * 2. PRODUCER & EDITOR ISOLATED PORTAL (Sub-tabbed + Paginated)
 * ============================================================================
 */
interface ProducerPortalProps {
  items: ScheduleItem[];
  currentRole: RoleDefinition;
  onOpenNewUpload: () => void;
  onOpenRevisionUpload: (item: ScheduleItem) => void;
}

export function ProducerSubmissionAndStatusPortal({
  items,
  currentRole,
  onOpenNewUpload,
  onOpenRevisionUpload,
}: ProducerPortalProps) {
  const producerOwnItems = useMemo(() => {
    return items.filter(
      (it) =>
        Boolean(it.producerName) ||
        (it.versions && it.versions.length > 0) ||
        it.workflowStatus === 'uploaded_by_producer' ||
        it.workflowStatus === 'in_qc_review' ||
        it.workflowStatus === 'qc_needs_revision' ||
        it.workflowStatus === 'referred_to_director' ||
        it.workflowStatus === 'rejected_by_director' ||
        it.workflowStatus === 'returned_to_producer'
    );
  }, [items]);

  const [subTab, setSubTab] = useState<'my_list' | 'defect_player'>('my_list');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  const [selectedDefectItemId, setSelectedDefectItemId] = useState<
    string | null
  >(null);
  const [playerTimeSec, setPlayerTimeSec] = useState<number>(0);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState<boolean>(false);

  const activeDefectItem = useMemo(
    () =>
      producerOwnItems.find((i) => i.id === selectedDefectItemId) ||
      producerOwnItems.find((i) => (i.qcMarkers || []).length > 0) ||
      producerOwnItems[0] ||
      null,
    [producerOwnItems, selectedDefectItemId]
  );

  const paginatedProducerItems = useMemo(() => {
    const safePage = Math.min(
      page,
      Math.max(1, Math.ceil(producerOwnItems.length / pageSize))
    );
    const start = (safePage - 1) * pageSize;
    return producerOwnItems.slice(start, start + pageSize);
  }, [producerOwnItems, page, pageSize]);

  const getProducerStepIndex = (stage?: WorkflowStage): number => {
    switch (stage) {
      case 'uploaded_by_producer':
        return 1;
      case 'in_qc_review':
        return 2;
      case 'referred_to_director':
        return 3;
      case 'qc_needs_revision':
      case 'rejected_by_director':
      case 'returned_to_producer':
        return 4;
      default:
        return 5;
    }
  };

  const PIPELINE_STEPS = [
    { step: 1, title: '۱. تحویل به هماهنگی' },
    { step: 2, title: '۲. در حال بازبینی (QC)' },
    { step: 3, title: '۳. بررسی مدیر پخش' },
    { step: 4, title: '۴. نیازمند اصلاح' },
    { step: 5, title: '۵. تأیید نهایی و پلی‌اوت' },
  ];

  return (
    <section id="producer-submission-portal" className="space-y-4">
      {/* Sub-Navigation Bar (OS 26 Segmented Pill Control) & Primary Upload Action */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/[0.08] shadow-inner">
          <button
            type="button"
            onClick={() => setSubTab('my_list')}
            className={`px-3.5 py-2 text-xs font-bold cursor-pointer transition-all ${
              subTab === 'my_list'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            ۱. لیست برنامه‌های ارسالی من ({producerOwnItems.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('defect_player')}
            className={`px-3.5 py-2 text-xs font-bold cursor-pointer transition-all ${
              subTab === 'defect_player'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-amber-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            ۲. پلیر بازبینی تایم‌کد ایرادات و بارگذاری نسخه اصلاحی
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenNewUpload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>بارگذاری برنامه جدید (نسخه v1)</span>
        </button>
      </div>

      {subTab === 'my_list' ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
          {paginatedProducerItems.map((item) => {
            const stage = item.workflowStatus || 'approved_for_playout';
            const stageMeta = WORKFLOW_STAGE_META[stage];
            const activeStep = getProducerStepIndex(stage);
            const markers = item.qcMarkers || [];
            const needsRevision = activeStep === 4;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-colors space-y-3 ${
                  needsRevision
                    ? 'bg-rose-950/20 border-rose-500/50'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-teal-500/15 border border-teal-500/40 rounded text-xs font-mono-tabular font-bold text-teal-300">
                        v{item.revisionVersion || 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100">
                        {item.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold border rounded ${stageMeta.badgeClass}`}
                      >
                        {stageMeta.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span className="font-mono-tabular text-teal-300">
                        کد: {item.mediaCode}
                      </span>
                      <span>مدت: {item.duration}</span>
                      <span>
                        تحویل‌دهنده: {item.producerName || currentRole.personName}
                      </span>
                    </div>

                    {item.versions && item.versions.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                        <span className="text-slate-400 font-medium">
                          سوابق نسخه‌ها ({item.versions.length} نسخه):
                        </span>
                        {item.versions.map((ver, idx) => (
                          <span
                            key={ver.versionNumber}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono-tabular ${
                              ver.versionNumber === (item.revisionVersion || 1)
                                ? 'bg-teal-500/20 border-teal-400 text-teal-300 font-bold'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            <span>v{ver.versionNumber}</span>
                            <span className="text-[10px] text-slate-400">
                              ({ver.uploadedAt || 'ثبت‌شده'})
                            </span>
                            {idx < item.versions!.length - 1 && (
                              <span className="text-slate-500">←</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {markers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDefectItemId(item.id);
                          setPlayerTimeSec(markers[0]?.timeSec || 0);
                          setIsPlayerPlaying(false);
                          setSubTab('defect_player');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>مشاهده ایرادات در پلیر ({markers.length})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenRevisionUpload(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        بارگذاری نسخه اصلاح‌شده (v
                        {(item.revisionVersion || 1) + 1})
                      </span>
                    </button>
                  </div>
                </div>

                {/* Compact 5-Stage Pipeline */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {PIPELINE_STEPS.map((st) => {
                    const isCurrent = st.step === activeStep;
                    const isPassed =
                      (activeStep === 5 && st.step < 5 && st.step !== 4) ||
                      (activeStep < 4 && st.step < activeStep);
                    const isRevisionStep = st.step === 4 && needsRevision;

                    return (
                      <div
                        key={st.step}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-1 ${
                          isRevisionStep
                            ? 'bg-rose-500/20 border-rose-400 text-rose-200 font-bold'
                            : isCurrent
                            ? 'bg-teal-500/20 border-teal-400 text-teal-200 font-bold'
                            : isPassed
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-900/60 border-slate-800 text-slate-500'
                        }`}
                      >
                        <span className="truncate">{st.title}</span>
                        {isPassed && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <PaginationControls
            currentPage={page}
            totalItems={producerOwnItems.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-amber-500/40 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">انتخاب برنامه:</span>
              <select
                value={activeDefectItem?.id || ''}
                onChange={(e) => {
                  setSelectedDefectItemId(e.target.value);
                  setPlayerTimeSec(0);
                  setIsPlayerPlaying(false);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
              >
                {producerOwnItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.title} (v{it.revisionVersion || 1}) —{' '}
                    {(it.qcMarkers || []).length} مورد اصلاحیه
                  </option>
                ))}
              </select>
            </div>

            {activeDefectItem && (
              <button
                type="button"
                onClick={() => onOpenRevisionUpload(activeDefectItem)}
                className="px-3.5 py-1.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
              >
                بارگذاری نسخه اصلاح‌شده جدید (v
                {(activeDefectItem.revisionVersion || 1) + 1})
              </button>
            )}
          </div>

          {activeDefectItem && (
            <>
              {(activeDefectItem.qcMarkers || []).length > 0 && (
                <div className="p-3 bg-slate-950 border border-rose-500/40 rounded-lg space-y-2">
                  <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>
                      روی هر تایم‌کد کلیک کنید تا پلیر به همان ثانیه ایراد پرش
                      کند:
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(activeDefectItem.qcMarkers || []).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPlayerTimeSec(m.timeSec);
                          setIsPlayerPlaying(false);
                        }}
                        className="p-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-right flex items-center justify-between gap-2 text-xs cursor-pointer"
                      >
                        <span className="truncate text-slate-200">
                          <strong className="text-amber-300 ml-1">
                            [{QC_CATEGORY_META[m.category].label}]
                          </strong>
                          {m.note}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono-tabular shrink-0">
                          {m.timecode}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <BroadcastVideoPlayer
                item={activeDefectItem}
                currentTimeSec={playerTimeSec}
                isPlaying={isPlayerPlaying}
                onTimeChange={setPlayerTimeSec}
                onPlayStateChange={setIsPlayerPlaying}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * ============================================================================
 * 3. COORDINATION UNIT PORTAL (Sub-tabbed: Action Queues vs Tracking Board)
 * ============================================================================
 */
interface CoordinationPortalHeaderProps {
  items: ScheduleItem[];
  createdBy?: string;
  lastEditedBy?: string;
  lastEditedAt?: string;
  onTransitionStage: (
    itemId: string,
    markers: QCMarker[],
    nextStage: WorkflowStage,
    comment: string
  ) => void;
  onOpenQCModal: (item: ScheduleItem) => void;
  onOpenConductorTable?: () => void;
  onAddNewConductorItem?: () => void;
}

export function CoordinationWorkflowPortal({
  items,
  createdBy,
  lastEditedBy,
  lastEditedAt,
  onTransitionStage,
  onOpenQCModal,
  onOpenConductorTable,
  onAddNewConductorItem,
}: CoordinationPortalHeaderProps) {
  const [coordSubTab, setCoordSubTab] = useState<
    'action_queues' | 'tracking_board'
  >('action_queues');
  const [selectedInspector, setSelectedInspector] = useState<string>(
    'مهندس کریمی (بازبین فنی و محتوایی)'
  );

  const uploadedByProducerItems = items.filter(
    (i) => i.workflowStatus === 'uploaded_by_producer'
  );
  const revisionReturnItems = items.filter(
    (i) =>
      i.workflowStatus === 'rejected_by_director' ||
      i.workflowStatus === 'qc_needs_revision'
  );
  const readyForPlayoutDispatchItems = items.filter(
    (i) =>
      i.workflowStatus === 'qc_approved' ||
      i.workflowStatus === 'approved_by_director'
  );

  const inQcItems = items.filter((i) => i.workflowStatus === 'in_qc_review');
  const inDirectorItems = items.filter(
    (i) =>
      i.workflowStatus === 'referred_to_director' ||
      i.workflowStatus === 'qc_needs_revision'
  );
  const atProducerItems = items.filter(
    (i) => i.workflowStatus === 'returned_to_producer'
  );
  const inPlayoutQueueItems = items.filter((i) => isItemApprovedForPlayout(i));

  return (
    <section id="coordination-workflow-portal" className="space-y-4">
      {/* Sub-tab selector for Coordination (OS 26 Segmented Pill Control) + Conductor Authoring Access */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/[0.08] shadow-inner">
          <button
            type="button"
            onClick={() => setCoordSubTab('action_queues')}
            className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-all ${
              coordSubTab === 'action_queues'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            ۱. کارتابل ارجاع و اقدام هماهنگی (
            {uploadedByProducerItems.length +
              revisionReturnItems.length +
              readyForPlayoutDispatchItems.length}{' '}
            مورد)
          </button>
          <button
            type="button"
            onClick={() => setCoordSubTab('tracking_board')}
            className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-all ${
              coordSubTab === 'tracking_board'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            ۲. تابلوی رهگیری پرونده‌های در گردش در واحدها
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-white/[0.07] text-[11px]">
            <span className="text-slate-400">تنظیم‌کننده کنداکتور:</span>
            <span className="font-bold text-sky-300">
              {createdBy || 'خانم مرادی (واحد هماهنگی)'}
            </span>
            {lastEditedBy && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">آخرین ویرایش:</span>
                <span className="font-bold text-teal-300">
                  {lastEditedBy}
                  {lastEditedAt ? ` (${lastEditedAt})` : ''}
                </span>
              </>
            )}
          </div>

          {onAddNewConductorItem && (
            <button
              type="button"
              onClick={onAddNewConductorItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold text-xs cursor-pointer transition-colors"
            >
              <span>+ درج باکس جدید در کنداکتور</span>
            </button>
          )}

          {onOpenConductorTable && (
            <button
              type="button"
              onClick={onOpenConductorTable}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>نگارش و چیدمان جدول کنداکتور ۲۴ ساعته ({items.length} ردیف)</span>
            </button>
          )}
        </div>
      </div>

      {coordSubTab === 'action_queues' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Queue 1: Producer Uploads -> Refer to QC */}
          <div className="bg-slate-900/80 border border-sky-500/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-sky-300">
                ۱. دریافتی از تهیه‌کننده (ارجاع به بازبین)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 font-mono-tabular text-xs font-bold">
                {uploadedByProducerItems.length}
              </span>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>بازبین مقصد:</span>
              <select
                value={selectedInspector}
                onChange={(e) => setSelectedInspector(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[11px]"
              >
                <option value="مهندس کریمی (بازبین فنی و محتوایی)">
                  مهندس کریمی (بازبین فنی و محتوایی)
                </option>
                <option value="مهندس طاهری (بازبین شیفت عصر)">
                  مهندس طاهری (بازبین شیفت عصر)
                </option>
              </select>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {uploadedByProducerItems.length === 0 ? (
                <div className="p-4 bg-slate-950/60 border border-white/[0.06] rounded-xl text-xs text-slate-400 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400/70 mx-auto mb-1.5" />
                  <span>موردی در انتظار ارجاع به بازبین نیست.</span>
                </div>
              ) : (
                uploadedByProducerItems.map((it) => (
                  <div
                    key={it.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono-tabular text-slate-400 border-b border-slate-800/80 pb-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 font-sans font-semibold">
                        ردیف {it.order}
                      </span>
                      <span className="text-teal-300 font-bold">{it.startTime}</span>
                      <span>{it.mediaCode}</span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 font-bold">
                        v{it.revisionVersion || 1}
                      </span>
                    </div>
                    <div className="font-bold text-slate-100">{it.title}</div>
                    <div className="text-[11px] text-slate-400">
                      تهیه‌کننده: {it.producerName || 'واحد تولید'} | مدت: {it.duration}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onTransitionStage(
                          it.id,
                          it.qcMarkers || [],
                          'in_qc_review',
                          `ارجاع نسخه v${
                            it.revisionVersion || 1
                          } توسط هماهنگی به ${selectedInspector}`
                        )
                      }
                      className="w-full py-1.5 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold rounded-md cursor-pointer"
                    >
                      ارجاع به بازبین مربوط (QC)
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Queue 2: Needs Revision -> Return to Producer */}
          <div className="bg-slate-900/80 border border-rose-500/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-rose-300">
                ۲. دارای دستور اصلاح (عودت به تهیه‌کننده)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 font-mono-tabular text-xs font-bold">
                {revisionReturnItems.length}
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {revisionReturnItems.length === 0 ? (
                <div className="p-4 bg-slate-950/60 border border-white/[0.06] rounded-xl text-xs text-slate-400 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400/70 mx-auto mb-1.5" />
                  <span>پرونده‌ای جهت عودت به تهیه‌کننده وجود ندارد.</span>
                </div>
              ) : (
                revisionReturnItems.map((it) => (
                  <div
                    key={it.id}
                    className="p-3 bg-slate-950 border border-rose-500/30 rounded-lg space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono-tabular text-slate-400 border-b border-slate-800/80 pb-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 font-sans font-semibold">
                        ردیف {it.order}
                      </span>
                      <span className="text-teal-300 font-bold">{it.startTime}</span>
                      <span>{it.mediaCode}</span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-bold">
                        v{it.revisionVersion || 1}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-slate-100">
                      <span>{it.title}</span>
                      <span className="text-rose-300 text-[11px] shrink-0">
                        {(it.qcMarkers || []).length} ایراد تایم‌کددار
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onTransitionStage(
                            it.id,
                            it.qcMarkers || [],
                            'returned_to_producer',
                            'عودت پرونده دارای دستور اصلاح از واحد هماهنگی به تهیه‌کننده و تدوینگر'
                          )
                        }
                        className="flex-1 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-md cursor-pointer"
                      >
                        عودت به تهیه‌کننده
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenQCModal(it)}
                        className="px-2.5 py-1.5 bg-slate-800 text-slate-200 rounded-md cursor-pointer"
                      >
                        ایرادات
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Queue 3: Approved -> Send to Playout Queue */}
          <div className="bg-slate-900/80 border border-emerald-500/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-emerald-300">
                ۳. تأییدشده (ارسال به صف پلی‌اوت)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 font-mono-tabular text-xs font-bold">
                {readyForPlayoutDispatchItems.length}
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {readyForPlayoutDispatchItems.length === 0 ? (
                <div className="p-4 bg-slate-950/60 border border-white/[0.06] rounded-xl text-xs text-slate-400 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400/70 mx-auto mb-1.5" />
                  <span>موردی در انتظار ارسال به صف پلی‌اوت نیست.</span>
                </div>
              ) : (
                readyForPlayoutDispatchItems.map((it) => (
                  <div
                    key={it.id}
                    className="p-3 bg-slate-950 border border-emerald-500/30 rounded-lg space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono-tabular text-slate-400 border-b border-slate-800/80 pb-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 font-sans font-semibold">
                        ردیف {it.order}
                      </span>
                      <span className="text-teal-300 font-bold">{it.startTime}</span>
                      <span>{it.mediaCode}</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold">
                        v{it.revisionVersion || 1}
                      </span>
                    </div>
                    <div className="font-bold text-slate-100">{it.title}</div>
                    <div className="text-[11px] text-slate-400">
                      ساعت کنداکتور: {it.startTime} | مدت: {it.duration}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onTransitionStage(
                          it.id,
                          it.qcMarkers || [],
                          'approved_for_playout',
                          `ارسال نهایی نسخه v${
                            it.revisionVersion || 1
                          } از واحد هماهنگی به صف مدیریت پلی‌اوت`
                        )
                      }
                      className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-md cursor-pointer"
                    >
                      ارسال به صف برنامه‌ریزی و پلی‌اوت
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-slate-950 border border-amber-500/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between font-bold text-amber-300">
                <span>نزد بازبین (در حال QC)</span>
                <span className="font-mono-tabular">{inQcItems.length}</span>
              </div>
              {inQcItems.map((it) => (
                <div
                  key={it.id}
                  className="p-2 bg-slate-900 rounded flex items-center justify-between"
                >
                  <span className="truncate">{it.title}</span>
                  <span className="text-[10px] font-mono-tabular text-teal-300">
                    v{it.revisionVersion || 1}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-slate-950 border border-purple-500/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between font-bold text-purple-300">
                <span>در کارتابل مدیر پخش</span>
                <span className="font-mono-tabular">
                  {inDirectorItems.length}
                </span>
              </div>
              {inDirectorItems.map((it) => (
                <div
                  key={it.id}
                  className="p-2 bg-slate-900 rounded flex items-center justify-between"
                >
                  <span className="truncate">{it.title}</span>
                  <span className="text-[10px] text-amber-300">
                    {
                      WORKFLOW_STAGE_META[it.workflowStatus || 'in_qc_review']
                        .shortLabel
                    }
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-slate-950 border border-rose-500/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between font-bold text-rose-300">
                <span>عودت‌شده به تهیه‌کننده</span>
                <span className="font-mono-tabular">
                  {atProducerItems.length}
                </span>
              </div>
              {atProducerItems.map((it) => (
                <div
                  key={it.id}
                  className="p-2 bg-slate-900 rounded flex items-center justify-between"
                >
                  <span className="truncate">{it.title}</span>
                  <span className="text-[10px] text-rose-300">
                    در انتظار v{(it.revisionVersion || 1) + 1}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-slate-950 border border-teal-500/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between font-bold text-teal-300">
                <span>تأیید نهایی در صف پلی‌اوت</span>
                <span className="font-mono-tabular">
                  {inPlayoutQueueItems.length}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {inPlayoutQueueItems.length} ردیف تأیید نهایی شده و در جدول
                کنداکتور و پلی‌لیست پلی‌اوت آماده اجرا هستند.
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * ============================================================================
 * 4. QC INSPECTOR ISOLATED PORTAL (Sub-tabbed + Paginated History)
 * ============================================================================
 */
interface QCInspectionPortalProps {
  items: ScheduleItem[];
  currentRole: RoleDefinition;
  onSaveMarkersAndStage: (
    itemId: string,
    markers: QCMarker[],
    nextStage: WorkflowStage,
    comment?: string
  ) => void;
}

export function QCInspectionPortal({
  items,
  currentRole,
  onSaveMarkersAndStage,
}: QCInspectionPortalProps) {
  const [qcSubTab, setQcSubTab] = useState<'qc_workstation' | 'qc_history'>(
    'qc_workstation'
  );
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(8);

  const assignedForQcItems = useMemo(
    () => items.filter((i) => i.workflowStatus === 'in_qc_review'),
    [items]
  );

  const previouslyInspectedItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.workflowStatus !== 'in_qc_review' &&
          i.workflowStatus !== 'uploaded_by_producer' &&
          ((i.qcMarkers && i.qcMarkers.length > 0) ||
            (i.versions && i.versions.length > 0) ||
            i.workflowStatus === 'qc_approved' ||
            i.workflowStatus === 'qc_needs_revision' ||
            i.workflowStatus === 'referred_to_director' ||
            i.workflowStatus === 'approved_by_director' ||
            i.workflowStatus === 'rejected_by_director' ||
            i.workflowStatus === 'returned_to_producer')
      ),
    [items]
  );

  const paginatedHistoryItems = useMemo(() => {
    const safePage = Math.min(
      historyPage,
      Math.max(1, Math.ceil(previouslyInspectedItems.length / historyPageSize))
    );
    const start = (safePage - 1) * historyPageSize;
    return previouslyInspectedItems.slice(start, start + historyPageSize);
  }, [previouslyInspectedItems, historyPage, historyPageSize]);

  const [selectedItemId, setSelectedItemId] = useState<string>(
    assignedForQcItems[0]?.id || items[0]?.id || ''
  );
  const activeItem = useMemo(
    () =>
      assignedForQcItems.find((i) => i.id === selectedItemId) ||
      assignedForQcItems[0] ||
      previouslyInspectedItems.find((i) => i.id === selectedItemId) ||
      null,
    [assignedForQcItems, previouslyInspectedItems, selectedItemId]
  );

  const [playheadSec, setPlayheadSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [rangeStartSec, setRangeStartSec] = useState<number | null>(null);
  const [rangeEndSec, setRangeEndSec] = useState<number | null>(null);
  const [markerCat, setMarkerCat] = useState<QCMarkerCategory>('video');
  const [markerSeverity, setMarkerSeverity] =
    useState<QCMarkerSeverity>('warning');
  const [markerNote, setMarkerNote] = useState<string>('');
  const [qcComment, setQcComment] = useState<string>('');
  const [comparingVersionNum, setComparingVersionNum] = useState<number | null>(
    null
  );

  const currentMarkers = activeItem?.qcMarkers || [];

  const handleAddInlineMarker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !markerNote.trim()) return;
    const startSec =
      rangeStartSec !== null ? rangeStartSec : Math.floor(playheadSec);
    const endSec =
      rangeEndSec !== null && rangeEndSec > startSec ? rangeEndSec : undefined;

    const newMarker: QCMarker = {
      id: `qcm-${Date.now()}`,
      timeSec: startSec,
      endTimeSec: endSec,
      timecode: formatDurationTotal(startSec),
      endTimecode: endSec ? formatDurationTotal(endSec) : undefined,
      versionNumber: activeItem.revisionVersion || 1,
      category: markerCat,
      severity: markerSeverity,
      note: markerNote.trim(),
      author: `${currentRole.personName} (${currentRole.title})`,
      createdAt: new Date().toLocaleTimeString('fa-IR'),
      resolved: false,
    };

    const nextMarkers = [...currentMarkers, newMarker].sort(
      (a, b) => a.timeSec - b.timeSec
    );
    onSaveMarkersAndStage(
      activeItem.id,
      nextMarkers,
      activeItem.workflowStatus || 'in_qc_review',
      `ثبت مورد بازبینی در تایم‌کد ${newMarker.timecode}`
    );
    setMarkerNote('');
    setRangeStartSec(null);
    setRangeEndSec(null);
  };

  return (
    <section id="qc-inspection-portal" className="space-y-4">
      <div className="bg-slate-900/80 border border-amber-500/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/[0.08] shadow-inner">
          <button
            type="button"
            onClick={() => setQcSubTab('qc_workstation')}
            className={`px-3.5 py-2 text-xs font-bold cursor-pointer transition-all ${
              qcSubTab === 'qc_workstation'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-amber-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            ۱. میز بازبینی ویدئو و ثبت مارکر تایم‌کد (
            {assignedForQcItems.length} پرونده در صف)
          </button>
          <button
            type="button"
            onClick={() => setQcSubTab('qc_history')}
            className={`px-3.5 py-2 text-xs font-bold cursor-pointer transition-all ${
              qcSubTab === 'qc_history'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            ۲. سوابق پرونده‌های بازبینی و ارسال‌شده (
            {previouslyInspectedItems.length})
          </button>
        </div>

        <span className="text-xs text-amber-300 font-semibold">
          بازبین فعال: {currentRole.personName}
        </span>
      </div>

      {qcSubTab === 'qc_workstation' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Right 4 Cols: Assigned Files Queue */}
          <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2.5">
              پرونده‌های ارجاع‌شده از هماهنگی جهت بازبینی
            </h3>

            {assignedForQcItems.length === 0 ? (
              <div className="p-5 bg-slate-950/60 border border-white/[0.06] rounded-xl text-xs text-slate-400 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400/70 mx-auto mb-1.5" />
                <span>در حال حاضر پرونده جدیدی در صف بازبینی نیست.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {assignedForQcItems.map((it) => {
                  const isSelected = activeItem?.id === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setSelectedItemId(it.id);
                        setPlayheadSec(it.trimInSec || 0);
                        setIsPlaying(false);
                        setComparingVersionNum(null);
                      }}
                      className={`w-full p-3.5 rounded-xl border text-right transition-colors cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'bg-amber-950/35 border-amber-400'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-100">
                          {it.title}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono-tabular text-[11px] font-bold">
                          نسخه v{it.revisionVersion || 1}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>کد: {it.mediaCode}</span>
                        <span>مدت: {it.duration}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Left 8 Cols: Internal QC Video Player & Decision Console */}
          <div className="lg:col-span-8 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
            {activeItem ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-100">
                        {activeItem.title}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-teal-300 font-mono-tabular text-xs font-bold">
                        نسخه فعال v{activeItem.revisionVersion || 1}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      شناسه مدیا: {activeItem.mediaCode} | تهیه‌کننده:{' '}
                      {activeItem.producerName || 'گروه تولید'}
                    </div>
                  </div>

                  {activeItem.versions && activeItem.versions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-400">
                        مقایسه نسخه‌ها:
                      </span>
                      {activeItem.versions.map((v) => (
                        <button
                          key={v.versionNumber}
                          type="button"
                          onClick={() =>
                            setComparingVersionNum(
                              comparingVersionNum === v.versionNumber
                                ? null
                                : v.versionNumber
                            )
                          }
                          className={`px-2.5 py-1 rounded text-xs font-mono-tabular font-bold cursor-pointer ${
                            comparingVersionNum === v.versionNumber
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-950 border border-slate-700 text-slate-300'
                          }`}
                        >
                          v{v.versionNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Version Comparison Card when comparingVersionNum is selected */}
                {comparingVersionNum !== null &&
                  activeItem.versions &&
                  (() => {
                    const comparedVer = activeItem.versions.find(
                      (v) => v.versionNumber === comparingVersionNum
                    );
                    if (!comparedVer) return null;
                    return (
                      <div className="p-3.5 rounded-xl bg-slate-950/90 border border-amber-400/50 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold text-amber-300">
                            <Layers className="w-4 h-4" />
                            <span>
                              مقایسه مشخصات نسخه آرشیوی v{comparedVer.versionNumber}{' '}
                              با نسخه فعال v{activeItem.revisionVersion || 1}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setComparingVersionNum(null)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
                          >
                            بازگشت به نسخه فعال (v{activeItem.revisionVersion || 1})
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px] text-slate-300">
                          <div>
                            <span className="text-slate-400">نام فایل نسخه v{comparedVer.versionNumber}: </span>
                            <strong className="font-mono-tabular text-teal-300">
                              {comparedVer.videoFileName}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400">مدت و زمان تحویل: </span>
                            <strong className="font-mono-tabular">
                              {comparedVer.duration} ({comparedVer.uploadedAt})
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400">تحویل‌دهنده: </span>
                            <strong>{comparedVer.uploadedBy}</strong>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                          <span className="text-slate-400">
                            توضیحات تدوینگر: {comparedVer.notes || 'بدون توضیح'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                            وضعیت تصمیم قبلی:{' '}
                            {comparedVer.qcDecision === 'approved'
                              ? 'تأیید شده'
                              : comparedVer.qcDecision === 'needs_revision'
                              ? 'نیازمند اصلاح'
                              : comparedVer.qcDecision === 'referred_to_director'
                              ? 'ارجاع به مدیر پخش'
                              : 'در جریان بازبینی'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                <BroadcastVideoPlayer
                  item={
                    comparingVersionNum !== null && activeItem.versions
                      ? (() => {
                          const cv = activeItem.versions.find(
                            (v) => v.versionNumber === comparingVersionNum
                          );
                          return cv
                            ? {
                                ...activeItem,
                                revisionVersion: cv.versionNumber,
                                videoUrl: cv.videoUrl || activeItem.videoUrl,
                                videoFileName: cv.videoFileName,
                              }
                            : activeItem;
                        })()
                      : activeItem
                  }
                  currentTimeSec={playheadSec}
                  isPlaying={isPlaying}
                  draftRange={
                    rangeStartSec !== null &&
                    rangeEndSec !== null &&
                    rangeEndSec > rangeStartSec
                      ? { startSec: rangeStartSec, endSec: rangeEndSec }
                      : null
                  }
                  onTimeChange={setPlayheadSec}
                  onPlayStateChange={setIsPlaying}
                />

                {/* Log Timecode or Time-Range QC Marker Form */}
                <form
                  onSubmit={handleAddInlineMarker}
                  className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" />
                      <span>
                        ثبت اصلاحیه در زمان دقیق (
                        {formatDurationTotal(Math.floor(playheadSec))}) یا بازه
                        زمانی:
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRangeStartSec(Math.floor(playheadSec))}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded font-mono-tabular cursor-pointer"
                      >
                        شروع بازه:{' '}
                        {rangeStartSec !== null
                          ? formatDurationTotal(rangeStartSec)
                          : 'ثبت نقطه شروع'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRangeEndSec(Math.floor(playheadSec))}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded font-mono-tabular cursor-pointer"
                      >
                        پایان بازه:{' '}
                        {rangeEndSec !== null
                          ? formatDurationTotal(rangeEndSec)
                          : 'ثبت نقطه پایان'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <select
                      value={markerCat}
                      onChange={(e) =>
                        setMarkerCat(e.target.value as QCMarkerCategory)
                      }
                      className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
                    >
                      <option value="video">ایراد فنی تصویر</option>
                      <option value="audio">ایراد صدا / سینک</option>
                      <option value="editorial">ممیزی محتوایی / تحریریه</option>
                      <option value="graphics">زیرنویس و گرافیک</option>
                    </select>

                    <select
                      value={markerSeverity}
                      onChange={(e) =>
                        setMarkerSeverity(e.target.value as QCMarkerSeverity)
                      }
                      className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
                    >
                      <option value="warning">نیازمند اصلاح</option>
                      <option value="critical">بحرانی / مانع پخش</option>
                    </select>

                    <input
                      type="text"
                      value={markerNote}
                      onChange={(e) => setMarkerNote(e.target.value)}
                      placeholder="شرح دقیق ایراد در این تایم‌کد..."
                      className="sm:col-span-5 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                    />

                    <button
                      type="submit"
                      className="sm:col-span-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg py-2 px-3 cursor-pointer"
                    >
                      + ثبت مارکر
                    </button>
                  </div>
                </form>

                {/* Active Item QC Markers List with Jump & Delete */}
                <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">
                      موارد اصلاحیه ثبت‌شده روی این پرونده ({currentMarkers.length}{' '}
                      مورد):
                    </span>
                    <span className="text-[11px] text-slate-400">
                      کلیک روی هر مورد = پرش به تایم‌کد
                    </span>
                  </div>
                  {currentMarkers.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-white/[0.06] text-slate-400 text-center">
                      تاکنون مورد اصلاحیه‌ای برای این پرونده ثبت نشده است.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {currentMarkers.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => {
                            setPlayheadSec(m.timeSec);
                            setIsPlaying(false);
                          }}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            m.resolved
                              ? 'bg-slate-900/50 border-slate-800 opacity-60'
                              : m.severity === 'critical'
                              ? 'bg-rose-950/30 border-rose-500/40 hover:bg-rose-950/45'
                              : 'bg-amber-950/25 border-amber-500/40 hover:bg-amber-950/40'
                          }`}
                        >
                          <div className="truncate space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono-tabular text-[10px] font-bold text-teal-300">
                                {m.endTimecode
                                  ? `${m.timecode} تا ${m.endTimecode}`
                                  : m.timecode}
                              </span>
                              <span className="text-[11px] font-bold text-amber-300">
                                {QC_CATEGORY_META[m.category].label}
                              </span>
                            </div>
                            <div className="text-slate-200 truncate">
                              {m.note}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              const filtered = currentMarkers.filter(
                                (x) => x.id !== m.id
                              );
                              onSaveMarkersAndStage(
                                activeItem.id,
                                filtered,
                                activeItem.workflowStatus || 'in_qc_review',
                                `حذف مارکر تایم‌کد ${m.timecode}`
                              );
                            }}
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-[10px] shrink-0 cursor-pointer"
                          >
                            حذف
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Final 3 QC Decisions */}
                <div className="p-4 bg-slate-950 border border-teal-500/40 rounded-xl space-y-3">
                  <input
                    type="text"
                    value={qcComment}
                    onChange={(e) => setQcComment(e.target.value)}
                    placeholder="توضیحات تکمیلی بازبین جهت درج در پرونده گردش‌کار..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          activeItem.id,
                          currentMarkers,
                          'qc_approved',
                          qcComment ||
                            `تأیید فنی و محتوایی نسخه v${
                              activeItem.revisionVersion || 1
                            } توسط بازبین و بازگشت به هماهنگی`
                        )
                      }
                      className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      ۱. تأیید بازبینی (ارسال به هماهنگی)
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          activeItem.id,
                          currentMarkers,
                          'qc_needs_revision',
                          qcComment ||
                            `درخواست اصلاح توسط بازبین (${currentMarkers.length} مورد تایم‌کددار)`
                        )
                      }
                      className="py-2.5 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      ۲. درخواست اصلاح (ثبت ایرادات)
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onSaveMarkersAndStage(
                          activeItem.id,
                          currentMarkers,
                          'referred_to_director',
                          qcComment ||
                            'ارجاع پرونده از بازبین به مدیر پخش جهت تصمیم‌گیری نهایی'
                        )
                      }
                      className="py-2.5 px-3 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      ۳. رد / ارجاع به مدیر پخش
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                یک پرونده را جهت بازبینی انتخاب نمایید.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="overflow-x-auto border border-white/[0.08] rounded-xl bg-slate-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),inset_-12px_0_16px_-12px_rgba(0,0,0,0.55),inset_12px_0_16px_-12px_rgba(0,0,0,0.55)]">
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md">
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 text-center">ردیف / ساعت</th>
                  <th className="py-2.5 px-3">عنوان برنامه و کد مدیا</th>
                  <th className="py-2.5 px-3 text-center">نسخه</th>
                  <th className="py-2.5 px-3 text-center">تعداد مارکر بازبین</th>
                  <th className="py-2.5 px-3">وضعیت فعلی پرونده در چرخه</th>
                  <th className="py-2.5 px-3">واحد مسئول فعلی</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {paginatedHistoryItems.map((it) => {
                  const st = it.workflowStatus || 'approved_for_playout';
                  const meta = WORKFLOW_STAGE_META[st];
                  return (
                    <tr key={it.id} className="hover:bg-slate-900/60">
                      <td className="py-2.5 px-3 text-center font-mono-tabular">
                        <div className="font-bold text-slate-200">
                          ردیف {it.order}
                        </div>
                        <div className="text-[10px] text-teal-300">
                          {it.startTime}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-100">{it.title}</div>
                        <div className="text-[10px] font-mono-tabular text-slate-400">
                          {it.mediaCode}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-tabular text-teal-300">
                        v{it.revisionVersion || 1}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-tabular text-amber-300">
                        {(it.qcMarkers || []).length} مورد
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {meta.targetRoleLabel}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItemId(it.id);
                            setPlayheadSec(it.trimInSec || 0);
                            setIsPlaying(false);
                            setQcSubTab('qc_workstation');
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-[11px] cursor-pointer"
                        >
                          مشاهده در پلیر
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={historyPage}
            totalItems={previouslyInspectedItems.length}
            pageSize={historyPageSize}
            onPageChange={setHistoryPage}
            onPageSizeChange={setHistoryPageSize}
          />
        </div>
      )}
    </section>
  );
}

/**
 * ============================================================================
 * 6. READ-ONLY MONITORING PORTAL (Sub-tabbed + Paginated Playlist)
 * ============================================================================
 */
interface ReadOnlyMonitoringPortalProps {
  items: ScheduleItem[];
  currentItem?: ScheduleItem;
  nextItem?: ScheduleItem;
  remainingSec: number;
  progressPercent: number;
  clockSec: number;
  dayStartSec: number;
  nextAzanStatus: {
    label: string;
    exactTime: string;
    remainingFormatted: string;
    isImminent: boolean;
    isOnNow: boolean;
  };
  incidents: BroadcastExecutionIncident[];
  reporterName: string;
  onAddIncident: (
    incident: Omit<BroadcastExecutionIncident, 'id' | 'reportedAt' | 'status'>
  ) => void;
  onOpenTomorrowAzan: () => void;
}

export function ReadOnlyMonitoringPortal({
  items,
  currentItem,
  nextItem,
  remainingSec,
  progressPercent,
  clockSec,
  dayStartSec,
  nextAzanStatus,
  incidents,
  reporterName,
  onAddIncident,
  onOpenTomorrowAzan,
}: ReadOnlyMonitoringPortalProps) {
  const [monSubTab, setMonSubTab] = useState<
    'playlist_monitor' | 'incident_log'
  >('playlist_monitor');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [selectedOrder, setSelectedOrder] = useState<number>(
    currentItem?.order || items[0]?.order || 1
  );
  const [incidentCategory, setIncidentCategory] =
    useState<BroadcastExecutionIncident['category']>('audio_drop');
  const [incidentSeverity, setIncidentSeverity] =
    useState<BroadcastExecutionIncident['severity']>('warning');
  const [incidentDesc, setIncidentDesc] = useState<string>('');

  const paginatedItems = useMemo(() => {
    const safePage = Math.min(
      page,
      Math.max(1, Math.ceil(items.length / pageSize))
    );
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDesc.trim()) return;
    const target =
      items.find((i) => i.order === selectedOrder) || currentItem || items[0];
    if (!target) return;

    onAddIncident({
      itemOrder: target.order,
      itemTitle: target.title,
      mediaCode: target.mediaCode,
      timecodeAtReport: formatSecondsToTime(clockSec),
      category: incidentCategory,
      severity: incidentSeverity,
      description: incidentDesc.trim(),
      reportedBy: reporterName,
    });
    setIncidentDesc('');
  };

  const INCIDENT_CATEGORY_LABELS: Record<
    BroadcastExecutionIncident['category'],
    string
  > = {
    audio_drop: 'افت یا قطع صدا در پخش',
    switch_delay: 'عدم تطابق زمان سوییچ با کنداکتور',
    frame_freeze: 'فریز یا پرش فریم تصویر',
    cg_mismatch: 'خطای زیرنویس یا گرافیک آنتن',
    file_error: 'عدم آمادگی فایل در سرور پلی‌اوت',
  };

  return (
    <section id="read-only-monitoring-portal" className="space-y-4">
      {/* Compact Read-Only Header + Sub-tabs (OS 26 Segmented Pill Control) */}
      <div className="p-3.5 bg-sky-950/30 border border-sky-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/[0.08] shadow-inner">
          <button
            type="button"
            onClick={() => setMonSubTab('playlist_monitor')}
            className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-all ${
              monSubTab === 'playlist_monitor'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-sky-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            ۱. جدول پایش پلی‌لیست و مانیتور آنتن (Read-Only)
          </button>
          <button
            type="button"
            onClick={() => setMonSubTab('incident_log')}
            className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-all ${
              monSubTab === 'incident_log'
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-amber-300 border border-white/[0.12] shadow-md rounded-lg'
                : 'text-slate-400 hover:text-slate-200 rounded-lg'
            }`}
          >
            ۲. ثبت و پیگیری گزارش خطاهای اجرای پخش ({incidents.length})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-teal-300 font-mono-tabular">
            {nextAzanStatus.label}: {nextAzanStatus.exactTime} (مانده:{' '}
            {nextAzanStatus.remainingFormatted})
          </span>
          <button
            type="button"
            onClick={onOpenTomorrowAzan}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-500/20 border border-teal-500/40 text-teal-200 font-bold text-[11px] cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5 text-amber-300" />
            <span>اوقات فردا</span>
          </button>
          <span className="px-2.5 py-1 rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 font-bold">
            پایش صرف (Read-Only)
          </span>
        </div>
      </div>

      {monSubTab === 'playlist_monitor' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Right 7 Cols: Paginated Read-Only Playlist Table */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-100">
                جدول پایش وضعیت آمادگی فایل‌ها و تطابق پخش
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {currentItem && (
                  <button
                    type="button"
                    onClick={() => {
                      const idx = items.findIndex(
                        (i) => i.id === currentItem.id
                      );
                      if (idx >= 0) {
                        setPage(Math.floor(idx / pageSize) + 1);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span>پرش به ردیف روی آنتن</span>
                  </button>
                )}
                {nextItem && (
                  <span className="text-xs text-sky-300">
                    بعدی: {nextItem.title} ({nextItem.startTime})
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto border border-white/[0.08] rounded-xl bg-slate-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),inset_-12px_0_16px_-12px_rgba(0,0,0,0.55),inset_12px_0_16px_-12px_rgba(0,0,0,0.55)]">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md">
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-2.5 text-center">#</th>
                    <th className="py-2 px-2.5 text-center">شروع</th>
                    <th className="py-2 px-2.5 text-center">مدت</th>
                    <th className="py-2 px-2.5">عنوان برنامه</th>
                    <th className="py-2 px-2.5">وضعیت آمادگی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {paginatedItems.map((it) => {
                    const isOnAir = currentItem?.id === it.id;
                    const wfMeta =
                      WORKFLOW_STAGE_META[
                        it.workflowStatus || 'approved_for_playout'
                      ];
                    return (
                      <tr
                        key={it.id}
                        className={
                          isOnAir
                            ? 'bg-rose-950/30 border-r-4 border-r-rose-500 font-semibold'
                            : 'hover:bg-slate-900/50'
                        }
                      >
                        <td className="py-2 px-2.5 text-center font-mono-tabular">
                          {it.order}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono-tabular text-teal-300">
                          {it.startTime}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono-tabular text-amber-300">
                          {it.duration}
                        </td>
                        <td className="py-2 px-2.5 text-slate-100">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{it.title}</span>
                            <span className="text-[10px] font-mono-tabular text-slate-400">
                              (v{it.revisionVersion || 1})
                            </span>
                            {isOnAir && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono-tabular text-[10px] font-bold">
                                ON-AIR · مانده {formatDurationTotal(remainingSec)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] ${wfMeta.badgeClass}`}
                          >
                            {wfMeta.shortLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={page}
              totalItems={items.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>

          {/* Left 5 Cols: Live Read-Only Antenna Output Player */}
          <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-300">
                مانیتور زنده خروجی آنتن (PGM Read-Only)
              </h3>
              <span className="text-xs font-mono-tabular text-amber-300">
                مانده: {formatDurationTotal(remainingSec)} ({progressPercent}%)
              </span>
            </div>

            {currentItem && (
              <BroadcastVideoPlayer
                item={currentItem}
                currentTimeSec={
                  (currentItem.trimInSec || 0) +
                  Math.max(
                    0,
                    parseTimeToSeconds(currentItem.duration) - remainingSec
                  )
                }
                clockSec={clockSec}
                dayStartSec={dayStartSec}
                readOnly={true}
                isPlaying={true}
                enforceTrim={true}
                onTimeChange={() => {}}
                onPlayStateChange={() => {}}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-amber-300">
            ثبت گزارش خطا در اجرای پخش و پیگیری وضعیت رفع خطاها
          </h3>

          <form
            onSubmit={handleReportSubmit}
            className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  ردیف برنامه مرتبط:
                </label>
                <select
                  value={selectedOrder}
                  onChange={(e) => setSelectedOrder(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.order}>
                      ردیف {it.order}: {it.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  نوع خطای اجرای پخش:
                </label>
                <select
                  value={incidentCategory}
                  onChange={(e) =>
                    setIncidentCategory(
                      e.target.value as BroadcastExecutionIncident['category']
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                >
                  {Object.entries(INCIDENT_CATEGORY_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  سطح اهمیت:
                </label>
                <select
                  value={incidentSeverity}
                  onChange={(e) =>
                    setIncidentSeverity(
                      e.target.value as BroadcastExecutionIncident['severity']
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                >
                  <option value="critical">فوری / بحرانی روی آنتن</option>
                  <option value="warning">هشدار عملیاتی</option>
                  <option value="info">گزارش فنی شیفت</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={incidentDesc}
                onChange={(e) => setIncidentDesc(e.target.value)}
                placeholder="شرح خطای مشاهده‌شده در اجرای پخش..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg shrink-0 cursor-pointer"
              >
                ثبت گزارش خطا
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tabular text-teal-300 font-bold">
                      [{inc.timecodeAtReport}]
                    </span>
                    <span className="font-bold text-slate-100">
                      ردیف {inc.itemOrder}: {inc.itemTitle}
                    </span>
                    <span className="text-amber-300">
                      ({INCIDENT_CATEGORY_LABELS[inc.category]})
                    </span>
                  </div>
                  <p className="text-slate-300">{inc.description}</p>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                    inc.status === 'resolved'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : inc.status === 'investigating'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {inc.status === 'resolved'
                    ? '✓ برطرف‌شده'
                    : inc.status === 'investigating'
                    ? 'در دست بررسی فنی'
                    : 'ثبت‌شده (در انتظار رسیدگی)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * ============================================================================
 * 1B. BROADCAST DIRECTOR SUPERVISORY BAR & DECISION CENTER
 * ============================================================================
 */
export type DirectorPageMode =
  | 'DIRECTOR_DECISION_CENTER'
  | 'LIVE_ALL_UNITS_MONITOR'
  | 'CONDUCTOR_24H_MASTER'
  | 'PLAYOUT_AND_AUDIT';

interface DirectorDecisionAndMonitorPortalProps {
  mode: DirectorPageMode;
  items: ScheduleItem[];
  incidents: BroadcastExecutionIncident[];
  inspectedUnitRole: AccessRoleLevel;
  onSelectInspectedUnitRole: (role: AccessRoleLevel) => void;
  onDirectorDecision: (
    itemId: string,
    markers: QCMarker[],
    decisionStage: 'approved_by_director' | 'rejected_by_director',
    comment: string
  ) => void;
  onOpenQCModal: (item: ScheduleItem) => void;
  onUpdateIncidentStatus: (
    id: string,
    status: BroadcastExecutionIncident['status'],
    note: string
  ) => void;
}

export function DirectorDecisionAndMonitorPortal({
  mode,
  items,
  incidents,
  inspectedUnitRole,
  onSelectInspectedUnitRole,
  onDirectorDecision,
  onOpenQCModal,
  onUpdateIncidentStatus,
}: DirectorDecisionAndMonitorPortalProps) {
  const [decisionSubTab, setDecisionSubTab] = useState<
    'qc_referrals' | 'incidents'
  >('qc_referrals');

  const referredToDirectorItems = items.filter(
    (i) =>
      i.workflowStatus === 'referred_to_director' ||
      i.workflowStatus === 'qc_needs_revision'
  );

  const unitSummaries: {
    roleId: AccessRoleLevel;
    unitName: string;
    person: string;
    activeCount: number;
    statusSummary: string;
  }[] = [
    {
      roleId: 'producer_editor',
      unitName: '۱. واحد تولید و تدوین',
      person: 'مهندس رضایی',
      activeCount: items.filter(
        (i) => i.workflowStatus === 'returned_to_producer'
      ).length,
      statusSummary: 'بارگذاری اولیه (v1) و رفع ایراد پرونده‌های عودتی',
    },
    {
      roleId: 'level_2',
      unitName: '۲. واحد هماهنگی و کنداکتور',
      person: 'خانم مرادی',
      activeCount: items.filter(
        (i) =>
          i.workflowStatus === 'uploaded_by_producer' ||
          i.workflowStatus === 'qc_approved' ||
          i.workflowStatus === 'approved_by_director' ||
          i.workflowStatus === 'rejected_by_director'
      ).length,
      statusSummary: 'ارجاع به بازبین، عودت اصلاحیه‌ها و ارسال به صف پلی‌اوت',
    },
    {
      roleId: 'qc_inspector',
      unitName: '۳. واحد بازبینی (QC)',
      person: 'مهندس کریمی',
      activeCount: items.filter((i) => i.workflowStatus === 'in_qc_review')
        .length,
      statusSummary: 'بازبینی فنی/محتوایی و ثبت مارکرهای تایم‌کددار',
    },
    {
      roleId: 'level_3',
      unitName: '۴. واحد مدیریت پلی‌اوت',
      person: 'مهندس رضایی',
      activeCount: items.filter((i) => isItemApprovedForPlayout(i)).length,
      statusSummary: 'تنظیم Mark In/Out، چیدمان پلی‌لیست و اجرای پخش روی آنتن',
    },
    {
      roleId: 'operator',
      unitName: '۵. واحد پایش پخش (Read-Only)',
      person: 'مهندس حسینی',
      activeCount: incidents.filter((inc) => inc.status !== 'resolved').length,
      statusSummary: 'پایش تطابق پخش زنده و ثبت گزارش خطاهای آنتن',
    },
  ];

  if (mode === 'DIRECTOR_DECISION_CENTER') {
    return (
      <section id="director-decision-center" className="space-y-4">
        <div className="bg-slate-900/80 border border-teal-500/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/[0.08] shadow-inner">
            <button
              type="button"
              onClick={() => setDecisionSubTab('qc_referrals')}
              className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                decisionSubTab === 'qc_referrals'
                  ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-teal-300 border border-white/[0.12] shadow-md rounded-lg'
                  : 'text-slate-400 hover:text-slate-200 rounded-lg'
              }`}
            >
              ۱. پرونده‌های ارجاع‌شده از بازبین ({referredToDirectorItems.length}
              )
            </button>
            <button
              type="button"
              onClick={() => setDecisionSubTab('incidents')}
              className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                decisionSubTab === 'incidents'
                  ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-amber-300 border border-white/[0.12] shadow-md rounded-lg'
                  : 'text-slate-400 hover:text-slate-200 rounded-lg'
              }`}
            >
              ۲. گزارش‌های خطای اجرای پخش اپراتور پایش ({incidents.length})
            </button>
          </div>
          <span className="text-xs text-slate-400">
            مرکز تصمیم‌گیری مدیر پخش سیمای مرکز اصفهان
          </span>
        </div>

        {decisionSubTab === 'qc_referrals' ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
            {referredToDirectorItems.length === 0 ? (
              <div className="p-6 bg-slate-950/60 border border-white/[0.06] rounded-xl text-center text-xs text-slate-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-400/70 mx-auto mb-1.5" />
                <span>تمامی پرونده‌های ارجاعی تعیین تکلیف شده‌اند.</span>
              </div>
            ) : (
              referredToDirectorItems.map((it) => (
                <div
                  key={it.id}
                  className="p-4 bg-slate-950 border border-amber-500/40 rounded-xl space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono-tabular font-bold text-teal-300">
                          ردیف {it.order} | ساعت {it.startTime}
                        </span>
                        <span className="text-sm font-bold text-slate-100">
                          {it.title} (نسخه v{it.revisionVersion || 1})
                        </span>
                        <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded text-xs">
                          {(it.qcMarkers || []).length} گزارش اصلاحیه بازبین
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        کد مدیا: {it.mediaCode} — تهیه‌کننده:{' '}
                        {it.producerName || 'گروه تولید'}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenQCModal(it)}
                        className="px-3 py-2 bg-amber-400/90 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        بازبینی ویدئو و ایرادات ({(it.qcMarkers || []).length})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onDirectorDecision(
                            it.id,
                            it.qcMarkers || [],
                            'approved_by_director',
                            'تأیید پرونده توسط مدیر پخش و بازگشت به هماهنگی جهت ارسال به پلی‌اوت'
                          )
                        }
                        className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        تأیید مدیر پخش و بازگشت به هماهنگی
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onDirectorDecision(
                            it.id,
                            it.qcMarkers || [],
                            'rejected_by_director',
                            'الزام به اصلاح توسط مدیر پخش و ارجاع به هماهنگی جهت عودت به تهیه‌کننده'
                          )
                        }
                        className="px-3.5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-lg cursor-pointer"
                      >
                        الزام به اصلاح و ارجاع به هماهنگی
                      </button>
                    </div>
                  </div>

                  {/* Glassmorphic Timecoded Defects List */}
                  {(it.qcMarkers || []).length > 0 && (
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-amber-500/30 backdrop-blur-sm space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px]">
                        <span className="flex items-center gap-1.5 text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>
                            فهرست ایرادات ثبت‌شده بازبین ({it.qcMarkers!.length}{' '}
                            مورد):
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          کلیک روی هر مورد = باز شدن پلیر بازبینی در همان فریم
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        {it.qcMarkers!.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => onOpenQCModal(it)}
                            className="p-2.5 rounded-lg bg-slate-950/70 border border-white/[0.08] hover:border-amber-400/60 cursor-pointer flex items-start gap-2.5 transition-colors"
                            title="کلیک برای باز کردن پلیر بازبینی در این تایم‌کد"
                          >
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-teal-300 font-mono-tabular text-[10px] font-bold shrink-0">
                              {m.endTimecode
                                ? `${m.timecode} تا ${m.endTimecode}`
                                : m.timecode}
                            </span>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-amber-300">
                                  {QC_CATEGORY_META[m.category]?.label ||
                                    m.category}
                                </span>
                                <span
                                  className={`text-[10px] px-1 rounded ${
                                    m.severity === 'critical'
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  {m.severity === 'critical'
                                    ? 'بحرانی'
                                    : 'اصلاحیه'}
                                </span>
                              </div>
                              <p className="text-slate-200 text-xs truncate">
                                {m.note}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-2.5">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-mono-tabular text-teal-300 font-bold ml-2">
                    [{inc.timecodeAtReport}]
                  </span>
                  <span className="font-bold text-slate-100">
                    ردیف {inc.itemOrder} ({inc.itemTitle}):
                  </span>{' '}
                  <span className="text-slate-300">{inc.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateIncidentStatus(
                        inc.id,
                        'investigating',
                        'در حال بررسی فنی توسط رژی و پلی‌اوت'
                      )
                    }
                    className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded cursor-pointer"
                  >
                    در دست بررسی
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateIncidentStatus(
                        inc.id,
                        'resolved',
                        'خطا بررسی و در زنجیره پلی‌اوت برطرف گردید.'
                      )
                    }
                    className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded cursor-pointer"
                  >
                    ثبت رفع خطا ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (mode === 'LIVE_ALL_UNITS_MONITOR') {
    return (
      <section id="director-all-units-monitor" className="space-y-4">
        <div className="bg-slate-900/80 border border-teal-500/40 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-teal-300 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>
                نوار سوئیچ نظارتی مدیر پخش — مانیتورینگ زنده وضعیت هر ۵ واحد:
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              روی هر واحد کلیک کنید تا میز کار آن واحد نمایش داده شود
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {unitSummaries.map((u) => {
              const isSelected = inspectedUnitRole === u.roleId;
              return (
                <button
                  key={u.roleId}
                  type="button"
                  onClick={() => onSelectInspectedUnitRole(u.roleId)}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-500/20 border-teal-400 ring-1 ring-teal-400'
                      : 'bg-slate-950 border-slate-800 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">
                      {u.unitName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono-tabular text-xs font-bold">
                      {u.activeCount}
                    </span>
                  </div>
                  <div className="text-[11px] text-teal-300 mt-1">
                    {u.person}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate">
                    {u.statusSummary}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return null;
}
