export const RESOLUTION_SHORT_SIDE = {
  original: null,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
};

/** Scales so the SHORT side of the frame matches R, preserving aspect ratio and parity,
 * so vertical (phone) videos are not distorted. */
export function shortSideScaleFilter(R) {
  return `scale=if(gt(iw\\,ih)\\,-2\\,trunc(min(${R}\\,iw)/2)*2):if(gt(iw\\,ih)\\,trunc(min(${R}\\,ih)/2)*2\\,-2)`;
}

export const AUDIO_BITRATE_ARGS = {
  copy: ['-c:a', 'copy'],
  keep128: ['-c:a', 'aac', '-b:a', '128k'],
  reduce96: ['-c:a', 'aac', '-b:a', '96k'],
  reduce64: ['-c:a', 'aac', '-b:a', '64k'],
  none: ['-an'],
};

// 'copy' keeps the original track untouched; its real bitrate is unknown, so the
// target-size budget reserves a generous estimate.
export const AUDIO_BITRATE_KBPS = { copy: 192, keep128: 128, reduce96: 96, reduce64: 64, none: 0 };

// Used when the original audio cannot be copied into the output container.
export const AUDIO_HIGH_QUALITY_FALLBACK = ['-c:a', 'aac', '-b:a', '256k'];
