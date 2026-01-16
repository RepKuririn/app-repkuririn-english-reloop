import { SELECTORS, PANEL_CONFIG } from './constants';
import type { LoopState } from '../types';

/**
 * Get the video player element
 */
export function getVideoPlayer(): HTMLVideoElement | null {
  return (
    document.querySelector<HTMLVideoElement>(SELECTORS.videoPlayer) ||
    document.querySelector<HTMLVideoElement>(SELECTORS.videoPlayerFallback)
  );
}

/**
 * Get the video player element with retry logic
 * Retries up to 3 times with 500ms delay between attempts
 */
export async function getVideoPlayerWithRetry(
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<HTMLVideoElement | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const video = getVideoPlayer();

    if (video) {
      console.log(`[Subtitle Loop] Video player found (attempt ${attempt})`);
      return video;
    }

    if (attempt < maxRetries) {
      console.log(`[Subtitle Loop] Video player not found, retrying... (${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.error('[Subtitle Loop] Video player not found after retries');
  return null;
}

/**
 * Seek video to specific time
 */
export function seekTo(seconds: number): boolean {
  const video = getVideoPlayer();
  if (!video) {
    console.error('[Subtitle Loop] Video player not found');
    return false;
  }

  video.currentTime = seconds;
  return true;
}

/**
 * Get current playback time
 */
export function getCurrentTime(): number {
  const video = getVideoPlayer();
  return video?.currentTime ?? 0;
}

/**
 * Get video duration
 */
export function getDuration(): number {
  const video = getVideoPlayer();
  return video?.duration ?? 0;
}

/**
 * Play video
 */
export function play(): void {
  const video = getVideoPlayer();
  video?.play();
}

/**
 * Pause video
 */
export function pause(): void {
  const video = getVideoPlayer();
  video?.pause();
}

/**
 * Check if video is playing
 */
export function isPlaying(): boolean {
  const video = getVideoPlayer();
  return video ? !video.paused : false;
}

/**
 * Set playback speed
 */
export function setPlaybackRate(rate: number): boolean {
  const video = getVideoPlayer();
  if (!video) {
    console.error('[Subtitle Loop] Video player not found');
    return false;
  }

  // Clamp rate between 0.25 and 2.0 (YouTube's limits)
  const clampedRate = Math.max(0.25, Math.min(2.0, rate));
  video.playbackRate = clampedRate;
  console.log(`[Subtitle Loop] Playback rate set to ${clampedRate}x`);
  return true;
}

/**
 * Get current playback speed
 */
export function getPlaybackRate(): number {
  const video = getVideoPlayer();
  return video?.playbackRate ?? 1.0;
}

/**
 * Loop Controller Class
 * Manages A-B loop functionality
 */
export class LoopController {
  private startTime: number | null = null;
  private endTime: number | null = null;
  private isActive = false;
  private intervalId: number | null = null;
  private onStateChange: ((state: LoopState) => void) | null = null;

  constructor(onStateChange?: (state: LoopState) => void) {
    this.onStateChange = onStateChange || null;
  }

  /**
   * Set loop start point
   */
  setStart(time: number): void {
    this.startTime = time;
    this.notifyStateChange();
  }

  /**
   * Set loop end point and activate loop
   */
  setEnd(time: number): void {
    if (this.startTime === null) {
      console.warn('[Subtitle Loop] Cannot set end without start');
      return;
    }

    // Ensure start < end
    const start = Math.min(this.startTime, time);
    const end = Math.max(this.startTime, time);

    this.startTime = start;
    this.endTime = end;
    this.activate();
  }

  /**
   * Set both start and end, then activate
   */
  setLoop(start: number, end: number): void {
    this.startTime = Math.min(start, end);
    this.endTime = Math.max(start, end);
    this.activate();
  }

  /**
   * Activate the loop
   */
  private activate(): void {
    if (this.startTime === null || this.endTime === null) {
      return;
    }

    this.isActive = true;
    this.startMonitoring();
    seekTo(this.startTime);
    this.notifyStateChange();

    console.log(`[Subtitle Loop] Loop activated: ${this.startTime}s - ${this.endTime}s`);
  }

  /**
   * Clear and deactivate the loop
   */
  clear(): void {
    this.stopMonitoring();
    this.startTime = null;
    this.endTime = null;
    this.isActive = false;
    this.notifyStateChange();

    console.log('[Subtitle Loop] Loop cleared');
  }

  /**
   * Get current loop state
   */
  getState(): LoopState {
    return {
      isActive: this.isActive,
      startTime: this.startTime,
      endTime: this.endTime,
    };
  }

  /**
   * Check if we're in "setting start" mode
   */
  isSettingStart(): boolean {
    return this.startTime !== null && this.endTime === null && !this.isActive;
  }

  /**
   * Start monitoring playback for loop point
   */
  private startMonitoring(): void {
    if (this.intervalId !== null) {
      return;
    }

    this.intervalId = window.setInterval(() => {
      if (!this.isActive || this.startTime === null || this.endTime === null) {
        return;
      }

      const currentTime = getCurrentTime();

      // Check if we've passed the end point
      if (currentTime >= this.endTime) {
        seekTo(this.startTime);
      }
    }, PANEL_CONFIG.loopCheckInterval);
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Notify listener of state change
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.stopMonitoring();
    this.onStateChange = null;
  }
}
