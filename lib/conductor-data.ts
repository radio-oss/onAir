export type ProgramCategory =
  | 'live'
  | 'news'
  | 'series'
  | 'production'
  | 'religious'
  | 'ad'
  | 'promo'
  | 'filler';

export type SignalSource =
  | 'live_studio'
  | 'server1'
  | 'server2'
  | 'ob_van'
  | 'satellite';

export type BroadcastStatus = 'ready' | 'on_air' | 'aired' | 'rejected';

export type AccessRoleLevel =
  | 'level_1' // مدیر پخش (Broadcast Director)
  | 'level_2' // مدیر هماهنگی (Coordination)
  | 'qc_inspector' // بازبین و کنترل کیفی (QC Inspector)
  | 'level_3' // ناظر پخش (MCR Supervisor)
  | 'operator' // اپراتور پلی‌اوت (Playout Operator)
  | 'producer_editor'; // تهیه‌کننده و تدوینگر (Producer / Editor)

export type WorkflowStage =
  | 'uploaded_by_producer' // گام ۱: بارگذاری شده توسط تدوینگر -> در کارتابل هماهنگی
  | 'in_qc_review' // گام ۲: ارسال شده توسط هماهنگی -> در کارتابل بازبین
  | 'qc_approved' // گام ۳/۴: تایید بازبین -> بازگشت به هماهنگی جهت ارسال به پلی‌اوت
  | 'qc_needs_revision' // گام ۴: درخواست اصلاح بازبین -> در کارتابل مدیر پخش
  | 'referred_to_director' // گام ۴: ارجاع بازبین به مدیر پخش جهت تصمیم‌گیری مدیریتی
  | 'approved_by_director' // گام ۵: تایید مدیر پخش -> بازگشت به هماهنگی جهت ادامه پخش
  | 'rejected_by_director' // گام ۵: الزام به اصلاح مدیر پخش -> در کارتابل هماهنگی جهت عودت
  | 'returned_to_producer' // گام ۶: عودت داده شده به تهیه‌کننده/تدوینگر جهت اصلاح
  | 'approved_for_playout' // گام ۸/۹: تایید نهایی -> آماده در صف مدیریت پلی‌اوت
  | 'on_air' // گام ۱۰: در حال پخش روی آنتن
  | 'aired'; // گام ۱۱: پخش شده (آرشیو)

export type WorkflowStatus = WorkflowStage;

export type QCMarkerCategory = 'audio' | 'video' | 'editorial' | 'graphics';
export type QCMarkerSeverity = 'warning' | 'critical';

export interface QCMarker {
  id: string;
  timeSec: number;
  endTimeSec?: number;
  timecode: string; // HH:MM:SS
  endTimecode?: string; // HH:MM:SS
  versionNumber?: number;
  category: QCMarkerCategory;
  severity: QCMarkerSeverity;
  note: string;
  author: string;
  createdAt: string;
  resolved?: boolean;
}

export interface MediaVersionEntry {
  versionNumber: number;
  videoFileName: string;
  videoUrl?: string;
  duration: string;
  uploadedBy: string;
  uploadedAt?: string;
  notes?: string;
  qcDecision?: 'approved' | 'needs_revision' | 'referred_to_director';
  qcMarkersSnapshot?: QCMarker[];
}

export interface WorkflowLogEntry {
  id: string;
  timestamp: string;
  fromStage: WorkflowStage;
  toStage: WorkflowStage;
  actorRole: AccessRoleLevel;
  actorName: string;
  versionNumber?: number;
  comment?: string;
}

export interface RoleDefinition {
  id: AccessRoleLevel;
  levelLabel: string;
  title: string;
  personName: string;
  department: string;
  canEditSchedule: boolean;
  canApproveReject: boolean;
  canLockTimes: boolean;
  canDeleteItems: boolean;
  canChangePlayoutStatus: boolean;
  canUploadMedia: boolean;
  canSendToQC: boolean;
  canPerformQC: boolean;
  canDirectorOverride: boolean;
  canReturnToProducer: boolean;
  canTrimPlayout: boolean;
  isMonitoringOnly?: boolean;
  inboxStages: WorkflowStage[];
  description: string;
}

export interface ScheduleItem {
  id: string;
  order: number;
  title: string;
  episode?: string;
  startTime: string; // HH:MM:SS
  duration: string; // HH:MM:SS
  endTime: string; // HH:MM:SS
  category: ProgramCategory;
  source: SignalSource;
  mediaCode: string;
  status: BroadcastStatus;
  lockStartTime?: boolean;
  notes?: string;
  aspectRatio?: string;
  audioTrack?: string;
  sponsor?: string;
  // Workflow, Offline Video, QC & Playout Trim Extensions
  workflowStatus?: WorkflowStage;
  videoUrl?: string;
  videoFileName?: string;
  sourceDurationSec?: number;
  trimInSec?: number;
  trimOutSec?: number;
  revisionVersion?: number;
  producerName?: string;
  assignedInspectorName?: string;
  createdBy?: string;
  createdByRole?: AccessRoleLevel;
  lastEditedBy?: string;
  lastEditedByRole?: AccessRoleLevel;
  lastEditedAt?: string;
  versions?: MediaVersionEntry[];
  qcMarkers?: QCMarker[];
  workflowHistory?: WorkflowLogEntry[];
}

export interface ScheduleRevisionEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: AccessRoleLevel;
  actionType: 'CREATED' | 'EDITED' | 'ITEM_ADDED' | 'ITEM_DELETED' | 'REORDERED' | 'RECALCULATED';
  summary: string;
}

export interface ConductorSchedule {
  id: string;
  title: string;
  channel: string;
  channelLogoColor: string;
  dateShamsi: string;
  dateGregorian: string;
  dayOfWeek: string;
  shiftName: string;
  supervisorName: string;
  plannerName: string;
  directorName?: string;
  createdBy?: string;
  createdByRole?: AccessRoleLevel;
  createdAt?: string;
  lastEditedBy?: string;
  lastEditedByRole?: AccessRoleLevel;
  lastEditedAt?: string;
  lastEditSummary?: string;
  scheduleEditHistory?: ScheduleRevisionEntry[];
  startTime: string;
  targetDurationHours: number;
  items: ScheduleItem[];
  updatedAt: string;
  notes: string;
}

export interface TimeAnomaly {
  id: string;
  type: 'overlap' | 'gap' | 'duration_mismatch' | 'rejected_item';
  severity: 'error' | 'warning';
  itemOrder: number;
  itemId: string;
  relatedItemOrder?: number;
  diffSeconds: number;
  message: string;
}

export const ROLES: RoleDefinition[] = [
  {
    id: 'level_1',
    levelLabel: 'سطح اول — مدیریت عالی پخش',
    title: 'مدیر پخش',
    personName: 'محمود فرشچیان',
    department: 'مدیریت پخش سیمای مرکز اصفهان',
    canEditSchedule: true,
    canApproveReject: true,
    canLockTimes: true,
    canDeleteItems: true,
    canChangePlayoutStatus: true,
    canUploadMedia: true,
    canSendToQC: true,
    canPerformQC: true,
    canDirectorOverride: true,
    canReturnToProducer: true,
    canTrimPlayout: true,
    inboxStages: ['qc_needs_revision', 'referred_to_director'],
    description:
      'دسترسی کامل مدیریتی: نگارش یا ویرایش مستقیم کنداکتور ۲۴ ساعته، بررسی پرونده‌های دارای اصلاحیه یا ارجاع‌شده از بازبین، تصمیم نهایی پخش و قفل باکس‌های کنداکتور با ثبت نام ویرایشگر.',
  },
  {
    id: 'level_2',
    levelLabel: 'سطح دوم — مدیریت هماهنگی و کنداکتور',
    title: 'واحد هماهنگی',
    personName: 'خانم مرادی',
    department: 'واحد هماهنگی، کنداکتورنویسی و دریافت برنامه',
    canEditSchedule: true,
    canApproveReject: false,
    canLockTimes: true,
    canDeleteItems: true,
    canChangePlayoutStatus: false,
    canUploadMedia: false,
    canSendToQC: true,
    canPerformQC: false,
    canDirectorOverride: false,
    canReturnToProducer: true,
    canTrimPlayout: false,
    inboxStages: [
      'uploaded_by_producer',
      'qc_approved',
      'approved_by_director',
      'rejected_by_director',
    ],
    description:
      'مسئول اصلی نگارش و تنظیم کنداکتور ۲۴ ساعته پخش، دریافت برنامه‌های تولید، ارجاع به بازبینی (QC)، ارسال پرونده‌های تاییدشده به صف پلی‌اوت و عودت موارد نیازمند اصلاح با ثبت کامل مشخصات تنظیم‌کننده.',
  },
  {
    id: 'qc_inspector',
    levelLabel: 'واحد بازبینی و کنترل کیفی',
    title: 'کارشناس بازبین (QC)',
    personName: 'مهندس کریمی',
    department: 'واحد بازبینی فنی و محتوایی سیما',
    canEditSchedule: false,
    canApproveReject: true,
    canLockTimes: false,
    canDeleteItems: false,
    canChangePlayoutStatus: false,
    canUploadMedia: false,
    canSendToQC: false,
    canPerformQC: true,
    canDirectorOverride: false,
    canReturnToProducer: false,
    canTrimPlayout: false,
    inboxStages: ['in_qc_review'],
    description:
      'مشاهده فریم‌به‌فریم ویدیوها در پلیر بازبینی، ثبت مارکر اصلاحیه در زمان دقیق یا بازه زمانی، و ثبت تایید جهت ادامه پخش، درخواست اصلاح یا ارجاع به مدیر پخش.',
  },
  {
    id: 'level_3',
    levelLabel: 'سطح سوم — مدیریت پلی‌اوت',
    title: 'مسئول مدیریت پلی‌اوت',
    personName: 'مهندس رضایی',
    department: 'مدیریت پلی‌اوت و رژی پخش (MCR)',
    canEditSchedule: false,
    canApproveReject: true,
    canLockTimes: false,
    canDeleteItems: false,
    canChangePlayoutStatus: true,
    canUploadMedia: false,
    canSendToQC: false,
    canPerformQC: true,
    canDirectorOverride: false,
    canReturnToProducer: false,
    canTrimPlayout: true,
    inboxStages: ['approved_for_playout', 'on_air'],
    description:
      'دریافت فایل‌های تاییدشده در صف پلی‌اوت، کنترل پیش از پخش، تعیین محدوده زمانی استفاده (Mark In / Mark Out)، مدیریت چیدمان پلی‌لیست و اجرای پخش روی آنتن.',
  },
  {
    id: 'operator',
    levelLabel: 'سطح چهارم — پایش پخش آنتن',
    title: 'اپراتور پایش پخش',
    personName: 'اپراتور شیفت MCR',
    department: 'واحد پایش و نظارت اجرای پخش (Monitoring)',
    canEditSchedule: false,
    canApproveReject: false,
    canLockTimes: false,
    canDeleteItems: false,
    canChangePlayoutStatus: false,
    canUploadMedia: false,
    canSendToQC: false,
    canPerformQC: false,
    canDirectorOverride: false,
    canReturnToProducer: false,
    canTrimPlayout: false,
    isMonitoringOnly: true,
    inboxStages: ['approved_for_playout', 'on_air'],
    description:
      'حالت پایش صرف (Read-Only): مشاهده وضعیت آمادگی فایل‌ها، زمان‌بندی، چیدمان پلی‌لیست و اجرای پخش روی آنتن و ثبت خطاهای احتمالی بدون اجازه تغییر یا ویرایش.',
  },
  {
    id: 'producer_editor',
    levelLabel: 'واحد تولید و تدوین',
    title: 'تهیه‌کننده و تدوینگر',
    personName: 'واحد تولید سیمای اصفهان',
    department: 'معاونت سیما — باکس تولید و تدوین',
    canEditSchedule: false,
    canApproveReject: false,
    canLockTimes: false,
    canDeleteItems: false,
    canChangePlayoutStatus: false,
    canUploadMedia: true,
    canSendToQC: false,
    canPerformQC: false,
    canDirectorOverride: false,
    canReturnToProducer: false,
    canTrimPlayout: false,
    inboxStages: ['returned_to_producer'],
    description:
      'بارگذاری فایل ویدیویی برنامه از روی دیسک (۱۰۰٪ آفلاین)، مشاهده اصلاحیه‌های بازه‌ای برگشتی از هماهنگی و بارگذاری نسخه اصلاح‌شده جدید با حفظ سوابق نسخه‌های قبلی.',
  },
];

export const WORKFLOW_STAGE_META: Record<
  WorkflowStage,
  {
    stepNumber: number;
    label: string;
    shortLabel: string;
    badgeClass: string;
    targetRoleLabel: string;
    ownerRole: AccessRoleLevel;
    colorClass: string;
  }
> = {
  uploaded_by_producer: {
    stepNumber: 1,
    label: 'تحویل تولید (در انتظار ارجاع هماهنگی)',
    shortLabel: 'تحویل تهیه‌کننده',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    targetRoleLabel: 'واحد هماهنگی',
    ownerRole: 'level_2',
    colorClass: 'text-sky-300',
  },
  in_qc_review: {
    stepNumber: 3,
    label: 'در حال بازبینی و کنترل کیفی (QC)',
    shortLabel: 'در انتظار بازبینی',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    targetRoleLabel: 'کارشناس بازبین',
    ownerRole: 'qc_inspector',
    colorClass: 'text-amber-300',
  },
  qc_approved: {
    stepNumber: 4,
    label: 'تأیید بازبین (آماده ارسال هماهنگی به پلی‌اوت)',
    shortLabel: 'تأیید بازبین (QC)',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    targetRoleLabel: 'واحد هماهنگی',
    ownerRole: 'level_2',
    colorClass: 'text-emerald-300',
  },
  qc_needs_revision: {
    stepNumber: 4,
    label: 'دارای اصلاحیه بازبین (منتظر تصمیم مدیر پخش)',
    shortLabel: 'کارتابل مدیر پخش',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
    targetRoleLabel: 'مدیر پخش',
    ownerRole: 'level_1',
    colorClass: 'text-orange-300',
  },
  referred_to_director: {
    stepNumber: 4,
    label: 'ارجاع بازبین به مدیر پخش جهت تصمیم‌گیری',
    shortLabel: 'ارجاع به مدیر پخش',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
    targetRoleLabel: 'مدیر پخش',
    ownerRole: 'level_1',
    colorClass: 'text-orange-300',
  },
  approved_by_director: {
    stepNumber: 5,
    label: 'تأیید مدیر پخش (بازگشت به هماهنگی جهت پخش)',
    shortLabel: 'تأیید مدیر پخش',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    targetRoleLabel: 'واحد هماهنگی',
    ownerRole: 'level_2',
    colorClass: 'text-emerald-300',
  },
  rejected_by_director: {
    stepNumber: 5,
    label: 'الزام به اصلاح مدیر پخش (منتظر عودت هماهنگی)',
    shortLabel: 'رد مدیر پخش',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    targetRoleLabel: 'واحد هماهنگی',
    ownerRole: 'level_2',
    colorClass: 'text-rose-300',
  },
  returned_to_producer: {
    stepNumber: 6,
    label: 'عودت به تهیه‌کننده / تدوینگر جهت اصلاح',
    shortLabel: 'نیازمند اصلاح تدوین',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    targetRoleLabel: 'تهیه‌کننده / تدوینگر',
    ownerRole: 'producer_editor',
    colorClass: 'text-rose-300',
  },
  approved_for_playout: {
    stepNumber: 8,
    label: 'تأیید نهایی (آماده در صف مدیریت پلی‌اوت)',
    shortLabel: 'آماده در پلی‌اوت',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    targetRoleLabel: 'مسئول پلی‌اوت',
    ownerRole: 'level_3',
    colorClass: 'text-teal-300',
  },
  on_air: {
    stepNumber: 10,
    label: 'در حال پخش روی آنتن (On-Air)',
    shortLabel: 'روی آنتن',
    badgeClass: 'bg-rose-500/25 text-rose-200 border-rose-500/50 font-bold',
    targetRoleLabel: 'رژی پخش',
    ownerRole: 'level_3',
    colorClass: 'text-rose-200',
  },
  aired: {
    stepNumber: 11,
    label: 'پخش شده (آرشیو)',
    shortLabel: 'پخش شده',
    badgeClass: 'bg-slate-800/60 text-slate-400 border-slate-700/60',
    targetRoleLabel: 'آرشیو',
    ownerRole: 'level_3',
    colorClass: 'text-slate-400',
  },
};

export const WORKFLOW_STATUS_META = WORKFLOW_STAGE_META;

export const QC_CATEGORY_META: Record<
  QCMarkerCategory,
  { label: string; shortLabel: string; colorClass: string }
> = {
  audio: {
    label: 'ایراد فنی صدا (Audio)',
    shortLabel: 'فنی / صدا',
    colorClass: 'text-amber-300',
  },
  video: {
    label: 'ایراد فنی تصویر (Video)',
    shortLabel: 'تصویر',
    colorClass: 'text-cyan-300',
  },
  editorial: {
    label: 'ملاحظات محتوایی / ممیزی',
    shortLabel: 'محتوایی / ممیزی',
    colorClass: 'text-rose-300',
  },
  graphics: {
    label: 'زیرنویس و گرافیک',
    shortLabel: 'زیرنویس و گرافیک',
    colorClass: 'text-purple-300',
  },
};

export const QC_SEVERITY_META: Record<
  QCMarkerSeverity,
  { label: string; colorClass: string; pinColor: string }
> = {
  critical: {
    label: 'خطای بحرانی (مانع پخش)',
    colorClass: 'text-rose-400',
    pinColor: '#f43f5e',
  },
  warning: {
    label: 'تذکر فنی / قابل اغماض',
    colorClass: 'text-amber-300',
    pinColor: '#f59e0b',
  },
};

export const CATEGORY_META: Record<
  ProgramCategory,
  { label: string; shortLabel: string; colorClass: string; printLabel: string }
> = {
  live: {
    label: 'برنامه زنده استودیویی',
    shortLabel: 'زنده',
    colorClass: 'text-rose-400',
    printLabel: 'زنده',
  },
  news: {
    label: 'بخش خبری و گزارش',
    shortLabel: 'خبری',
    colorClass: 'text-amber-400',
    printLabel: 'خبر',
  },
  series: {
    label: 'فیلم و سریال نمایشی',
    shortLabel: 'فیلم و سریال',
    colorClass: 'text-cyan-300',
    printLabel: 'نمایشی',
  },
  production: {
    label: 'تولیدی و مستند',
    shortLabel: 'تولیدی / مستند',
    colorClass: 'text-teal-300',
    printLabel: 'تولیدی',
  },
  religious: {
    label: 'معارف، اذان و مناجات',
    shortLabel: 'معارف و اذان',
    colorClass: 'text-emerald-300',
    printLabel: 'معارف',
  },
  ad: {
    label: 'پیام بازرگانی (آگهی)',
    shortLabel: 'بازرگانی',
    colorClass: 'text-purple-300',
    printLabel: 'بازرگانی',
  },
  promo: {
    label: 'تیزر و اعلام برنامه',
    shortLabel: 'تیزر / پرومو',
    colorClass: 'text-sky-300',
    printLabel: 'تیزر',
  },
  filler: {
    label: 'میان‌برنامه و موسیقی تصویر',
    shortLabel: 'میان‌برنامه',
    colorClass: 'text-slate-400',
    printLabel: 'میان‌برنامه',
  },
};

export const SOURCE_META: Record<
  SignalSource,
  { label: string; code: string; colorClass: string }
> = {
  live_studio: {
    label: 'استودیو پخش زنده',
    code: 'STUDIO-LIVE',
    colorClass: 'text-rose-300',
  },
  server1: {
    label: 'سرور پلی‌اوت اصلی ۱',
    code: 'SRV-PLAY-01',
    colorClass: 'text-cyan-300',
  },
  server2: {
    label: 'سرور بازرگانی و تیزر ۲',
    code: 'SRV-COMM-02',
    colorClass: 'text-purple-300',
  },
  ob_van: {
    label: 'واحد سیار / نود مرکزی',
    code: 'OB-VAN / MCR',
    colorClass: 'text-amber-300',
  },
  satellite: {
    label: 'دریافت ماهواره / فیبر نوری',
    code: 'SAT-FEED',
    colorClass: 'text-emerald-300',
  },
};

export const STATUS_META: Record<
  BroadcastStatus,
  { label: string; colorClass: string; dotClass: string }
> = {
  on_air: {
    label: 'در نوبت / روی آنتن',
    colorClass: 'text-rose-300',
    dotClass: 'bg-rose-500',
  },
  ready: {
    label: 'آماده پخش (بازبینی‌شده)',
    colorClass: 'text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
  aired: {
    label: 'پخش شده (آرشیو)',
    colorClass: 'text-slate-400',
    dotClass: 'bg-slate-500',
  },
  rejected: {
    label: 'نقص فنی / رد نظارت',
    colorClass: 'text-amber-300',
    dotClass: 'bg-amber-400',
  },
};

export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map((n) => parseInt(n, 10) || 0);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}

export function formatSecondsToTime(totalSeconds: number): string {
  const normalized = ((Math.round(totalSeconds) % 86400) + 86400) % 86400;
  const h = Math.floor(normalized / 3600);
  const m = Math.floor((normalized % 3600) / 60);
  const s = normalized % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function formatDurationTotal(totalSeconds: number): string {
  const abs = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function computeEndTime(startTime: string, duration: string): string {
  const startSec = parseTimeToSeconds(startTime);
  const durSec = parseTimeToSeconds(duration);
  return formatSecondsToTime(startSec + durSec);
}

export function mapWorkflowToBroadcastStatus(
  wf: WorkflowStage
): BroadcastStatus {
  switch (wf) {
    case 'on_air':
      return 'on_air';
    case 'aired':
      return 'aired';
    case 'approved_for_playout':
    case 'qc_approved':
    case 'approved_by_director':
      return 'ready';
    case 'qc_needs_revision':
    case 'referred_to_director':
    case 'rejected_by_director':
    case 'returned_to_producer':
      return 'rejected';
    case 'uploaded_by_producer':
    case 'in_qc_review':
    default:
      return 'ready';
  }
}

const RAW_SCHEDULE_ITEMS: Partial<ScheduleItem>[] = [
  {
    id: 'item-1',
    order: 1,
    title: 'سرود ملی جمهوری اسلامی ایران و تلاوت قرآن کریم',
    startTime: '06:00:00',
    duration: '00:08:30',
    endTime: '06:08:30',
    category: 'religious',
    source: 'ob_van',
    mediaCode: 'IRIB-ANTHEM-01',
    status: 'aired',
    workflowStatus: 'aired',
    notes: 'پخش با لوگوی رسمی شبکه و پرچم متحرک',
    aspectRatio: '16:9 HD',
    audioTrack: 'stereo',
  },
  {
    id: 'item-2',
    order: 2,
    title: 'اعلام و معرفی برنامه‌های روزانه',
    startTime: '06:08:30',
    duration: '00:03:00',
    endTime: '06:11:30',
    category: 'promo',
    source: 'server1',
    mediaCode: 'DAILY-PROMO-102',
    status: 'aired',
    workflowStatus: 'aired',
    notes: 'زیرنویس ساعت پخش سریال شبانه',
    aspectRatio: '16:9 HD',
  },
  {
    id: 'item-3',
    order: 3,
    title: 'برنامه زنده صبحگاهی «سلام ایران / صبح نصف جهان» (بخش اول)',
    episode: 'قسمت ۱۸۲',
    startTime: '06:11:30',
    duration: '00:45:00',
    endTime: '06:56:30',
    category: 'live',
    source: 'live_studio',
    mediaCode: 'LIVE-STUDIO-A',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    notes: 'سوییچ به استودیو ۱ - مجری: آقای رضایی / ارتباط زنده با هواشناسی اصفهان',
    aspectRatio: '16:9 HD',
  },
  {
    id: 'item-4',
    order: 4,
    title: 'باکس پیام بازرگانی و تبلیغات صبحگاهی',
    startTime: '06:56:30',
    duration: '00:03:30',
    endTime: '07:00:00',
    category: 'ad',
    source: 'server2',
    mediaCode: 'AD-BOX-0700',
    status: 'aired',
    workflowStatus: 'aired',
    notes: 'اسپانسر اصلی: بانک ملی / بیمه سلامت',
    sponsor: 'اسپانسرهای صبحگاهی',
  },
  {
    id: 'item-5',
    order: 5,
    title: 'بخش خبری ساعت ۷ صبح',
    startTime: '07:00:00',
    duration: '00:15:00',
    endTime: '07:15:00',
    category: 'news',
    source: 'live_studio',
    mediaCode: 'NEWS-0700-LIVE',
    status: 'aired',
    workflowStatus: 'aired',
    lockStartTime: true,
    notes: 'رأس ساعت ۰۷:۰۰:۰۰ دقیق - سوییچ به نود خبر',
  },
  {
    id: 'item-6',
    order: 6,
    title: 'وله تصویری و موزیک صبحگاهی',
    startTime: '07:15:00',
    duration: '00:04:15',
    endTime: '07:19:15',
    category: 'filler',
    source: 'server1',
    mediaCode: 'MUSIC-MORNING-05',
    status: 'on_air',
    workflowStatus: 'on_air',
  },
  {
    id: 'item-7',
    order: 7,
    title: 'برنامه زنده «سلام ایران / صبح نصف جهان» (بخش دوم)',
    episode: 'قسمت ۱۸۲',
    startTime: '07:19:15',
    duration: '00:40:45',
    endTime: '08:00:00',
    category: 'live',
    source: 'live_studio',
    mediaCode: 'LIVE-STUDIO-A',
    status: 'rejected',
    workflowStatus: 'qc_needs_revision',
    producerName: 'گروه اجتماعی سیمای اصفهان',
    notes: 'میهمان: کارشناس تغذیه و طب سنتی — دارای ۲ مورد اصلاحیه بازبینی در کارتابل مدیر پخش',
    qcMarkers: [
      {
        id: 'qc-1',
        timeSec: 425,
        timecode: '00:07:05',
        category: 'audio',
        severity: 'critical',
        note: 'افت شدید تراز صدا (Drop Audio) در میکروفون کارشناس به مدت ۶ ثانیه',
        author: 'مهندس کریمی (بازبین)',
        createdAt: '1405/07/13 - 06:40',
      },
      {
        id: 'qc-2',
        timeSec: 1310,
        timecode: '00:21:50',
        category: 'graphics',
        severity: 'warning',
        note: 'غلط املایی در زیرنویس معرفی میهمان برنامه',
        author: 'مهندس کریمی (بازبین)',
        createdAt: '1405/07/13 - 06:45',
      },
    ],
    workflowHistory: [
      {
        id: 'wh-7-1',
        timestamp: '06:15',
        fromStage: 'uploaded_by_producer',
        toStage: 'in_qc_review',
        actorRole: 'level_2',
        actorName: 'خانم مرادی (مدیر هماهنگی)',
        comment: 'ارسال فایل به واحد بازبینی و کنترل کیفی (QC)',
      },
      {
        id: 'wh-7-2',
        timestamp: '06:45',
        fromStage: 'in_qc_review',
        toStage: 'qc_needs_revision',
        actorRole: 'qc_inspector',
        actorName: 'مهندس کریمی (بازبین)',
        comment: 'ثبت ۲ اصلاحیه روی تایم‌لاین (00:07:05 و 00:21:50) و ارجاع به مدیر پخش',
      },
    ],
  },
  {
    id: 'item-8',
    order: 8,
    title: 'پویانمایی و کارتون کودک «ماجراهای جنگل»',
    episode: 'قسمت ۱۲',
    startTime: '08:00:00',
    duration: '00:25:00',
    endTime: '08:25:00',
    category: 'production',
    source: 'server1',
    mediaCode: 'ANIM-JUNGLE-12',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    notes: 'رده‌بندی سنی خردسال / بازبینی شده',
  },
  {
    id: 'item-9',
    order: 9,
    title: 'مستند حیات وحش ایران (کویر لوت و تالاب گاوخونی)',
    episode: 'قسمت ۴: تالاب گاوخونی',
    startTime: '08:25:00',
    duration: '00:45:00',
    endTime: '09:10:00',
    category: 'production',
    source: 'server1',
    mediaCode: 'DOC-WILD-04',
    status: 'ready',
    workflowStatus: 'in_qc_review',
    producerName: 'واحد مستندسازی مرکز اصفهان',
    aspectRatio: '4K UHD',
    audioTrack: 'stereo',
    notes: 'ارسال شده توسط هماهنگی به کارتابل بازبین جهت کنترل کیفی',
  },
  {
    id: 'item-10',
    order: 10,
    title: 'تیزر سریال‌های جدید و مسابقه هفتگی',
    startTime: '09:10:00',
    duration: '00:05:00',
    endTime: '09:15:00',
    category: 'promo',
    source: 'server2',
    mediaCode: 'PROMO-SERIES-W1',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
  },
  {
    id: 'item-11',
    order: 11,
    title: 'سریال تلویزیونی بازپخش «پایتخت»',
    episode: 'فصل ۶ - قسمت ۸',
    startTime: '09:15:00',
    duration: '00:50:00',
    endTime: '10:05:00',
    category: 'series',
    source: 'server1',
    mediaCode: 'SER-PAYTAKHT-608',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    notes: 'زیرنویس همزمان برای ناشنوایان',
  },
  {
    id: 'item-12',
    order: 12,
    title: 'پیام‌های بازرگانی میان‌برنامه',
    startTime: '10:05:00',
    duration: '00:05:00',
    endTime: '10:10:00',
    category: 'ad',
    source: 'server2',
    mediaCode: 'AD-MID-1000',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
  },
  {
    id: 'item-13',
    order: 13,
    title: 'ویژه‌برنامه خانواده و مهارت‌های زندگی «زندگی خوب»',
    episode: 'بخش زنده',
    startTime: '10:10:00',
    duration: '01:10:00',
    endTime: '11:20:00',
    category: 'live',
    source: 'live_studio',
    mediaCode: 'LIVE-STUDIO-B',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
  },
  {
    id: 'item-14',
    order: 14,
    title: 'مقدمات اذان، مناجات و ادعیه ظهرگاهی',
    startTime: '11:20:00',
    duration: '00:20:00',
    endTime: '11:40:00',
    category: 'religious',
    source: 'server1',
    mediaCode: 'REL-MONAJAT-NOON',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    lockStartTime: true,
    notes: 'پخش تواشیح و تصویر زنده میدان امام (ره) و اماکن متبرکه',
  },
  {
    id: 'item-15',
    order: 15,
    title: 'پخش زنده اذان ظهر به افق اصفهان و احکام شرعی',
    startTime: '11:40:00',
    duration: '00:30:00',
    endTime: '12:10:00',
    category: 'religious',
    source: 'server1',
    mediaCode: 'AZAN-NOON-LIVE',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    lockStartTime: true,
    notes: 'افق اصفهان و اعلام اوقات شرعی شهرستان‌های استان در زیرنویس',
  },
  {
    id: 'item-16',
    order: 16,
    title: 'مستند علمی فناوری و نوآوری (شهر علمی و تحقیقاتی)',
    episode: 'قسمت ۲: هوش مصنوعی در پزشکی',
    startTime: '12:10:00',
    duration: '00:35:00',
    endTime: '12:45:00',
    category: 'production',
    source: 'satellite',
    mediaCode: 'DOC-TECH-02',
    status: 'ready',
    workflowStatus: 'uploaded_by_producer',
    producerName: 'واحد تولید گروه دانش و فناوری',
    notes: 'بارگذاری شده توسط تهیه‌کننده — در کارتابل هماهنگی جهت ارجاع به بازبین',
  },
  {
    id: 'item-17',
    order: 17,
    title: 'پیام بازرگانی قبل از خبر نیمروزی',
    startTime: '12:45:00',
    duration: '00:15:00',
    endTime: '13:00:00',
    category: 'promo',
    source: 'server2',
    mediaCode: 'AD-PRE-NEWS14',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    notes: 'اولویت باکس طلایی بازرگانی',
  },
  {
    id: 'item-18',
    order: 18,
    title: 'بخش خبری ساعت ۱۴ (خبر سراسری / استان)',
    startTime: '13:00:00',
    duration: '00:45:00',
    endTime: '13:45:00',
    category: 'news',
    source: 'live_studio',
    mediaCode: 'NEWS-1400-MAIN',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    lockStartTime: true,
    notes: 'رأس ساعت ۱۴:۰۰:۰۰ - سوییچ سراسری',
  },
  {
    id: 'item-19',
    order: 19,
    title: 'فیلم سینمایی بعدازظهر «تختی»',
    startTime: '13:45:00',
    duration: '01:45:00',
    endTime: '15:30:00',
    category: 'series',
    source: 'server1',
    mediaCode: 'MOV-TAKHTI-HD',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    notes: 'فرمت ۱۰۸۰p - صدای دالبی استریو',
  },
  {
    id: 'item-20',
    order: 20,
    title: 'مسابقه تلویزیونی و سرگرمی «برنده باش»',
    episode: 'قسمت ۴۴',
    startTime: '15:30:00',
    duration: '01:00:00',
    endTime: '16:30:00',
    category: 'filler',
    source: 'server1',
    mediaCode: 'QUIZ-BARANDE-44',
    status: 'rejected',
    workflowStatus: 'rejected_by_director',
    producerName: 'گروه مسابقات و سرگرمی',
    notes: 'رد شده توسط مدیر پخش — در کارتابل هماهنگی جهت عودت به تهیه‌کننده',
    qcMarkers: [
      {
        id: 'qc-3',
        timeSec: 890,
        timecode: '00:14:50',
        category: 'editorial',
        severity: 'critical',
        note: 'نیاز به حذف پلان تبلیغاتی غیرمجاز از دقیقه ۱۴:۵۰ تا ۱۵:۲۰ طبق نظر بازبین و مدیر پخش',
        author: 'مهندس کریمی (بازبین)',
        createdAt: '1405/07/13 - 07:05',
      },
    ],
    workflowHistory: [
      {
        id: 'wh-20-1',
        timestamp: '07:05',
        fromStage: 'in_qc_review',
        toStage: 'qc_needs_revision',
        actorRole: 'qc_inspector',
        actorName: 'مهندس کریمی (بازبین)',
        comment: 'ثبت ایراد ممیزی در دقیقه ۱۴:۵۰ و ارجاع به مدیر پخش',
      },
      {
        id: 'wh-20-2',
        timestamp: '07:15',
        fromStage: 'qc_needs_revision',
        toStage: 'rejected_by_director',
        actorRole: 'level_1',
        actorName: 'محمود فرشچیان (مدیر پخش)',
        comment: 'تایید اصلاحیه و ارجاع به هماهنگی (جهت عودت به تولید)',
      },
    ],
  },
  {
    id: 'item-21',
    order: 21,
    title: 'باکس آگهی بازرگانی عصرگاهی',
    startTime: '16:30:00',
    duration: '00:08:00',
    endTime: '16:38:00',
    category: 'ad',
    source: 'server2',
    mediaCode: 'AD-EVE-1630',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
  },
  {
    id: 'item-22',
    order: 22,
    title: 'برنامه عصرانه «عصر نصف جهان» (جوان و فناوری)',
    episode: 'زنده',
    startTime: '16:38:00',
    duration: '01:02:00',
    endTime: '17:40:00',
    category: 'live',
    source: 'live_studio',
    mediaCode: 'LIVE-STUDIO-C',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
  },
  {
    id: 'item-23',
    order: 23,
    title: 'اذان مغرب و عشاء به افق اصفهان و ویژه مغرب',
    startTime: '17:40:00',
    duration: '00:35:00',
    endTime: '18:15:00',
    category: 'religious',
    source: 'server1',
    mediaCode: 'AZAN-MAGHRIB-LIVE',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    lockStartTime: true,
    notes: 'پخش زنده دعای فرج و قرائت قرآن',
  },
  {
    id: 'item-24',
    order: 24,
    title: 'سریال شبانگاهی جدید «نون خ»',
    episode: 'فصل ۵ - قسمت ۲',
    startTime: '18:15:00',
    duration: '00:50:00',
    endTime: '19:05:00',
    category: 'series',
    source: 'server1',
    mediaCode: 'SER-NOONKHE-502',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    sourceDurationSec: 3300, // 00:55:00
    trimInSec: 60, // 00:01:00
    trimOutSec: 3060, // 00:51:00 -> net duration 00:50:00
    notes: 'پخش اول (Prime Time) / تریم پلی‌اوت فعال (حذف ۱ دقیقه ابتدا و ۴ دقیقه انتها)',
  },
  {
    id: 'item-25',
    order: 25,
    title: 'پیام‌های بازرگانی ویژه سریال و خبر شامگاهی',
    startTime: '19:05:00',
    duration: '00:15:00',
    endTime: '19:20:00',
    category: 'ad',
    source: 'server2',
    mediaCode: 'AD-GOLDEN-PRIME',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    notes: 'باکس طلایی تجاری',
  },
  {
    id: 'item-26',
    order: 26,
    title: 'مجله خبری و گزارش ویژه استان اصفهان',
    startTime: '19:20:00',
    duration: '00:40:00',
    endTime: '20:00:00',
    category: 'news',
    source: 'live_studio',
    mediaCode: 'NEWS-MAGAZINE-20',
    status: 'rejected',
    workflowStatus: 'returned_to_producer',
    producerName: 'تحریریه مجله خبری',
    notes: 'عودت داده شده توسط هماهنگی به تدوینگر جهت اصلاح سینک صدا',
    qcMarkers: [
      {
        id: 'qc-m26-1',
        timeSec: 420,
        timecode: '00:07:00',
        category: 'audio',
        severity: 'critical',
        note: 'عدم همگامی صدا و تصویر (Lip-Sync) در گزارش میدانی پل خواجو.',
        author: 'مهندس کریمی (بازبین)',
        createdAt: '1405/07/13 - 07:00',
      },
    ],
    workflowHistory: [
      {
        id: 'wh-26-1',
        timestamp: '07:00',
        fromStage: 'in_qc_review',
        toStage: 'qc_needs_revision',
        actorRole: 'qc_inspector',
        actorName: 'مهندس کریمی (بازبین)',
        comment: 'ثبت ایراد سینک صدا در دقیقه ۰۷:۰۰ و ارسال به مدیر پخش',
      },
      {
        id: 'wh-26-2',
        timestamp: '07:12',
        fromStage: 'qc_needs_revision',
        toStage: 'rejected_by_director',
        actorRole: 'level_1',
        actorName: 'محمود فرشچیان (مدیر پخش)',
        comment: 'رد توسط مدیر پخش و ارجاع به هماهنگی',
      },
      {
        id: 'wh-26-3',
        timestamp: '07:18',
        fromStage: 'rejected_by_director',
        toStage: 'returned_to_producer',
        actorRole: 'level_2',
        actorName: 'خانم مرادی (مدیر هماهنگی)',
        comment: 'عودت برنامه به تهیه‌کننده / تدوینگر جهت اصلاح',
      },
    ],
  },
  {
    id: 'item-27',
    order: 27,
    title: 'پیام بازرگانی قبل از اخبار ساعت ۲۰:۱۵',
    startTime: '20:00:00',
    duration: '00:15:00',
    endTime: '20:15:00',
    category: 'ad',
    source: 'server2',
    mediaCode: 'AD-PRE-NEWS21',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
  },
  {
    id: 'item-28',
    order: 28,
    title: 'اخبار استان اصفهان و سراسری (مهم‌ترین بخش خبری)',
    startTime: '20:15:00',
    duration: '00:45:00',
    endTime: '21:00:00',
    category: 'news',
    source: 'satellite',
    mediaCode: 'NEWS-2100-PRIME',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    lockStartTime: true,
    notes: 'سوییچ با رژی نود مرکزی - بدون تاخیر',
  },
  {
    id: 'item-29',
    order: 29,
    title: 'برنامه گفتگوی ویژه خبری زنده (مسائل استان)',
    startTime: '21:00:00',
    duration: '00:45:00',
    endTime: '21:45:00',
    category: 'live',
    source: 'live_studio',
    mediaCode: 'TALK-NEWS-LIVE',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    notes: 'موضوع: بودجه عمرانی، زاینده‌رود و زیرساخت‌های استان اصفهان',
  },
  {
    id: 'item-30',
    order: 30,
    title: 'فیلم سینمایی پربیننده شب «موقعیت مهدی»',
    startTime: '21:45:00',
    duration: '02:00:00',
    endTime: '23:45:00',
    category: 'series',
    source: 'server1',
    mediaCode: 'MOV-MEHDI-FHD',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    notes: 'نسخه سینمایی برنده سیمرغ',
  },
  {
    id: 'item-31',
    order: 31,
    title: 'موسیقی تصویر و میان‌برنامه آرامش‌بخش شبانه (نگارستان اصفهان)',
    startTime: '23:45:00',
    duration: '00:15:00',
    endTime: '00:00:00',
    category: 'filler',
    source: 'server1',
    mediaCode: 'NIGHT-MUSIC-01',
    status: 'ready',
    workflowStatus: 'approved_for_playout',
    producerName: 'واحد تامین برنامه و میان‌برنامه',
    notes: 'پایان باکس ۲۴ ساعته روز جاری',
  },
];

export function hydrateScheduleItem(raw: Partial<ScheduleItem>): ScheduleItem {
  const durationStr = raw.duration || '00:15:00';
  const startTimeStr = raw.startTime || '06:00:00';
  const netDurSec = Math.max(10, parseTimeToSeconds(durationStr));
  const sourceDurSec = raw.sourceDurationSec ?? netDurSec;
  const trimIn = raw.trimInSec ?? 0;
  const trimOut = raw.trimOutSec ?? sourceDurSec;

  const wf: WorkflowStage =
    raw.workflowStatus ||
    (raw.status === 'rejected'
      ? 'qc_needs_revision'
      : raw.status === 'aired'
      ? 'aired'
      : raw.status === 'on_air'
      ? 'on_air'
      : 'approved_for_playout');

  const revNum = raw.revisionVersion || 1;
  const prodName = raw.producerName || 'واحد تولید و تدوین سیمای اصفهان';
  const codeStr = raw.mediaCode || 'IRIB-ISF-100';
  const fileNameStr =
    raw.videoFileName || `${codeStr}_v${revNum}.mp4`;

  const defaultDecision: MediaVersionEntry['qcDecision'] =
    wf === 'approved_for_playout' ||
    wf === 'qc_approved' ||
    wf === 'approved_by_director' ||
    wf === 'on_air' ||
    wf === 'aired'
      ? 'approved'
      : wf === 'qc_needs_revision' ||
        wf === 'rejected_by_director' ||
        wf === 'returned_to_producer'
      ? 'needs_revision'
      : wf === 'referred_to_director'
      ? 'referred_to_director'
      : undefined;

  const versionsList: MediaVersionEntry[] =
    raw.versions && raw.versions.length > 0
      ? raw.versions
      : [
          {
            versionNumber: revNum,
            videoFileName: fileNameStr,
            videoUrl: raw.videoUrl,
            duration: durationStr,
            uploadedBy: prodName,
            uploadedAt: '1405/07/13 - 06:00',
            notes:
              raw.notes || 'نسخه اولیه ثبت‌شده در کنداکتور ۲۴ ساعته شبکه اصفهان',
            qcDecision: defaultDecision,
            qcMarkersSnapshot: raw.qcMarkers || [],
          },
        ];

  return {
    id: raw.id || `item-${Date.now()}`,
    order: raw.order || 1,
    title: raw.title || 'برنامه تلویزیونی',
    episode: raw.episode,
    startTime: startTimeStr,
    duration: durationStr,
    endTime: raw.endTime || computeEndTime(startTimeStr, durationStr),
    category: raw.category || 'production',
    source: raw.source || 'server1',
    mediaCode: codeStr,
    status: mapWorkflowToBroadcastStatus(wf),
    workflowStatus: wf,
    lockStartTime: raw.lockStartTime,
    notes: raw.notes,
    aspectRatio: raw.aspectRatio || '16:9 HD',
    audioTrack: raw.audioTrack || 'stereo',
    sponsor: raw.sponsor,
    videoUrl: raw.videoUrl,
    videoFileName: raw.videoFileName,
    sourceDurationSec: sourceDurSec,
    trimInSec: trimIn,
    trimOutSec: trimOut,
    revisionVersion: revNum,
    producerName: prodName,
    createdBy: raw.createdBy || 'خانم مرادی (واحد هماهنگی)',
    createdByRole: raw.createdByRole || 'level_2',
    lastEditedBy: raw.lastEditedBy,
    lastEditedByRole: raw.lastEditedByRole,
    lastEditedAt: raw.lastEditedAt,
    versions: versionsList,
    qcMarkers: raw.qcMarkers || [],
    workflowHistory: raw.workflowHistory || [
      {
        id: `init-${raw.id}`,
        timestamp: '06:00',
        fromStage: wf,
        toStage: wf,
        actorRole: 'level_2',
        actorName: 'خانم مرادی (واحد هماهنگی)',
        comment: 'نگارش و ثبت اولیه ردیف در کنداکتور ۲۴ ساعته شبکه اصفهان',
      },
    ],
  };
}

export const ATTACHED_CONDUCTOR_SCHEDULE: ConductorSchedule = {
  id: 'sched-24h-national',
  title: 'کنداکتور ۲۴ ساعته پخش شبکه اصفهان',
  channel: 'شبکه اصفهان',
  channelLogoColor: 'from-teal-600 to-cyan-500',
  dateShamsi: '1405/07/13',
  dateGregorian: '2026-10-04',
  dayOfWeek: 'دوشنبه',
  shiftName: 'کنداکتور ۲۴ ساعته (روزانه)',
  supervisorName: 'مهندس رضایی',
  plannerName: 'خانم مرادی',
  directorName: 'محمود فرشچیان',
  createdBy: 'خانم مرادی (واحد هماهنگی)',
  createdByRole: 'level_2',
  createdAt: '1405/07/13 - 05:30',
  lastEditedBy: 'محمود فرشچیان (مدیر پخش)',
  lastEditedByRole: 'level_1',
  lastEditedAt: '1405/07/13 - 05:50',
  lastEditSummary: 'بازبینی نهایی چیدمان کنداکتور ۲۴ ساعته و قفل باکس‌های خبری و اذان به افق اصفهان',
  scheduleEditHistory: [
    {
      id: 'rev-init-2',
      timestamp: '05:50:00',
      actorName: 'محمود فرشچیان (مدیر پخش)',
      actorRole: 'level_1',
      actionType: 'EDITED',
      summary: 'بازبینی مدیریتی چیدمان کنداکتور و تثبیت باکس‌های رأس ساعت (اخبار و اذان)',
    },
    {
      id: 'rev-init-1',
      timestamp: '05:30:00',
      actorName: 'خانم مرادی (واحد هماهنگی)',
      actorRole: 'level_2',
      actionType: 'CREATED',
      summary: 'نگارش و چیدمان اولیه کنداکتور ۲۴ ساعته پخش شبکه اصفهان (۳۱ ردیف برنامه)',
    },
  ],
  startTime: '06:00:00',
  targetDurationHours: 24,
  items: RAW_SCHEDULE_ITEMS.map(hydrateScheduleItem),
  updatedAt: '2026-10-04T21:13:40.164Z',
  notes:
    'کلیه برنامه‌ها در چرخه تولید، بازبینی (QC)، هماهنگی، مدیریت پخش و پلی‌اوت سیمای مرکز اصفهان پایش می‌شوند.',
};

export function toBroadcastTimelineSeconds(
  timeStr: string,
  dayStartStr = '06:00:00',
  isEndOfItem = false,
  itemStartSec?: number
): number {
  const sec = parseTimeToSeconds(timeStr);
  const dayStart = parseTimeToSeconds(dayStartStr);
  let adjusted = sec < dayStart ? sec + 86400 : sec;
  if (isEndOfItem && itemStartSec !== undefined && adjusted < itemStartSec) {
    adjusted += 86400;
  }
  return adjusted;
}

export function recalculateScheduleItems(
  items: ScheduleItem[],
  scheduleStartTime = '06:00:00',
  respectLocks = true
): ScheduleItem[] {
  let cursorSec = parseTimeToSeconds(scheduleStartTime);

  return items.map((item, idx) => {
    const durSec = parseTimeToSeconds(item.duration);
    let startSec = cursorSec;

    if (idx === 0) {
      startSec = parseTimeToSeconds(item.startTime || scheduleStartTime);
    } else if (respectLocks && item.lockStartTime) {
      startSec = parseTimeToSeconds(item.startTime);
    }

    const newStart = formatSecondsToTime(startSec);
    const newEnd = formatSecondsToTime(startSec + durSec);
    cursorSec = startSec + durSec;

    return {
      ...item,
      order: idx + 1,
      startTime: newStart,
      endTime: newEnd,
    };
  });
}

export function detectScheduleAnomalies(
  schedule: ConductorSchedule
): TimeAnomaly[] {
  const anomalies: TimeAnomaly[] = [];
  const items = schedule.items;
  const dayStart = schedule.startTime || '06:00:00';

  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    const startSec = toBroadcastTimelineSeconds(current.startTime, dayStart);
    const durSec = parseTimeToSeconds(current.duration);
    const expectedEndStr = formatSecondsToTime(startSec + durSec);

    if (current.endTime !== expectedEndStr) {
      anomalies.push({
        id: `mismatch-${current.id}`,
        type: 'duration_mismatch',
        severity: 'warning',
        itemOrder: current.order,
        itemId: current.id,
        diffSeconds: Math.abs(
          parseTimeToSeconds(current.endTime) -
            parseTimeToSeconds(expectedEndStr)
        ),
        message: `ردیف ${current.order} (${current.title}): ساعت پایان (${current.endTime}) با مجموع شروع و مدت زمان (${expectedEndStr}) همخوانی ندارد.`,
      });
    }

    if (
      current.workflowStatus === 'qc_needs_revision' ||
      current.workflowStatus === 'rejected_by_director' ||
      current.workflowStatus === 'returned_to_producer' ||
      current.status === 'rejected'
    ) {
      const markerCount = current.qcMarkers?.length || 0;
      const wfKey = current.workflowStatus || 'qc_needs_revision';
      anomalies.push({
        id: `rejected-${current.id}`,
        type: 'rejected_item',
        severity: 'error',
        itemOrder: current.order,
        itemId: current.id,
        diffSeconds: durSec,
        message: `ردیف ${current.order} (${current.title}): وضعیت گردش کار «${
          WORKFLOW_STAGE_META[wfKey]?.shortLabel || 'نقص فنی'
        }»${markerCount > 0 ? ` — دارای ${markerCount} مورد اصلاحیه تایم‌کددار` : ''}.`,
      });
    }

    if (i < items.length - 1) {
      const next = items[i + 1];
      const currentEndTimeline = startSec + durSec;
      const nextStartTimeline = toBroadcastTimelineSeconds(
        next.startTime,
        dayStart
      );
      const delta = nextStartTimeline - currentEndTimeline;

      if (delta > 0) {
        anomalies.push({
          id: `gap-${current.id}-${next.id}`,
          type: 'gap',
          severity: 'error',
          itemOrder: current.order,
          itemId: current.id,
          relatedItemOrder: next.order,
          diffSeconds: delta,
          message: `خلاء آنتن به مدت ${formatDurationTotal(delta)} بین ردیف ${current.order} (${current.endTime}) و ردیف ${next.order} (${next.startTime}).`,
        });
      } else if (delta < 0) {
        anomalies.push({
          id: `overlap-${current.id}-${next.id}`,
          type: 'overlap',
          severity: 'error',
          itemOrder: current.order,
          itemId: current.id,
          relatedItemOrder: next.order,
          diffSeconds: Math.abs(delta),
          message: `تداخل زمانی به مدت ${formatDurationTotal(Math.abs(delta))} بین پایان ردیف ${current.order} (${current.endTime}) و شروع ردیف ${next.order} (${next.startTime})${next.lockStartTime ? ' [دارای قفل باکس رأس ساعت]' : ''}.`,
        });
      }
    }
  }

  return anomalies;
}

export function isItemApprovedForPlayout(item?: ScheduleItem | null): boolean {
  if (!item) return false;
  if (item.status === 'rejected') return false;
  const wf = item.workflowStatus || 'approved_for_playout';
  return wf === 'approved_for_playout' || wf === 'on_air' || wf === 'aired';
}

