// lib/isfahan-azan-calculator.ts
import {
  formatSecondsToTime,
  parseTimeToSeconds,
  formatDurationTotal,
} from './conductor-data';

export interface IsfahanPrayerTimes {
  fajr: string; // اذان صبح به افق اصفهان
  sunrise: string; // طلوع آفتاب
  dhuhr: string; // اذان ظهر به افق اصفهان
  sunset: string; // غروب آفتاب
  maghrib: string; // اذان مغرب به افق اصفهان
}

export interface NextAzanAlertInfo {
  slotId: 'dhuhr' | 'maghrib';
  label: string;
  exactTime: string;
  remainingSec: number;
  remainingFormatted: string;
  isImminent: boolean; // <= 15 minutes (900 seconds)
  isOnNow: boolean; // Within 5 minutes after Azan time
  allTimes: IsfahanPrayerTimes;
}

export interface TomorrowAzanComparisonRow {
  key: keyof IsfahanPrayerTimes;
  title: string;
  isMainBroadcastBox: boolean;
  todayTime: string;
  tomorrowTime: string;
  diffSeconds: number;
  recommendedPreBoxStart: string; // 5 mins before Azan for Niyayesh/Countdown
  recommendedBoxEnd: string; // 10 mins after Azan
}

export interface TomorrowAzanSchedulePreview {
  todayDateGregorian: string;
  tomorrowDateGregorian: string;
  todayTimes: IsfahanPrayerTimes;
  tomorrowTimes: IsfahanPrayerTimes;
  rows: TomorrowAzanComparisonRow[];
}

/**
 * Offline solar equation of time & declination calculator for Isfahan (32.6546° N, 51.6680° E, UTC+3:30)
 */
export function calculateIsfahanPrayerTimes(
  dateStr = '2026-10-04'
): IsfahanPrayerTimes {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / 86400000
  );

  const latRad = (32.6546 * Math.PI) / 180;
  const lonDeg = 51.668;
  const tzOffsetHours = 3.5; // Iran Standard Time (IRST UTC+3:30)

  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);

  // Equation of time (in minutes)
  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination (in radians)
  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma);

  const dhuhrHours = 12 + tzOffsetHours - lonDeg / 15 - eqTimeMin / 60;

  const hourAngleForZenith = (zenithDeg: number) => {
    const zRad = (zenithDeg * Math.PI) / 180;
    const cosH =
      (Math.cos(zRad) - Math.sin(latRad) * Math.sin(declRad)) /
      (Math.cos(latRad) * Math.cos(declRad));
    const clamped = Math.max(-1, Math.min(1, cosH));
    return (Math.acos(clamped) * 180) / Math.PI / 15;
  };

  const sunriseOffset = hourAngleForZenith(90.833);
  const fajrOffset = hourAngleForZenith(107.7); // 17.7° Tehran Geophysics Fajr angle
  const maghribOffset = hourAngleForZenith(94.5); // 4.5° Tehran Geophysics Maghrib angle

  const toTime = (hours: number) =>
    formatSecondsToTime(Math.round(hours * 3600));

  return {
    fajr: toTime(dhuhrHours - fajrOffset),
    sunrise: toTime(dhuhrHours - sunriseOffset),
    dhuhr: toTime(dhuhrHours),
    sunset: toTime(dhuhrHours + sunriseOffset),
    maghrib: toTime(dhuhrHours + maghribOffset),
  };
}

/**
 * Calculates tomorrow's prayer times and broadcast Azan box windows for playout planning
 */
export function calculateTomorrowIsfahanPrayerPreview(
  baseDateStr = '2026-10-04'
): TomorrowAzanSchedulePreview {
  const baseDate = new Date(baseDateStr);
  const validBase = Number.isNaN(baseDate.getTime())
    ? new Date('2026-10-04')
    : baseDate;

  const tomorrowDate = new Date(validBase.getTime() + 86400000);
  const todayIso = validBase.toISOString().slice(0, 10);
  const tomorrowIso = tomorrowDate.toISOString().slice(0, 10);

  const todayTimes = calculateIsfahanPrayerTimes(todayIso);
  const tomorrowTimes = calculateIsfahanPrayerTimes(tomorrowIso);

  const definitions: Array<{
    key: keyof IsfahanPrayerTimes;
    title: string;
    isMainBroadcastBox: boolean;
  }> = [
    { key: 'fajr', title: 'اذان صبح به افق اصفهان', isMainBroadcastBox: true },
    { key: 'sunrise', title: 'طلوع آفتاب اصفهان', isMainBroadcastBox: false },
    { key: 'dhuhr', title: 'اذان ظهر به افق اصفهان', isMainBroadcastBox: true },
    { key: 'sunset', title: 'غروب آفتاب اصفهان', isMainBroadcastBox: false },
    {
      key: 'maghrib',
      title: 'اذان مغرب به افق اصفهان',
      isMainBroadcastBox: true,
    },
  ];

  const rows: TomorrowAzanComparisonRow[] = definitions.map((def) => {
    const tToday = todayTimes[def.key];
    const tTomorrow = tomorrowTimes[def.key];
    const secToday = parseTimeToSeconds(tToday);
    const secTomorrow = parseTimeToSeconds(tTomorrow);

    return {
      key: def.key,
      title: def.title,
      isMainBroadcastBox: def.isMainBroadcastBox,
      todayTime: tToday,
      tomorrowTime: tTomorrow,
      diffSeconds: secTomorrow - secToday,
      recommendedPreBoxStart: formatSecondsToTime(
        Math.max(0, secTomorrow - 300)
      ),
      recommendedBoxEnd: formatSecondsToTime((secTomorrow + 600) % 86400),
    };
  });

  return {
    todayDateGregorian: todayIso,
    tomorrowDateGregorian: tomorrowIso,
    todayTimes,
    tomorrowTimes,
    rows,
  };
}

/**
 * Determines the upcoming Dhuhr or Maghrib Azan box and live countdown for the antenna operator
 */
export function getNextIsfahanAzanStatus(
  clockSec: number,
  dateStr = '2026-10-04'
): NextAzanAlertInfo {
  const times = calculateIsfahanPrayerTimes(dateStr);
  const dhuhrSec = parseTimeToSeconds(times.dhuhr);
  const maghribSec = parseTimeToSeconds(times.maghrib);
  const normalizedClock = ((clockSec % 86400) + 86400) % 86400;

  // Check if currently within 5 minutes (300s) of Dhuhr Azan
  if (normalizedClock >= dhuhrSec && normalizedClock < dhuhrSec + 300) {
    return {
      slotId: 'dhuhr',
      label: 'باکس اذان ظهر به افق اصفهان (در حال پخش)',
      exactTime: times.dhuhr,
      remainingSec: 0,
      remainingFormatted: '۰۰:۰۰:۰۰ (هم‌اکنون)',
      isImminent: true,
      isOnNow: true,
      allTimes: times,
    };
  }

  // Check if currently within 5 minutes (300s) of Maghrib Azan
  if (normalizedClock >= maghribSec && normalizedClock < maghribSec + 300) {
    return {
      slotId: 'maghrib',
      label: 'باکس اذان مغرب به افق اصفهان (در حال پخش)',
      exactTime: times.maghrib,
      remainingSec: 0,
      remainingFormatted: '۰۰:۰۰:۰۰ (هم‌اکنون)',
      isImminent: true,
      isOnNow: true,
      allTimes: times,
    };
  }

  // Before Dhuhr -> Next is Dhuhr
  if (normalizedClock < dhuhrSec) {
    const rem = dhuhrSec - normalizedClock;
    return {
      slotId: 'dhuhr',
      label: 'باکس اذان ظهر به افق اصفهان',
      exactTime: times.dhuhr,
      remainingSec: rem,
      remainingFormatted: formatDurationTotal(rem),
      isImminent: rem <= 900,
      isOnNow: false,
      allTimes: times,
    };
  }

  // Between Dhuhr and Maghrib -> Next is Maghrib
  if (normalizedClock < maghribSec) {
    const rem = maghribSec - normalizedClock;
    return {
      slotId: 'maghrib',
      label: 'باکس اذان مغرب به افق اصفهان',
      exactTime: times.maghrib,
      remainingSec: rem,
      remainingFormatted: formatDurationTotal(rem),
      isImminent: rem <= 900,
      isOnNow: false,
      allTimes: times,
    };
  }

  // After Maghrib -> Next day's Dhuhr
  const rem = 86400 - normalizedClock + dhuhrSec;
  return {
    slotId: 'dhuhr',
    label: 'باکس اذان ظهر فردا به افق اصفهان',
    exactTime: times.dhuhr,
    remainingSec: rem,
    remainingFormatted: formatDurationTotal(rem),
    isImminent: rem <= 900,
    isOnNow: false,
    allTimes: times,
  };
}
