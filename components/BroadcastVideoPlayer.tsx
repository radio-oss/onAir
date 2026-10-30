'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScheduleItem,
  QCMarker,
  CATEGORY_META,
  QC_CATEGORY_META,
  formatDurationTotal,
  formatSecondsToTime,
  parseTimeToSeconds,
} from '@/lib/conductor-data';
import {
  AudioMeterReading,
  computeSyntheticAudioLevels,
} from '@/lib/audio-monitor';
import {
  OnAirGraphicsState,
  DEFAULT_GRAPHICS_STATE,
} from './PlayoutGraphicsController';
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
import VideoPlayerShortcutsModal from './VideoPlayerShortcutsModal';
import {
  Play,
  Pause,
  Scissors,
  AlertTriangle,
  Volume2,
  VolumeX,
  Keyboard,
  RotateCcw,
  Settings2,
  Sliders,
  Repeat,
  Gauge,
  Crosshair,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// ============================================================================
// الگوی ۱: موتور تایم‌کد دقیق فریم (SMPTE 25fps PAL) و پرش دقیق تک‌فریم
// (برگرفته از معماری byomakase/omakase-player و allensarkisyan/VideoFrame)
// ============================================================================
export const BROADCAST_FPS = 25;

export function secondsToSMPTE(seconds: number, fps = BROADCAST_FPS): string {
  const safeSec = Math.max(0, seconds);
  const totalFrames = Math.floor(safeSec * fps + 1e-4);
  const ff = totalFrames % fps;
  const totalWholeSeconds = Math.floor(totalFrames / fps);
  const ss = totalWholeSeconds % 60;
  const mm = Math.floor(totalWholeSeconds / 60) % 60;
  const hh = Math.floor(totalWholeSeconds / 3600);

  return [hh, mm, ss, ff]
    .map((val) => String(val).padStart(2, '0'))
    .join(':');
}

export function stepExactFrames(
  currentTimeSec: number,
  frameDelta: number,
  durationSec: number,
  fps = BROADCAST_FPS
): number {
  const currentFrame = Math.floor(currentTimeSec * fps + 1e-4);
  const targetFrame = Math.max(
    0,
    Math.min(Math.floor(durationSec * fps), currentFrame + frameDelta)
  );
  // Land near the center/inside of target frame so HTML5 <video> decoder never rounds back
  return Number(((targetFrame + 0.5) / fps).toFixed(4));
}

// ============================================================================
// الگوی ۲: تحلیلگر واقعی تراز صدای استریو با Web Audio API (L/R dBFS Peak Meter)
// (برگرفته از معماری byomakase/vu-meter با Fallback به EBU R128 شبیه‌ساز)
// ============================================================================
export function useBroadcastAudioMeter(
  videoElement: HTMLVideoElement | null,
  isPlaying: boolean,
  currentTimeSec: number,
  hasAudioDropMarker: boolean
): AudioMeterReading {
  const [liveReading, setLiveReading] = useState<AudioMeterReading | null>(
    null
  );
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const attachedVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    // Connect Web Audio API if a real HTML5 video element is active
    if (
      videoElement &&
      typeof window !== 'undefined' &&
      'AudioContext' in window
    ) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        if (attachedVideoRef.current !== videoElement) {
          const source = ctx.createMediaElementSource(videoElement);
          const splitter = ctx.createChannelSplitter(2);
          const analyserL = ctx.createAnalyser();
          const analyserR = ctx.createAnalyser();
          analyserL.fftSize = 256;
          analyserR.fftSize = 256;

          source.connect(splitter);
          source.connect(ctx.destination);
          splitter.connect(analyserL, 0);
          splitter.connect(analyserR, 1);

          analyserLRef.current = analyserL;
          analyserRRef.current = analyserR;
          attachedVideoRef.current = videoElement;
        }
      } catch {
        // Fallback to synthetic if MediaElementSource was already bound
      }
    }

    const timer = setInterval(() => {
      if (analyserLRef.current && analyserRRef.current && !hasAudioDropMarker) {
        const bufL = new Float32Array(analyserLRef.current.fftSize);
        const bufR = new Float32Array(analyserRRef.current.fftSize);
        analyserLRef.current.getFloatTimeDomainData(bufL);
        analyserRRef.current.getFloatTimeDomainData(bufR);

        let peakL = 0;
        let peakR = 0;
        for (let i = 0; i < bufL.length; i++) {
          if (Math.abs(bufL[i]) > peakL) peakL = Math.abs(bufL[i]);
          if (Math.abs(bufR[i]) > peakR) peakR = Math.abs(bufR[i]);
        }

        if (peakL > 0.0001 || peakR > 0.0001) {
          const dbL = Math.max(
            -60,
            Math.min(0, 20 * Math.log10(peakL || 1e-4))
          );
          const dbR = Math.max(
            -60,
            Math.min(0, 20 * Math.log10(peakR || 1e-4))
          );
          setLiveReading({
            leftDb: Number(dbL.toFixed(1)),
            rightDb: Number(dbR.toFixed(1)),
            leftPercent: Math.round(((dbL + 60) / 60) * 100),
            rightPercent: Math.round(((dbR + 60) / 60) * 100),
            isClipping: dbL > -1 || dbR > -1,
            isSilent: dbL < -48 && dbR < -48,
          });
          return;
        }
      }

      setLiveReading(null);
    }, 150);

    return () => clearInterval(timer);
  }, [videoElement, isPlaying, hasAudioDropMarker]);

  if (!isPlaying || hasAudioDropMarker) {
    return computeSyntheticAudioLevels(
      false,
      currentTimeSec,
      hasAudioDropMarker
    );
  }

  return (
    liveReading ??
    computeSyntheticAudioLevels(isPlaying, currentTimeSec, hasAudioDropMarker)
  );
}

interface BroadcastVideoPlayerProps {
  item: ScheduleItem;
  currentTimeSec: number;
  isPlaying: boolean;
  clockSec?: number;
  dayStartSec?: number;
  readOnly?: boolean;
  enforceTrim?: boolean;
  showCGOverlays?: boolean;
  cleanFeedMode?: boolean;
  draftRange?: { startSec: number; endSec: number } | null;
  emergencyMode?: 'normal' | 'standby_filler' | 'station_slate' | 'smpte_bars';
  onTimeChange: (sec: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onMarkerClick?: (marker: QCMarker) => void;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;

export default function BroadcastVideoPlayer({
  item,
  currentTimeSec,
  isPlaying,
  clockSec,
  dayStartSec,
  readOnly = false,
  enforceTrim = false,
  showCGOverlays = true,
  cleanFeedMode = false,
  draftRange = null,
  emergencyMode = 'normal',
  onTimeChange,
  onPlayStateChange,
  onMarkerClick,
}: BroadcastVideoPlayerProps) {
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevItemIdRef = useRef<string>(item.id);
  const anchorRef = useRef<{ wallMs: number; mediaSec: number }>({
    wallMs: 0,
    mediaSec: currentTimeSec,
  });

  const [cgState, setCgState] = useState<OnAirGraphicsState>(
    DEFAULT_GRAPHICS_STATE
  );
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(getDefaultShortcuts);
  const [showInlineShortcutEditor, setShowInlineShortcutEditor] =
    useState<boolean>(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] =
    useState<boolean>(false);
  const [remappingAction, setRemappingAction] =
    useState<ShortcutActionId | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // الگوی ۳: قابلیت‌های Hover Skimmer، Loop In/Out و سرعت پخش (0.5x تا 2x)
  const [hoverTimeSec, setHoverTimeSec] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number>(0);
  const [loopTrimRange, setLoopTrimRange] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showSafeAreaGuides, setShowSafeAreaGuides] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [videoElState, setVideoElState] = useState<HTMLVideoElement | null>(
    null
  );

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const scheduledDurationSec = Math.max(
    1,
    parseTimeToSeconds(item.duration) || 900
  );
  const trimIn = Math.max(0, item.trimInSec ?? 0);
  const rawTrimOut =
    item.trimOutSec && item.trimOutSec > trimIn
      ? item.trimOutSec
      : trimIn + scheduledDurationSec;
  const trimOut = enforceTrim
    ? trimIn + scheduledDurationSec
    : Math.max(trimIn + 1, rawTrimOut);
  const totalSourceSec = Math.max(
    trimOut,
    item.sourceDurationSec && item.sourceDurationSec > 0
      ? item.sourceDurationSec
      : 0,
    scheduledDurationSec
  );
  const markers = useMemo(() => item.qcMarkers || [], [item.qcMarkers]);

  // Keep latest values in a ref for drift-free timer, rVFC & 5s reconciliation
  const latestRef = useRef({
    item,
    currentTimeSec,
    isPlaying,
    clockSec,
    dayStartSec,
    enforceTrim,
    loopTrimRange,
    playbackRate,
    trimIn,
    trimOut,
    totalSourceSec,
    scheduledDurationSec,
    onTimeChange,
    onPlayStateChange,
  });
  useEffect(() => {
    latestRef.current = {
      item,
      currentTimeSec,
      isPlaying,
      clockSec,
      dayStartSec,
      enforceTrim,
      loopTrimRange,
      playbackRate,
      trimIn,
      trimOut,
      totalSourceSec,
      scheduledDurationSec,
      onTimeChange,
      onPlayStateChange,
    };
  });

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

  // Listen for real-time Character Generator (CG) overlay updates
  useEffect(() => {
    try {
      const saved = localStorage.getItem('irib_isfahan_onair_cg_v1');
      if (saved) setCgState(JSON.parse(saved));
    } catch {
      // Ignore
    }

    const ch =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('irib_isfahan_cg_sync')
        : null;

    if (ch) {
      ch.onmessage = (ev) => {
        if (ev.data) setCgState(ev.data);
      };
    }
    return () => ch?.close();
  }, []);

  // Seamless item transition: reset anchor and seek video immediately when item.id changes
  useEffect(() => {
    if (prevItemIdRef.current !== item.id) {
      prevItemIdRef.current = item.id;
      const startTarget = enforceTrim ? trimIn : 0;
      const clampedInitial = Math.min(
        enforceTrim ? trimOut : totalSourceSec,
        Math.max(startTarget, currentTimeSec)
      );
      anchorRef.current = {
        wallMs:
          typeof performance !== 'undefined' ? performance.now() : Date.now(),
        mediaSec: clampedInitial,
      };
      const v = videoRef.current;
      if (v && item.videoUrl) {
        v.currentTime = clampedInitial;
        v.playbackRate = playbackRate;
        if (isPlaying) {
          v.play().catch(() => {});
        }
      }
    }
  }, [
    item.id,
    item.videoUrl,
    enforceTrim,
    trimIn,
    trimOut,
    totalSourceSec,
    currentTimeSec,
    isPlaying,
    playbackRate,
  ]);

  // Sync HTML5 <video> when local file URL is attached
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !item.videoUrl) return;
    if (Math.abs(v.currentTime - currentTimeSec) > 0.35) {
      v.currentTime = currentTimeSec;
    }
  }, [currentTimeSec, item.videoUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !item.videoUrl) return;
    v.muted = isMuted;
  }, [isMuted, item.videoUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !item.videoUrl) return;
    v.playbackRate = playbackRate;
  }, [playbackRate, item.videoUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !item.videoUrl) return;
    if (isPlaying) {
      v.play().catch(() => onPlayStateChange(false));
    } else {
      v.pause();
    }
  }, [isPlaying, item.videoUrl, onPlayStateChange]);

  // Reset monotonic wall-clock anchor when play state or speed changes
  useEffect(() => {
    anchorRef.current = {
      wallMs:
        typeof performance !== 'undefined' ? performance.now() : Date.now(),
      mediaSec: latestRef.current.currentTimeSec,
    };
  }, [isPlaying, item.id, playbackRate]);

  // الگوی ۱: استفاده از requestVideoFrameCallback (با Fallback به requestAnimationFrame) برای ویدئوی واقعی
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !item.videoUrl || !isPlaying || typeof clockSec === 'number') {
      return;
    }

    let active = true;
    let rvfcHandle: number | null = null;
    let rafHandle: number | null = null;

    const videoWithRvfc = v as HTMLVideoElement & {
      requestVideoFrameCallback?: (
        callback: (now: number, metadata: { mediaTime: number }) => void
      ) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };

    const handleFrameTime = (mediaSec: number) => {
      const st = latestRef.current;
      if (!active || !st.isPlaying || typeof st.clockSec === 'number') return;

      const maxBound =
        st.enforceTrim || st.loopTrimRange ? st.trimOut : st.totalSourceSec;
      const minBound =
        st.enforceTrim || st.loopTrimRange ? st.trimIn : 0;

      if (mediaSec >= maxBound) {
        if (st.loopTrimRange) {
          v.currentTime = st.trimIn;
          st.onTimeChange(st.trimIn);
          v.play().catch(() => {});
        } else {
          v.pause();
          st.onPlayStateChange(false);
          st.onTimeChange(minBound);
        }
        return;
      }

      st.onTimeChange(Number(mediaSec.toFixed(4)));
    };

    if (typeof videoWithRvfc.requestVideoFrameCallback === 'function') {
      const loopRvfc = (_now: number, metadata: { mediaTime: number }) => {
        if (!active) return;
        handleFrameTime(metadata.mediaTime ?? v.currentTime);
        if (active && videoWithRvfc.requestVideoFrameCallback) {
          rvfcHandle = videoWithRvfc.requestVideoFrameCallback(loopRvfc);
        }
      };
      rvfcHandle = videoWithRvfc.requestVideoFrameCallback(loopRvfc);
    } else {
      const loopRaf = () => {
        if (!active) return;
        handleFrameTime(v.currentTime);
        if (active) {
          rafHandle = requestAnimationFrame(loopRaf);
        }
      };
      rafHandle = requestAnimationFrame(loopRaf);
    }

    return () => {
      active = false;
      if (
        rvfcHandle !== null &&
        typeof videoWithRvfc.cancelVideoFrameCallback === 'function'
      ) {
        videoWithRvfc.cancelVideoFrameCallback(rvfcHandle);
      }
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
      }
    };
  }, [isPlaying, item.videoUrl, clockSec]);

  // Standalone synthetic playback tick loop at 25fps (40ms) when no external video file is attached
  useEffect(() => {
    if (!isPlaying || item.videoUrl || typeof clockSec === 'number') return;
    const interval = setInterval(() => {
      const st = latestRef.current;
      if (!st.isPlaying || st.item.videoUrl || typeof st.clockSec === 'number')
        return;
      const maxBound =
        st.enforceTrim || st.loopTrimRange ? st.trimOut : st.totalSourceSec;
      const minBound =
        st.enforceTrim || st.loopTrimRange ? st.trimIn : 0;
      const frameStepSec = (1 / BROADCAST_FPS) * st.playbackRate;
      const next = Number((st.currentTimeSec + frameStepSec).toFixed(4));

      if (next >= maxBound) {
        if (st.loopTrimRange) {
          st.onTimeChange(st.trimIn);
        } else {
          st.onPlayStateChange(false);
          st.onTimeChange(minBound);
        }
      } else {
        st.onTimeChange(next);
      }
    }, 1000 / BROADCAST_FPS);
    return () => clearInterval(interval);
  }, [isPlaying, item.videoUrl, clockSec]);

  // 5-Second Drift Compensation: Reconcile video currentTime & currentTimeSec against master clockSec
  useEffect(() => {
    if (!isPlaying) return;
    const reconcileInterval = setInterval(() => {
      const st = latestRef.current;
      if (!st.isPlaying) return;

      const maxBound = st.enforceTrim ? st.trimOut : st.totalSourceSec;
      const minBound = st.enforceTrim ? st.trimIn : 0;

      if (typeof st.clockSec === 'number') {
        const baseDayStart =
          typeof st.dayStartSec === 'number'
            ? st.dayStartSec
            : parseTimeToSeconds('06:00:00');
        const itemStartSec = parseTimeToSeconds(st.item.startTime);
        const normClock =
          st.clockSec < baseDayStart ? st.clockSec + 86400 : st.clockSec;
        const normStart =
          itemStartSec < baseDayStart ? itemStartSec + 86400 : itemStartSec;
        const elapsedFromMaster = Math.max(
          0,
          Math.min(st.scheduledDurationSec, normClock - normStart)
        );
        const expectedMediaSec = Math.min(
          maxBound,
          Math.max(minBound, st.trimIn + elapsedFromMaster)
        );

        const v = videoRef.current;
        if (
          v &&
          st.item.videoUrl &&
          Math.abs(v.currentTime - expectedMediaSec) > 0.1
        ) {
          v.currentTime = expectedMediaSec;
        }
        if (Math.abs(st.currentTimeSec - expectedMediaSec) > 0.25) {
          st.onTimeChange(expectedMediaSec);
        }
      } else {
        const nowMs =
          typeof performance !== 'undefined' ? performance.now() : Date.now();
        const elapsedWallSec =
          Math.max(0, (nowMs - anchorRef.current.wallMs) / 1000) *
          st.playbackRate;
        const expectedMediaSec = Math.min(
          maxBound,
          Math.max(minBound, anchorRef.current.mediaSec + elapsedWallSec)
        );
        const v = videoRef.current;
        if (v && st.item.videoUrl) {
          anchorRef.current = { wallMs: nowMs, mediaSec: v.currentTime };
          if (Math.abs(st.currentTimeSec - v.currentTime) > 0.15) {
            st.onTimeChange(v.currentTime);
          }
        } else {
          anchorRef.current = { wallMs: nowMs, mediaSec: st.currentTimeSec };
          if (
            !st.loopTrimRange &&
            Math.abs(st.currentTimeSec - expectedMediaSec) > 0.35
          ) {
            st.onTimeChange(expectedMediaSec);
          }
        }
      }
    }, 5000);

    return () => clearInterval(reconcileInterval);
  }, [isPlaying]);

  // Draw synthetic offline broadcast signal on <canvas> when no external video file is loaded
  useEffect(() => {
    if (item.videoUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 768;
    const h = 432;
    ctx.save();
    ctx.scale(canvas.width / w, canvas.height / h);

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#070b14');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#132238');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Top high-contrast SMPTE reference calibration bar
    const barColors = [
      '#f8fafc',
      '#facc15',
      '#2dd4bf',
      '#4ade80',
      '#c084fc',
      '#fb7185',
      '#38bdf8',
    ];
    const barW = w / barColors.length;
    barColors.forEach((c, idx) => {
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.32;
      ctx.fillRect(idx * barW, 0, barW, 10);
    });
    ctx.globalAlpha = 1;

    // Animated broadcast scanline sweep
    const sweepX = (currentTimeSec * 90) % w;
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.24)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sweepX, 0);
    ctx.lineTo(sweepX, h);
    ctx.stroke();

    // Channel Bug (Top-Left)
    if (!showCGOverlays || cgState.showChannelBug) {
      ctx.fillStyle = 'rgba(7, 10, 18, 0.9)';
      ctx.fillRect(20, 24, 200, 34);
      ctx.strokeStyle = '#2dd4bf';
      ctx.strokeRect(20, 24, 200, 34);
      ctx.fillStyle = '#5eead4';
      ctx.font = 'bold 13px Vazirmatn, IRANSans, Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('شبکه اصفهان', 120, 46);
    }

    // Media Code & Version Badge (Top-Right)
    ctx.fillStyle = 'rgba(7, 10, 18, 0.9)';
    ctx.fillRect(w - 220, 24, 200, 34);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(w - 220, 24, 200, 34);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${item.mediaCode} (v${item.revisionVersion || 1})`,
      w - 120,
      46
    );

    // Program Title & Category (Center)
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 19px Vazirmatn, IRANSans, Tahoma, sans-serif';
    ctx.fillText(item.title.slice(0, 48), w / 2, h / 2 - 12);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px Vazirmatn, IRANSans, Tahoma, sans-serif';
    ctx.fillText(
      `${item.episode || 'نسخه بازبینی و پلی‌اوت'} — [${
        CATEGORY_META[item.category]?.label || item.category
      }]`,
      w / 2,
      h / 2 + 18
    );

    // Active QC Marker Alert Overlay if playhead is inside a marker's time range or ±3s of point marker
    const activeMarker = markers.find((m) => {
      if (m.resolved) return false;
      if (m.endTimeSec && m.endTimeSec > m.timeSec) {
        return currentTimeSec >= m.timeSec && currentTimeSec <= m.endTimeSec;
      }
      return Math.abs(m.timeSec - currentTimeSec) <= 3;
    });
    if (activeMarker) {
      ctx.fillStyle =
        activeMarker.severity === 'critical'
          ? 'rgba(190, 18, 60, 0.92)'
          : 'rgba(180, 83, 9, 0.92)';
      ctx.fillRect(40, h - 122, w - 80, 38);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Vazirmatn, IRANSans, Tahoma, sans-serif';
      const spanLabel = activeMarker.endTimecode
        ? `${activeMarker.timecode} تا ${activeMarker.endTimecode}`
        : activeMarker.timecode;
      ctx.fillText(
        `هشدار QC (${spanLabel}): ${activeMarker.note}`,
        w / 2,
        h - 98
      );
    }

    // High-contrast Burned-in SMPTE 25fps Timecode Box (Bottom Center)
    const tcString = secondsToSMPTE(currentTimeSec, BROADCAST_FPS);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.fillRect(w / 2 - 120, h - 76, 240, 36);
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(w / 2 - 120, h - 76, 240, 36);
    ctx.fillStyle = '#5eead4';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`TCR ${tcString}`, w / 2, h - 53);
    ctx.restore();
  }, [currentTimeSec, item, markers, cgState, showCGOverlays]);

  const executePlayerBinding = (
    pressedBinding: string,
    e: KeyboardEvent | React.KeyboardEvent
  ): boolean => {
    if (pressedBinding === shortcuts.player_toggle_mute) {
      e.preventDefault();
      setIsMuted((prev) => !prev);
      return true;
    }
    if (readOnly) {
      return false;
    }

    // الگوی ۳: کنترل استاندارد J-K-L Shuttle و I/O تریم (مشابه Omakase Player / FreeFrame)
    if (
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      !e.shiftKey &&
      (e.code === 'KeyK' ||
        e.code === 'KeyL' ||
        e.code === 'KeyJ' ||
        e.code === 'KeyI' ||
        e.code === 'KeyO')
    ) {
      if (e.code === 'KeyK') {
        e.preventDefault();
        onPlayStateChange(false);
        return true;
      }
      if (e.code === 'KeyL') {
        e.preventDefault();
        if (!isPlaying) {
          onPlayStateChange(true);
        } else {
          setPlaybackRate((prev) => {
            if (prev === 1) return 1.5;
            if (prev === 1.5) return 2;
            return 1;
          });
        }
        return true;
      }
      if (e.code === 'KeyJ') {
        e.preventDefault();
        setPlaybackRate(1);
        onTimeChange(Math.max(0, currentTimeSec - 5));
        return true;
      }
      if (e.code === 'KeyI') {
        e.preventDefault();
        onTimeChange(trimIn);
        return true;
      }
      if (e.code === 'KeyO') {
        e.preventDefault();
        onTimeChange(trimOut);
        return true;
      }
    }

    if (pressedBinding === shortcuts.player_toggle_play) {
      e.preventDefault();
      onPlayStateChange(!isPlaying);
      return true;
    }
    if (pressedBinding === shortcuts.player_jump_forward_5s) {
      e.preventDefault();
      onTimeChange(Math.min(totalSourceSec, currentTimeSec + 5));
      return true;
    }
    if (pressedBinding === shortcuts.player_jump_backward_5s) {
      e.preventDefault();
      onTimeChange(Math.max(0, currentTimeSec - 5));
      return true;
    }
    if (pressedBinding === shortcuts.player_jump_forward_1s) {
      e.preventDefault();
      onTimeChange(Math.min(totalSourceSec, currentTimeSec + 1));
      return true;
    }
    if (pressedBinding === shortcuts.player_jump_backward_1s) {
      e.preventDefault();
      onTimeChange(Math.max(0, currentTimeSec - 1));
      return true;
    }
    if (pressedBinding === shortcuts.player_frame_forward) {
      e.preventDefault();
      onTimeChange(stepExactFrames(currentTimeSec, 1, totalSourceSec));
      return true;
    }
    if (pressedBinding === shortcuts.player_frame_backward) {
      e.preventDefault();
      onTimeChange(stepExactFrames(currentTimeSec, -1, totalSourceSec));
      return true;
    }
    if (pressedBinding === shortcuts.player_jump_trim_in) {
      e.preventDefault();
      onTimeChange(trimIn);
      return true;
    }
    if (pressedBinding === shortcuts.player_jump_trim_out) {
      e.preventDefault();
      onTimeChange(trimOut);
      return true;
    }
    if (pressedBinding === shortcuts.player_reset_start) {
      e.preventDefault();
      onTimeChange(0);
      return true;
    }
    return false;
  };

  // Customizable Keyboard Shortcuts Handler on the player container
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isShortcutModalOpen) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const pressedBinding = eventToShortcutString(e);
    if (!pressedBinding) return;

    // If user is currently remapping a shortcut inline inside the player
    if (remappingAction) {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setRemappingAction(null);
        return;
      }
      const next: ShortcutMap = {
        ...shortcuts,
        [remappingAction]: pressedBinding,
      };
      setShortcuts(next);
      saveShortcuts(next);
      setRemappingAction(null);
      return;
    }

    if (executePlayerBinding(pressedBinding, e)) {
      e.stopPropagation();
    }
  };

  // الگوی ۲: محاسبه تراز صدای استریو با Web Audio API (یا شبیه‌ساز EBU R128)
  const hasAudioDropNearPlayhead = markers.some((m) => {
    if (m.resolved || m.category !== 'audio') return false;
    if (m.endTimeSec && m.endTimeSec > m.timeSec) {
      return currentTimeSec >= m.timeSec && currentTimeSec <= m.endTimeSec;
    }
    return Math.abs(m.timeSec - currentTimeSec) <= 3;
  });

  const audioReading = useBroadcastAudioMeter(
    item.videoUrl ? videoElState : null,
    isPlaying && !isMuted,
    currentTimeSec,
    hasAudioDropNearPlayhead || isMuted
  );

  const trimInPercent = Math.min(
    100,
    Math.max(0, (trimIn / totalSourceSec) * 100)
  );
  const trimOutPercent = Math.min(
    100,
    Math.max(0, (trimOut / totalSourceSec) * 100)
  );
  const playheadPercent = Math.min(
    100,
    Math.max(0, (currentTimeSec / totalSourceSec) * 100)
  );

  const playerShortcutDefs = SHORTCUT_DEFINITIONS.filter(
    (d) => d.category === 'player'
  );

  const draftRangePct = useMemo(() => {
    if (
      !draftRange ||
      draftRange.endSec <= draftRange.startSec ||
      totalSourceSec <= 0
    ) {
      return null;
    }
    const left = Math.min(
      100,
      Math.max(0, (draftRange.startSec / totalSourceSec) * 100)
    );
    const right = Math.min(
      100,
      Math.max(0, (draftRange.endSec / totalSourceSec) * 100)
    );
    return {
      left,
      width: Math.max(0.5, right - left),
    };
  }, [draftRange, totalSourceSec]);

  return (
    <div
      ref={playerContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={
        cleanFeedMode
          ? 'w-full h-full flex flex-col justify-center items-center bg-black overflow-hidden p-0 m-0 border-0'
          : 'bg-slate-950 border border-slate-800 focus:border-teal-500/60 focus:outline-none rounded-xl overflow-hidden space-y-3 p-3'
      }
    >
      {/* Main Monitor Row: Video Viewport + Stereo VU Loudness Bar */}
      <div
        className={
          cleanFeedMode
            ? 'w-full h-full flex items-center justify-center'
            : 'flex items-stretch gap-2'
        }
      >
        <div
          className={`relative ${
            cleanFeedMode
              ? 'w-full h-full max-h-[calc(100vh-44px)] aspect-video mx-auto'
              : 'aspect-video flex-1'
          } bg-black rounded-lg overflow-hidden border border-slate-800`}
        >
          {item.videoUrl ? (
            <video
              ref={(node) => {
                videoRef.current = node;
                if (node !== videoElState) {
                  setVideoElState(node);
                }
              }}
              src={item.videoUrl}
              onTimeUpdate={(e) => {
                if (typeof clockSec === 'number') return;
                const mediaSec = e.currentTarget.currentTime;
                if (loopTrimRange && mediaSec >= trimOut) {
                  e.currentTarget.currentTime = trimIn;
                  onTimeChange(trimIn);
                  return;
                }
                onTimeChange(mediaSec);
              }}
              onEnded={() => {
                if (typeof clockSec === 'number') return;
                if (loopTrimRange) {
                  if (videoRef.current) {
                    videoRef.current.currentTime = trimIn;
                    videoRef.current.play().catch(() => {});
                  }
                  onTimeChange(trimIn);
                  return;
                }
                onPlayStateChange(false);
              }}
              className="w-full h-full object-contain"
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full h-full object-cover"
            />
          )}

          {/* Emergency Override Signal Overlay (SMPTE Bars / Station Slate / Standby Filler) */}
          {emergencyMode && emergencyMode !== 'normal' && (
            <div className="absolute inset-0 z-20 flex flex-col justify-between bg-slate-950 pointer-events-none select-none">
              {emergencyMode === 'smpte_bars' ? (
                <div className="flex-1 grid grid-cols-7 w-full h-full">
                  <div className="bg-slate-100" />
                  <div className="bg-yellow-400" />
                  <div className="bg-cyan-400" />
                  <div className="bg-emerald-500" />
                  <div className="bg-fuchsia-500" />
                  <div className="bg-rose-600" />
                  <div className="bg-blue-600" />
                </div>
              ) : emergencyMode === 'station_slate' ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-teal-950/60 to-slate-900 p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center shadow-[0_0_30px_rgba(45,212,191,0.35)] mb-3">
                    <span className="text-lg font-bold text-teal-300">اصفهان</span>
                  </div>
                  <div className="text-base font-bold text-white">
                    صدا و سیمای مرکز اصفهان — آرم استیشن ثابت شبکه اصفهان
                  </div>
                  <div className="text-xs text-teal-300 mt-1">
                    STATION SLATE ACTIVE · سیگنال پایدار استودیو پخش
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-amber-950/40 to-slate-900 p-6 text-center">
                  <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-bold mb-2">
                    STANDBY FILLER LOOP
                  </div>
                  <div className="text-base font-bold text-white">
                    پخش میان‌برنامه احتیاطی (Standby Filler — تصاویری از نصف جهان)
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    در حال پخش خودکار از سرور پشتیبان رژی تا بازگشت سیگنال اصلی
                  </div>
                </div>
              )}
              <div className="bg-slate-950/95 border-t border-rose-500/50 px-3 py-1.5 flex items-center justify-between text-[11px]">
                <span className="font-bold text-rose-400 animate-pulse">
                  ● سوییچ اضطراری آنتن فعال (EMERGENCY OVERRIDE)
                </span>
                <span className="font-mono-tabular text-amber-300">
                  {emergencyMode === 'smpte_bars'
                    ? 'SIGNAL: SMPTE 75% COLOR BARS'
                    : emergencyMode === 'station_slate'
                    ? 'SIGNAL: ISFAHAN TV STATION SLATE'
                    : 'SIGNAL: STANDBY FILLER LOOP'}
                </span>
              </div>
            </div>
          )}

          {/* Broadcast Title/Action Safe Guides (93% Action Safe & 85% Title Safe + Center Crosshair) */}
          {showSafeAreaGuides && (
            <div className="absolute inset-0 z-20 pointer-events-none select-none">
              {/* Action Safe (93% -> 3.5% margin) */}
              <div className="absolute inset-[3.5%] border border-dashed border-cyan-400/35 rounded-xs">
                <span
                  dir="ltr"
                  className="absolute top-1 left-1.5 px-1 py-0.2 rounded bg-slate-950/75 text-[8px] font-mono-tabular text-cyan-300/80"
                >
                  ACTION SAFE 93%
                </span>
              </div>
              {/* Title Safe (85% -> 7.5% margin) */}
              <div className="absolute inset-[7.5%] border border-teal-400/40 rounded-xs">
                <span
                  dir="ltr"
                  className="absolute top-1 left-1.5 px-1 py-0.2 rounded bg-slate-950/75 text-[8px] font-mono-tabular text-teal-300/85"
                >
                  TITLE SAFE 85%
                </span>
              </div>
              {/* Center Crosshair (+) */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <div className="absolute w-5 h-px bg-teal-300/50" />
                  <div className="absolute h-5 w-px bg-teal-300/50" />
                </div>
              </div>
            </div>
          )}

          {/* Top Overlay Status Pill */}
          <div className="absolute top-2.5 left-3 right-3 z-20 flex items-center justify-between pointer-events-none text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded bg-slate-950/85 border border-slate-700 text-slate-200 font-mono-tabular">
                {item.videoFileName
                  ? `فایل: ${item.videoFileName} (نسخه v${item.revisionVersion || 1})`
                  : `سیگنال شبیه‌ساز آفلاین استودیو (نسخه v${item.revisionVersion || 1})`}
              </span>
              {playbackRate !== 1 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/90 text-slate-950 font-mono-tabular font-bold">
                  {playbackRate}x
                </span>
              )}
              {loopTrimRange && (
                <span className="px-2 py-0.5 rounded bg-teal-500/90 text-slate-950 font-bold">
                  LOOP IN/OUT
                </span>
              )}
              {showCGOverlays && cgState.showLiveBadge && (
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold animate-pulse">
                  زنده | LIVE
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {item.videoUrl && showCGOverlays && cgState.showChannelBug && (
                <span className="px-2.5 py-0.5 rounded bg-slate-950/90 border border-teal-400/50 text-teal-300 font-bold shadow-sm">
                  شبکه اصفهان
                </span>
              )}
              {(trimIn > 0 || trimOut < totalSourceSec) && (
                <span className="px-2.5 py-0.5 rounded bg-teal-950/90 border border-teal-500/50 text-teal-300 font-mono-tabular flex items-center gap-1">
                  <Scissors className="w-3 h-3" />
                  <span>
                    TRIM: {formatDurationTotal(trimIn)} -{' '}
                    {formatDurationTotal(trimOut)}
                  </span>
                </span>
              )}
              {showCGOverlays && cgState.showClockOverlay && (
                <span
                  suppressHydrationWarning
                  dir="ltr"
                  className="px-2.5 py-0.5 rounded bg-slate-950/90 border border-white/[0.15] text-teal-300 font-mono-tabular font-bold"
                >
                  {typeof clockSec === 'number'
                    ? formatSecondsToTime(Math.floor(clockSec))
                    : formatDurationTotal(Math.floor(currentTimeSec))}
                </span>
              )}
            </div>
          </div>

          {/* Live Lower Third Overlay (Above Crawl Ticker) */}
          {showCGOverlays &&
            cgState.showLowerThird &&
            (cgState.lowerThirdTitle || cgState.lowerThirdSubtitle) && (
              <div
                className={`absolute right-4 left-12 z-20 pointer-events-none transition-all ${
                  cgState.showCrawlTicker ? 'bottom-9' : 'bottom-3'
                }`}
              >
                <div className="bg-slate-950/90 backdrop-blur-md border border-white/[0.14] border-r-4 border-r-teal-400 rounded-lg px-3.5 py-2 shadow-xl">
                  {cgState.lowerThirdTitle && (
                    <div className="text-xs font-bold text-white truncate">
                      {cgState.lowerThirdTitle}
                    </div>
                  )}
                  {cgState.lowerThirdSubtitle && (
                    <div className="text-[11px] text-teal-300 truncate mt-0.5">
                      {cgState.lowerThirdSubtitle}
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Live Crawl Ticker Overlay (Bottom of Frame) */}
          {showCGOverlays && cgState.showCrawlTicker && cgState.crawlText && (
            <div className="absolute bottom-0 inset-x-0 z-20 bg-teal-950/90 border-t border-teal-500/50 py-1 px-3 text-[11px] text-teal-100 flex items-center gap-2 overflow-hidden pointer-events-none">
              <span className="font-bold text-amber-300 shrink-0 bg-teal-950/95 px-1.5 rounded z-10">
                [زیرنویس شبکه اصفهان]:
              </span>
              <div className="flex-1 overflow-hidden">
                <span className="broadcast-ticker-track">{cgState.crawlText}</span>
              </div>
            </div>
          )}
        </div>

        {/* Vertical Stereo VU Meter (EBU R128 L / R dBFS with dB Scale Ticks) */}
        {!cleanFeedMode && (
          <div
            dir="ltr"
            title={`تراز صدای استریو: L ${audioReading.leftDb} dB | R ${audioReading.rightDb} dB`}
            className="w-11 bg-slate-900/90 border border-slate-800 rounded-lg p-1.5 flex flex-col justify-between items-center select-none shrink-0"
          >
            <span className="text-[8px] font-mono-tabular text-teal-400 font-bold">
              dBFS
            </span>
            <div className="flex-1 w-full flex items-stretch justify-between gap-1 my-1 bg-slate-950 rounded p-1 overflow-hidden">
              {/* EBU R128 dB Scale Ruler */}
              <div className="flex flex-col justify-between text-[8px] font-mono-tabular text-slate-500 leading-none py-0.5 select-none">
                <span>0</span>
                <span>-9</span>
                <span>-18</span>
                <span>-36</span>
                <span>-60</span>
              </div>

              {/* L & R Bar Channels */}
              <div className="flex items-end gap-1 h-full">
                <div className="w-2 h-full bg-slate-900 rounded-xs flex flex-col justify-end overflow-hidden">
                  <div
                    style={{ height: `${audioReading.leftPercent}%` }}
                    className={`w-full transition-all duration-150 ${
                      audioReading.isClipping
                        ? 'bg-rose-500'
                        : audioReading.leftPercent > 80
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                </div>
                <div className="w-2 h-full bg-slate-900 rounded-xs flex flex-col justify-end overflow-hidden">
                  <div
                    style={{ height: `${audioReading.rightPercent}%` }}
                    className={`w-full transition-all duration-150 ${
                      audioReading.isClipping
                        ? 'bg-rose-500'
                        : audioReading.rightPercent > 80
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                </div>
              </div>
            </div>
            <span className="text-[8px] font-mono-tabular text-slate-400">
              L / R
            </span>
          </div>
        )}
      </div>

      {!cleanFeedMode && (
        <>
          {/* الگوی ۳: نوار تایم‌لاین با پیش‌نمایش تایم‌کد در زمان هاور (Hover Skimmer)، دستگیره‌های تریم و مارکرها */}
          <div className="space-y-1.5 px-1" dir="ltr">
            <div
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left) / rect.width)
                );
                setHoverPercent(ratio * 100);
                setHoverTimeSec(Number((ratio * totalSourceSec).toFixed(4)));
              }}
              onMouseLeave={() => {
                setHoverTimeSec(null);
              }}
              onClick={(e) => {
                if (readOnly) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left) / rect.width)
                );
                onTimeChange(Number((ratio * totalSourceSec).toFixed(4)));
              }}
              className={`relative h-9 bg-slate-900 border border-slate-700 rounded-md select-none overflow-visible ${
                readOnly ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              {/* SVG Synthetic Audio Waveform Background Layer */}
              <svg
                viewBox="0 0 200 36"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full opacity-25 pointer-events-none text-teal-400"
              >
                {Array.from({ length: 50 }, (_, idx) => {
                  const barH =
                    6 +
                    ((Math.sin(idx * 1.7 + (item.order || 1)) + 1) * 11) +
                    ((idx % 5) * 1.5);
                  const y = (36 - barH) / 2;
                  return (
                    <rect
                      key={idx}
                      x={idx * 4 + 1}
                      y={y}
                      width="2"
                      height={barH}
                      rx="0.5"
                      fill="currentColor"
                    />
                  );
                })}
              </svg>

              {/* Draft Range Highlight Box (from VideoQCModal or QCInspectionPortal) */}
              {draftRangePct && (
                <div
                  style={{
                    left: `${draftRangePct.left}%`,
                    width: `${draftRangePct.width}%`,
                  }}
                  className="absolute top-0 bottom-0 bg-cyan-400/25 border-x-2 border-dashed border-cyan-300 pointer-events-none z-10"
                />
              )}

              {/* Active Trim Region with Bottom-Aligned IN / OUT Handles */}
          <div
            style={{
              left: `${trimInPercent}%`,
              width: `${Math.max(0, trimOutPercent - trimInPercent)}%`,
            }}
            className="absolute top-0 bottom-0 bg-teal-500/20 border-x-2 border-teal-400 pointer-events-none"
          >
            <span className="absolute bottom-0.5 left-0.5 px-1 rounded-xs bg-teal-500/90 text-slate-950 font-mono-tabular text-[9px] leading-tight font-bold">
              IN
            </span>
            <span className="absolute bottom-0.5 right-0.5 px-1 rounded-xs bg-teal-500/90 text-slate-950 font-mono-tabular text-[9px] leading-tight font-bold">
              OUT
            </span>
          </div>

          {/* QC Marker Time-Range Highlight Spans */}
          {markers.map((marker) => {
            if (!marker.endTimeSec || marker.endTimeSec <= marker.timeSec) {
              return null;
            }
            const startPct = Math.min(
              99,
              Math.max(0, (marker.timeSec / totalSourceSec) * 100)
            );
            const endPct = Math.min(
              100,
              Math.max(
                startPct + 0.5,
                (marker.endTimeSec / totalSourceSec) * 100
              )
            );
            return (
              <div
                key={`span-${marker.id}`}
                style={{
                  left: `${startPct}%`,
                  width: `${endPct - startPct}%`,
                }}
                className={`absolute top-0.5 bottom-0.5 pointer-events-none rounded-xs ${
                  marker.resolved
                    ? 'bg-emerald-500/25 border-x border-emerald-400/60'
                    : marker.severity === 'critical'
                    ? 'bg-rose-500/35 border-x border-rose-400'
                    : 'bg-amber-400/30 border-x border-amber-300'
                }`}
              />
            );
          })}

          {/* Hover Timecode Skimmer Guide Line & Floating SMPTE Tooltip */}
          {hoverTimeSec !== null && (
            <>
              <div
                style={{ left: `${hoverPercent}%` }}
                className="absolute top-0 bottom-0 w-px bg-amber-300/80 z-20 pointer-events-none"
              />
              <div
                style={{
                  left: `${Math.min(92, Math.max(8, hoverPercent))}%`,
                }}
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-950/95 border border-amber-400/60 text-amber-300 font-mono-tabular text-[10px] font-bold shadow-lg whitespace-nowrap z-40 pointer-events-none"
              >
                {secondsToSMPTE(hoverTimeSec, BROADCAST_FPS)}
              </div>
            </>
          )}

          {/* Playhead */}
          <div
            style={{ left: `${playheadPercent}%` }}
            className="absolute -top-1 -bottom-1 w-0.5 bg-teal-300 z-20 pointer-events-none"
          />

          {/* QC Marker Pins */}
          {markers.map((marker) => {
            const leftPct = Math.min(
              99,
              Math.max(1, (marker.timeSec / totalSourceSec) * 100)
            );
            const rangeText = marker.endTimecode
              ? `${marker.timecode} تا ${marker.endTimecode}`
              : marker.timecode;
            return (
              <button
                key={marker.id}
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (!readOnly) {
                    onTimeChange(marker.timeSec);
                  }
                  onMarkerClick?.(marker);
                }}
                style={{ left: `${leftPct}%` }}
                title={`[${rangeText}] ${
                  QC_CATEGORY_META[marker.category].label
                }: ${marker.note}`}
                className={`absolute top-1.5 -translate-x-1/2 w-3.5 h-5 rounded-xs z-30 transition-transform hover:scale-125 cursor-pointer flex items-center justify-center ${
                  marker.resolved
                    ? 'bg-emerald-500/80 border border-emerald-200'
                    : marker.severity === 'critical'
                    ? 'bg-rose-500 border border-rose-200 animate-pulse'
                    : 'bg-amber-400 border border-amber-950'
                }`}
              >
                <AlertTriangle className="w-2.5 h-2.5 text-slate-950" />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-400">
          <span className="text-teal-300 font-bold">
            SMPTE TC: {secondsToSMPTE(currentTimeSec, BROADCAST_FPS)} (25fps PAL)
          </span>
          <span>
            IN: {secondsToSMPTE(trimIn, BROADCAST_FPS)} | OUT:{' '}
            {secondsToSMPTE(trimOut, BROADCAST_FPS)}
          </span>
          <span>DUR: {formatDurationTotal(totalSourceSec)}</span>
        </div>
      </div>

      {/* Transport Control Bar with 25fps Exact Frame Stepping, Loop In/Out, Speed Selector & Hotkeys */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
        {readOnly ? (
          <div className="flex items-center gap-2 text-xs text-sky-300 font-semibold">
            <span>حالت پایش صرف (Read-Only) — همگام با ساعت استودیو</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPlayStateChange(!isPlaying)}
              title={`پخش / توقف (${formatShortcutBadge(
                shortcuts.player_toggle_play
              )} یا K/L)`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>توقف</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>پخش</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onTimeChange(Math.max(0, currentTimeSec - 5))}
              title={`۵ ثانیه به عقب (${formatShortcutBadge(
                shortcuts.player_jump_backward_5s
              )} یا J)`}
              className="px-2 py-1.5 bg-gradient-to-b from-slate-800 to-slate-950 hover:from-slate-700 hover:to-slate-900 border border-white/[0.12] border-b-2 border-b-black shadow-sm text-slate-200 text-xs font-mono-tabular rounded-md active:translate-y-px cursor-pointer"
            >
              -5s
            </button>
            <button
              type="button"
              onClick={() => onTimeChange(Math.max(0, currentTimeSec - 1))}
              title={`۱ ثانیه به عقب (${formatShortcutBadge(
                shortcuts.player_jump_backward_1s
              )})`}
              className="px-2 py-1.5 bg-gradient-to-b from-slate-800 to-slate-950 hover:from-slate-700 hover:to-slate-900 border border-white/[0.12] border-b-2 border-b-black shadow-sm text-slate-200 text-xs font-mono-tabular rounded-md active:translate-y-px cursor-pointer"
            >
              -1s
            </button>
            <button
              type="button"
              onClick={() =>
                onTimeChange(stepExactFrames(currentTimeSec, -1, totalSourceSec))
              }
              title={`یک فریم دقیق به عقب 25fps (${formatShortcutBadge(
                shortcuts.player_frame_backward
              )})`}
              className="px-2 py-1.5 bg-gradient-to-b from-slate-800 to-slate-950 hover:from-slate-700 hover:to-slate-900 border border-white/[0.12] border-b-2 border-b-black shadow-sm text-teal-300 text-[11px] font-mono-tabular rounded-md active:translate-y-px cursor-pointer"
            >
              -1F
            </button>
            <button
              type="button"
              onClick={() =>
                onTimeChange(stepExactFrames(currentTimeSec, 1, totalSourceSec))
              }
              title={`یک فریم دقیق به جلو 25fps (${formatShortcutBadge(
                shortcuts.player_frame_forward
              )})`}
              className="px-2 py-1.5 bg-gradient-to-b from-slate-800 to-slate-950 hover:from-slate-700 hover:to-slate-900 border border-white/[0.12] border-b-2 border-b-black shadow-sm text-teal-300 text-[11px] font-mono-tabular rounded-md active:translate-y-px cursor-pointer"
            >
              +1F
            </button>
            <button
              type="button"
              onClick={() =>
                onTimeChange(Math.min(totalSourceSec, currentTimeSec + 1))
              }
              title={`۱ ثانیه به جلو (${formatShortcutBadge(
                shortcuts.player_jump_forward_1s
              )})`}
              className="px-2 py-1.5 bg-gradient-to-b from-slate-800 to-slate-950 hover:from-slate-700 hover:to-slate-900 border border-white/[0.12] border-b-2 border-b-black shadow-sm text-slate-200 text-xs font-mono-tabular rounded-md active:translate-y-px cursor-pointer"
            >
              +1s
            </button>
            <button
              type="button"
              onClick={() =>
                onTimeChange(Math.min(totalSourceSec, currentTimeSec + 5))
              }
              title={`۵ ثانیه به جلو (${formatShortcutBadge(
                shortcuts.player_jump_forward_5s
              )})`}
              className="px-2 py-1.5 bg-gradient-to-b from-slate-800 to-slate-950 hover:from-slate-700 hover:to-slate-900 border border-white/[0.12] border-b-2 border-b-black shadow-sm text-slate-200 text-xs font-mono-tabular rounded-md active:translate-y-px cursor-pointer"
            >
              +5s
            </button>

            {/* Loop Trim Range (In/Out) Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextLoop = !loopTrimRange;
                setLoopTrimRange(nextLoop);
                if (
                  nextLoop &&
                  (currentTimeSec < trimIn || currentTimeSec > trimOut)
                ) {
                  onTimeChange(trimIn);
                }
              }}
              title="پخش حلقه‌ای بین نقطه شروع و پایان تریم (Loop In/Out)"
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer ${
                loopTrimRange
                  ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Loop In/Out</span>
            </button>

            {/* Playback Speed Selector (0.5x, 1x, 1.5x, 2x) */}
            <div
              className="inline-flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5"
              title="انتخاب سرعت بازبینی و پخش (شورتکات L برای افزایش سرعت)"
            >
              <Gauge className="w-3.5 h-3.5 text-slate-400 mx-1" />
              {PLAYBACK_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackRate(spd)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono-tabular transition-colors cursor-pointer ${
                    playbackRate === spd
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Broadcast Title/Action Safe Guides Toggle */}
          <button
            type="button"
            onClick={() => setShowSafeAreaGuides((prev) => !prev)}
            title="محدوده امن تصویر (Safe Area — Action Safe 93% & Title Safe 85%)"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer ${
              showSafeAreaGuides
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Safe Area</span>
          </button>

          {/* Fullscreen Monitor Toggle */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title="نمای تمام‌صفحه مانیتور بازبینی و پلی‌اوت (Fullscreen)"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-teal-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-teal-400" />
            )}
            <span>{isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}</span>
          </button>

          {!readOnly && (
            <>
              {/* Open Dedicated Video Player Shortcuts Settings Modal */}
              <button
                type="button"
                onClick={() => setIsShortcutModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-[11px] font-semibold transition-colors cursor-pointer"
                title="باز کردن مدال تنظیمات شخصی‌سازی کلیدهای میان‌بر پلیر (جایگزینی Space و ذخیره در LocalStorage)"
              >
                <Sliders className="w-3.5 h-3.5 text-teal-400" />
                <span>
                  تنظیمات میان‌بر پلیر (پخش:{' '}
                  {formatShortcutBadge(shortcuts.player_toggle_play)})
                </span>
              </button>

              {/* Toggle Quick Inline Drawer */}
              <button
                type="button"
                onClick={() => {
                  setShowInlineShortcutEditor((prev) => !prev);
                  setRemappingAction(null);
                }}
                className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-[11px] transition-colors cursor-pointer ${
                  showInlineShortcutEditor
                    ? 'bg-slate-800 border-teal-500/50 text-teal-300'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                }`}
                title="ویرایش سریع درون‌خطی کلیدهای پلیر"
              >
                <Keyboard className="w-3.5 h-3.5 text-slate-300" />
                <Settings2 className="w-3 h-3" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsMuted((prev) => !prev)}
            title={`قطع / وصل صدا (${formatShortcutBadge(
              shortcuts.player_toggle_mute
            )})`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 cursor-pointer"
          >
            {isMuted || audioReading.isSilent ? (
              <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                <VolumeX className="w-3.5 h-3.5" />
                <span>{isMuted ? 'بی‌صدا' : 'افت صدا!'}</span>
              </span>
            ) : (
              <span
                dir="ltr"
                className="inline-flex items-center gap-1 text-slate-400 font-mono-tabular"
              >
                <Volume2 className="w-3.5 h-3.5 text-teal-400" />
                <span>{audioReading.leftDb} dBFS</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Inline Quick Customizable Keyboard Shortcuts Drawer */}
      {showInlineShortcutEditor && (
        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <span className="font-bold text-teal-300 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              <span>
                شخصی‌سازی سریع شورتکات‌های کیبورد پلیر (به همراه شاتل استاندارد
                J / K / L / I / O):
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsShortcutModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 rounded text-[11px] font-semibold cursor-pointer"
              >
                <Sliders className="w-3 h-3" />
                <span>مدال کامل تنظیمات شورتکات</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const defaults = getDefaultShortcuts();
                  setShortcuts(defaults);
                  saveShortcuts(defaults);
                  setRemappingAction(null);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-[11px] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>بازنشانی پیش‌فرض</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {playerShortcutDefs.map((def) => {
              const isRemapping = remappingAction === def.id;
              const currentBinding = shortcuts[def.id] || def.defaultBinding;
              return (
                <div
                  key={def.id}
                  className={`flex items-center justify-between gap-2 p-2 rounded-md border ${
                    isRemapping
                      ? 'bg-teal-950/50 border-teal-400'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <span className="text-slate-200 text-[11px] truncate">
                    {def.label}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRemappingAction(isRemapping ? null : def.id)
                    }
                    dir="ltr"
                    className={`px-2.5 py-1 rounded font-mono-tabular text-[11px] font-bold shrink-0 cursor-pointer ${
                      isRemapping
                        ? 'bg-amber-400 text-slate-950 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700'
                    }`}
                  >
                    {isRemapping
                      ? 'کلید را بزنید...'
                      : formatShortcutBadge(currentBinding)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  )}

      {/* Dedicated Video Player Shortcuts Settings Modal */}
      <VideoPlayerShortcutsModal
        isOpen={isShortcutModalOpen}
        onClose={() => setIsShortcutModalOpen(false)}
        onShortcutsChanged={(updated) => setShortcuts(updated)}
      />
    </div>
  );
}
