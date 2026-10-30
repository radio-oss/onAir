export interface AudioMeterReading {
  leftDb: number; // -60 to 0 dBFS
  rightDb: number; // -60 to 0 dBFS
  leftPercent: number; // 0 to 100% for UI bar
  rightPercent: number; // 0 to 100% for UI bar
  isClipping: boolean; // > -1 dBFS
  isSilent: boolean; // < -48 dBFS
}

export function computeSyntheticAudioLevels(
  isPlaying: boolean,
  currentTimeSec: number,
  hasAudioDropMarkerNearPlayhead = false
): AudioMeterReading {
  if (!isPlaying || hasAudioDropMarkerNearPlayhead) {
    return {
      leftDb: -60,
      rightDb: -60,
      leftPercent: 2,
      rightPercent: 2,
      isClipping: false,
      isSilent: isPlaying && hasAudioDropMarkerNearPlayhead,
    };
  }

  // Smooth deterministic broadcast dialogue/music modulation around -12 dBFS (EBU R128 standard)
  const waveL =
    Math.sin(currentTimeSec * 7.3) * 6 + Math.cos(currentTimeSec * 13.1) * 3;
  const waveR =
    Math.cos(currentTimeSec * 6.7) * 6 + Math.sin(currentTimeSec * 11.9) * 3;

  const leftDb = Math.max(-55, Math.min(0, -12 + waveL));
  const rightDb = Math.max(-55, Math.min(0, -12 + waveR));

  const leftPercent = Math.round(((leftDb + 60) / 60) * 100);
  const rightPercent = Math.round(((rightDb + 60) / 60) * 100);

  return {
    leftDb: Number(leftDb.toFixed(1)),
    rightDb: Number(rightDb.toFixed(1)),
    leftPercent,
    rightPercent,
    isClipping: leftDb > -1 || rightDb > -1,
    isSilent: leftDb < -48 && rightDb < -48,
  };
}
