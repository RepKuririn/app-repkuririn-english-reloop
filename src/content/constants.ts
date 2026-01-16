/**
 * DOM selectors for YouTube elements.
 * Centralized here for easy updates when YouTube changes their DOM.
 *
 * MAINTENANCE NOTE:
 * If subtitles stop working, check these selectors first.
 * YouTube updates their DOM structure periodically.
 */
export const SELECTORS = {
  // Transcript panel (must be opened by user)
  transcriptPanel: 'ytd-transcript-renderer',
  transcriptSegmentList: 'ytd-transcript-segment-list-renderer',
  transcriptSegment: 'ytd-transcript-segment-renderer',
  segmentTimestamp: '.segment-timestamp',
  segmentText: '.segment-text',

  // Video player
  videoPlayer: 'video.html5-main-video',
  videoPlayerFallback: 'video',

  // Video metadata
  videoTitle: 'h1.ytd-watch-metadata yt-formatted-string',
  videoTitleFallback: 'h1.title yt-formatted-string',

  // Insertion points for our UI
  secondaryColumn: '#secondary-inner',
  secondaryColumnFallback: '#secondary',
  belowPlayer: '#below',

  // For detecting page type
  watchFlexy: 'ytd-watch-flexy',
} as const;

/**
 * Extension panel configuration
 */
export const PANEL_CONFIG = {
  /** Panel element ID */
  id: 'subtitle-loop-panel',
  /** Max height for segment list */
  maxHeight: 450,
  /** Highlight sync interval in ms */
  highlightInterval: 200,
  /** Loop check interval in ms */
  loopCheckInterval: 100,
} as const;

/**
 * Default group colors for new groups
 */
export const GROUP_COLORS = [
  '#2196f3', // Blue
  '#4caf50', // Green
  '#ff9800', // Orange
  '#9c27b0', // Purple
  '#f44336', // Red
  '#00bcd4', // Cyan
  '#795548', // Brown
  '#607d8b', // Blue Grey
] as const;

/**
 * Keyboard shortcuts configuration
 * Using Alt+ modifier to avoid conflicts with YouTube's native shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
  /** Set loop start point */
  setLoopStart: { key: '[', alt: true, ctrl: false, shift: false },
  /** Set loop end point */
  setLoopEnd: { key: ']', alt: true, ctrl: false, shift: false },
  /** Save current segment */
  saveSegment: { key: 's', alt: true, ctrl: false, shift: false },
  /** Clear loop */
  clearLoop: { key: 'c', alt: true, ctrl: false, shift: false },
  /** Refresh subtitles */
  refreshSubtitles: { key: 'r', alt: true, ctrl: false, shift: false },
} as const;

/**
 * Playback speed options
 */
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;
