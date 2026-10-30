// lib/playout-bridge.ts
import {
  ConductorSchedule,
  WORKFLOW_STAGE_META,
  parseTimeToSeconds,
  formatDurationTotal,
  isItemApprovedForPlayout,
} from './conductor-data';

/**
 * Generates CasparCG AMCP commands respecting each item's non-destructive Trim (Mark In / Out)
 * and enforcing broadcast approval checks so unapproved files are never queued for air.
 * FPS standard for IRIB PAL/HD Broadcast: 25 fps
 */
export function generateCasparCGCommands(schedule: ConductorSchedule): string {
  const fps = 25;
  const lines: string[] = [
    `// CasparCG Playout Automation Script - ${schedule.title}`,
    `// Date: ${schedule.dateShamsi} | Local Offline Broadcast Infrastructure`,
    `// Designer: Shahabuddin Bagheri Dolatabadi`,
    '',
  ];

  for (const item of schedule.items) {
    const trimInFrames = Math.round((item.trimInSec || 0) * fps);
    const netDurationFrames = Math.round(
      parseTimeToSeconds(item.duration) * fps
    );
    const versionTag = `v${item.revisionVersion || 1}`;
    const approved = isItemApprovedForPlayout(item);
    const stageLabel =
      WORKFLOW_STAGE_META[item.workflowStatus || 'approved_for_playout']
        .shortLabel;

    lines.push(
      `// Row ${item.order} [${item.startTime} - ${item.endTime}] ${item.title} (${versionTag}) — Status: ${stageLabel}`
    );

    if (approved) {
      lines.push(
        `LOADBG 1-10 "${item.mediaCode}_${versionTag}" SEEK ${trimInFrames} LENGTH ${netDurationFrames} AUTO`
      );
    } else {
      lines.push(
        `// BLOCKED_UNAPPROVED: "${item.mediaCode}_${versionTag}" is not approved for playout (${stageLabel}). Loading standby filler:`
      );
      lines.push(
        `LOADBG 1-10 "IRIB_ISFAHAN_STANDBY_FILLER" SEEK 0 LENGTH ${netDurationFrames} AUTO`
      );
    }
    lines.push('');
  }

  return lines.join('\r\n');
}

/**
 * Generates a standard CMX 3600 EDL (Edit Decision List) file with all QC Markers (including time ranges) and Trim points
 */
export function generateCMX3600EDL(schedule: ConductorSchedule): string {
  const lines: string[] = [
    `TITLE: IRIB_ISFAHAN_${schedule.dateShamsi.replace(/\//g, '_')}`,
    'FCM: NON-DROP FRAME',
    '',
  ];

  schedule.items.forEach((item, index) => {
    const eventNum = String(index + 1).padStart(3, '0');
    const srcIn = `${formatDurationTotal(item.trimInSec || 0)}:00`;
    const srcOut = `${formatDurationTotal(
      item.trimOutSec ||
        item.sourceDurationSec ||
        parseTimeToSeconds(item.duration)
    )}:00`;
    const recIn = `${item.startTime}:00`;
    const recOut = `${item.endTime}:00`;
    const versionTag = `v${item.revisionVersion || 1}`;

    lines.push(
      `${eventNum}  ${item.mediaCode.slice(0, 8).padEnd(8, ' ')} V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`
    );
    lines.push(
      `* FROM CLIP NAME: ${item.title} (${versionTag} - ${item.videoFileName || item.mediaCode})`
    );

    if (item.qcMarkers && item.qcMarkers.length > 0) {
      item.qcMarkers.forEach((m) => {
        const spanText = m.endTimecode
          ? `${m.timecode} - ${m.endTimecode}`
          : m.timecode;
        const statusText = m.resolved ? 'RESOLVED' : 'OPEN';
        lines.push(
          `* LOC: ${m.timecode}:00 RED     [v${m.versionNumber || 1} | ${statusText} | ${spanText}] ${m.note}`
        );
      });
    }
    lines.push('');
  });

  return lines.join('\r\n');
}
