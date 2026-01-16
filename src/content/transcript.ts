import { SELECTORS } from './constants';
import type { TranscriptSegment, VideoInfo } from '../types';

/**
 * Parse timestamp string to seconds
 * Handles formats: "1:23", "01:23", "1:02:30"
 */
export function parseTimestamp(timeStr: string): number {
  const cleaned = timeStr.trim();
  const parts = cleaned.split(':').map(p => parseInt(p, 10));

  if (parts.some(isNaN)) {
    console.warn('[Subtitle Loop] Invalid timestamp:', timeStr);
    return 0;
  }

  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
}

/**
 * Format seconds to timestamp string
 * Output: "1:23" or "1:02:30" for videos over 1 hour
 */
export function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if transcript panel is currently visible
 */
export function isTranscriptPanelOpen(): boolean {
  const panel = document.querySelector(SELECTORS.transcriptPanel);
  return panel !== null && panel.querySelector(SELECTORS.transcriptSegment) !== null;
}

/**
 * Extract all transcript segments from the DOM
 */
export function extractTranscriptSegments(): TranscriptSegment[] {
  const segmentElements = document.querySelectorAll(SELECTORS.transcriptSegment);

  if (segmentElements.length === 0) {
    console.log('[Subtitle Loop] No transcript segments found');
    return [];
  }

  const segments: TranscriptSegment[] = [];

  segmentElements.forEach((element, index) => {
    const timestampEl = element.querySelector(SELECTORS.segmentTimestamp);
    const textEl = element.querySelector(SELECTORS.segmentText);

    if (!timestampEl || !textEl) {
      console.warn('[Subtitle Loop] Malformed segment at index', index);
      return;
    }

    const timeStr = timestampEl.textContent?.trim() || '0:00';
    const text = textEl.textContent?.trim() || '';

    segments.push({
      index,
      startTime: parseTimestamp(timeStr),
      text,
      element: element as HTMLElement,
    });
  });

  console.log(`[Subtitle Loop] Extracted ${segments.length} segments`);
  return segments;
}

/**
 * Get current video information from the page
 */
export function getVideoInfo(): VideoInfo | null {
  // Extract video ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('v');

  if (!videoId) {
    console.warn('[Subtitle Loop] No video ID in URL');
    return null;
  }

  // Extract title
  let title = '';
  const titleEl = document.querySelector(SELECTORS.videoTitle)
    || document.querySelector(SELECTORS.videoTitleFallback);

  if (titleEl) {
    title = titleEl.textContent?.trim() || '';
  }

  return {
    videoId,
    videoUrl: window.location.href,
    title,
  };
}

/**
 * Find the segment that contains the given time
 */
export function findSegmentAtTime(
  segments: TranscriptSegment[],
  currentTime: number
): TranscriptSegment | null {
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    const segmentEnd = nextSegment?.startTime ?? Infinity;

    if (currentTime >= segment.startTime && currentTime < segmentEnd) {
      return segment;
    }
  }
  return null;
}

/**
 * Get text for a time range (combines multiple segments)
 */
export function getTextForRange(
  segments: TranscriptSegment[],
  startTime: number,
  endTime: number
): string {
  const relevantSegments = segments.filter(
    seg => seg.startTime >= startTime && seg.startTime < endTime
  );

  return relevantSegments.map(seg => seg.text).join(' ');
}
