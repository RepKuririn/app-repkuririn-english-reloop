import { SELECTORS, PANEL_CONFIG, PLAYBACK_SPEEDS } from '../constants';
import {
  extractTranscriptSegments,
  isTranscriptPanelOpen,
  formatTimestamp,
  findSegmentAtTime,
  getVideoInfo,
  getTextForRange
} from '../transcript';
import { seekTo, getCurrentTime, LoopController, setPlaybackRate } from '../player';
import { showToast } from './toast';
import { SaveDialog } from './save-dialog';
import type { TranscriptSegment, LoopState, SavePhrasePayload, Phrase } from '../../types';

export class SubtitlePanel {
  private container: HTMLElement | null = null;
  private segments: TranscriptSegment[] = [];
  private highlightIntervalId: number | null = null;
  private currentSegmentIndex: number = -1;
  private loopController: LoopController;
  private saveDialog: SaveDialog | null = null;
  private savedPhrases: Phrase[] = [];

  constructor() {
    this.loopController = new LoopController((state) => {
      this.updateLoopStatusDisplay(state);
    });
  }

  /**
   * Create and inject the panel into the page
   */
  create(): void {
    this.destroy(); // Remove existing panel if any

    // Re-initialize loopController with callback after destroy
    this.loopController = new LoopController((state) => {
      this.updateLoopStatusDisplay(state);
    });

    this.container = document.createElement('div');
    this.container.id = PANEL_CONFIG.id;
    this.container.className = 'sl-panel';
    this.container.innerHTML = this.getTemplate();

    // Find insertion point
    const insertionPoint =
      document.querySelector(SELECTORS.secondaryColumn) ||
      document.querySelector(SELECTORS.secondaryColumnFallback);

    if (insertionPoint) {
      insertionPoint.prepend(this.container);
    } else {
      // Fallback: fixed position
      this.container.classList.add('sl-fixed');
      document.body.appendChild(this.container);
    }

    this.bindEvents();
    this.startHighlightSync();

    console.log('[Subtitle Loop] Panel created');
  }

  /**
   * Remove panel from the page
   */
  destroy(): void {
    this.stopHighlightSync();
    this.loopController.destroy();
    this.saveDialog?.destroy();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.segments = [];
    this.currentSegmentIndex = -1;
  }

  /**
   * Load transcript from YouTube's panel
   */
  async loadTranscript(): Promise<void> {
    if (!isTranscriptPanelOpen()) {
      this.showMessage(`
        <div class="sl-instruction">
          <p><strong>📋 字幕パネルを開いてください:</strong></p>
          <ol>
            <li>動画下の「<strong>...</strong>」ボタンをクリック</li>
            <li>「<strong>文字起こしを表示</strong>」を選択</li>
            <li>ここで「<strong>🔄</strong>」を再クリック</li>
          </ol>
        </div>
      `);
      return;
    }

    this.segments = extractTranscriptSegments();

    if (this.segments.length === 0) {
      this.showMessage('❌ 字幕が見つかりませんでした');
      return;
    }

    this.renderSegments();
    await this.loadSavedPhrases();
    console.log(`[Subtitle Loop] Loaded ${this.segments.length} segments`);
  }

  /**
   * Generate panel HTML template
   */
  private getTemplate(): string {
    return `
      <div class="sl-panel-header">
        <span class="sl-title">Subtitle Loop</span>
        <div class="sl-speed-control">
          ${PLAYBACK_SPEEDS.map(speed => `
            <button class="sl-btn sl-btn-speed ${speed === 1.0 ? 'sl-active' : ''}"
                    data-action="speed"
                    data-speed="${speed}"
                    title="再生速度: ${speed}x">
              ${speed}x
            </button>
          `).join('')}
        </div>
        <button class="sl-btn sl-btn-refresh" data-action="refresh" title="字幕を再読み込み">
          🔄 読み込み
        </button>
      </div>

      <div class="sl-panel-body">
        <div class="sl-controls">
          <div class="sl-loop-status" data-loop-status>
            ループ: OFF
          </div>
          <button class="sl-btn sl-btn-small" data-action="clear-loop" title="ループ解除" disabled>
            ✖ クリア
          </button>
        </div>

        <div class="sl-saved-phrases" data-saved-phrases style="display: none;">
          <div class="sl-saved-header">
            <span>💾 保存済み (<span data-saved-count>0</span>)</span>
            <button class="sl-btn sl-btn-icon" data-action="toggle-saved" title="折りたたみ">
              ▼
            </button>
          </div>
          <div class="sl-saved-list" data-saved-list>
            <!-- Populated by JS -->
          </div>
        </div>

        <div class="sl-segments" data-segments>
          <div class="sl-message">
            「🔄 読み込み」をクリックして字幕を読み込んでください
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show a message in the segments area
   */
  private showMessage(html: string): void {
    const container = this.container?.querySelector('[data-segments]');
    if (container) {
      container.innerHTML = `<div class="sl-message">${html}</div>`;
    }
  }

  /**
   * Render all segments
   */
  private renderSegments(): void {
    const container = this.container?.querySelector('[data-segments]');
    if (!container) return;

    const loopState = this.loopController.getState();
    console.log('[DEBUG] renderSegments - loopState:', loopState);

    let segmentsWithLoopClass = 0;
    let segmentsWithStartClass = 0;
    let segmentsWithEndClass = 0;

    container.innerHTML = this.segments.map((segment, index) => {
      const nextSegment = this.segments[index + 1];
      const segmentEnd = nextSegment?.startTime ?? segment.startTime + 5;

      // Check if this segment is in loop range
      let inLoopRange = false;
      let isLoopStart = false;
      let isLoopEnd = false;

      if (loopState.startTime !== null && loopState.endTime !== null) {
        inLoopRange = segment.startTime >= loopState.startTime && segment.startTime < loopState.endTime;
        isLoopStart = segment.startTime === loopState.startTime;
        isLoopEnd = segmentEnd > loopState.endTime && segment.startTime < loopState.endTime;
      }

      const classes = ['sl-segment'];
      if (inLoopRange) {
        classes.push('sl-segment-in-loop');
        segmentsWithLoopClass++;
      }
      if (isLoopStart) {
        classes.push('sl-segment-loop-start');
        segmentsWithStartClass++;
      }
      if (isLoopEnd) {
        classes.push('sl-segment-loop-end');
        segmentsWithEndClass++;
      }

      return `
        <div class="${classes.join(' ')}"
             data-index="${index}"
             data-time="${segment.startTime}">
          <div class="sl-segment-main">
            <span class="sl-timestamp">${formatTimestamp(segment.startTime)}</span>
            <span class="sl-text">${this.escapeHtml(segment.text)}</span>
          </div>
          <div class="sl-segment-actions">
            <button class="sl-btn sl-btn-icon sl-btn-loop"
                    data-action="loop"
                    data-index="${index}"
                    data-time="${segment.startTime}"
                    title="ループ設定 (同じ行を2回クリックで単体ループ)">
              🔁
            </button>
            <button class="sl-btn sl-btn-icon sl-btn-save"
                    data-action="save"
                    data-index="${index}"
                    title="フレーズを保存">
              💾
            </button>
          </div>
        </div>
      `;
    }).join('');

    console.log(`[DEBUG] renderSegments complete - in-loop: ${segmentsWithLoopClass}, start: ${segmentsWithStartClass}, end: ${segmentsWithEndClass}`);
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    if (!this.container) return;

    // Event delegation for all clicks
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');

      if (action) {
        this.handleAction(action, target);
        return;
      }

      // Click on saved phrase - switch to that loop
      const savedItem = target.closest('.sl-saved-item') as HTMLElement;
      if (savedItem) {
        const startTime = parseFloat(savedItem.dataset.start || '0');
        const endTime = parseFloat(savedItem.dataset.end || '0');
        this.switchToLoop(startTime, endTime);
        return;
      }

      // Click on segment (not on buttons) - seek to that time
      const segment = target.closest('.sl-segment') as HTMLElement;
      if (segment && !target.closest('.sl-segment-actions')) {
        const time = parseFloat(segment.dataset.time || '0');
        seekTo(time);
      }
    });
  }

  /**
   * Handle button actions
   */
  private handleAction(action: string, target: HTMLElement): void {
    switch (action) {
      case 'refresh':
        this.loadTranscript();
        break;

      case 'clear-loop':
        this.loopController.clear();
        break;

      case 'loop':
        this.handleLoopClick(target);
        break;

      case 'save':
        this.handleSaveClick(target);
        break;

      case 'toggle-saved':
        this.toggleSavedSection();
        break;

      case 'speed':
        this.handleSpeedChange(target);
        break;
    }
  }

  /**
   * Toggle saved phrases section visibility
   */
  private toggleSavedSection(): void {
    const savedList = this.container?.querySelector('[data-saved-list]') as HTMLElement;
    const toggleBtn = this.container?.querySelector('[data-action="toggle-saved"]');

    if (!savedList || !toggleBtn) return;

    if (savedList.style.display === 'none') {
      savedList.style.display = 'block';
      toggleBtn.textContent = '▼';
    } else {
      savedList.style.display = 'none';
      toggleBtn.textContent = '▶';
    }
  }

  /**
   * Handle loop button click
   */
  private handleLoopClick(target: HTMLElement): void {
    const indexStr = target.getAttribute('data-index');
    const index = indexStr ? parseInt(indexStr, 10) : -1;

    if (index < 0 || index >= this.segments.length) return;

    const segment = this.segments[index];
    const nextSegment = this.segments[index + 1];
    const time = segment.startTime;
    const state = this.loopController.getState();

    if (!state.isActive && state.startTime === null) {
      // First click - set start
      this.loopController.setStart(time);
      seekTo(time);
      this.renderSegments(); // Re-render to show visual feedback
      console.log('[Subtitle Loop] Loop start set:', time);
    } else if (this.loopController.isSettingStart()) {
      // Check if same segment clicked twice
      if (state.startTime === time) {
        // Same segment - loop just this segment
        const endTime = nextSegment?.startTime ?? time + 5;
        this.loopController.setLoop(time, endTime);
        this.renderSegments();
        console.log('[Subtitle Loop] Single segment loop:', time, '-', endTime);
      } else {
        // Different segment - set end and activate
        this.loopController.setEnd(time);
        this.renderSegments();
        console.log('[Subtitle Loop] Loop activated');
      }
    } else {
      // Loop is active - clear and set new start
      this.loopController.clear();
      this.loopController.setStart(time);
      seekTo(time);
      this.renderSegments();
      console.log('[Subtitle Loop] Loop reset, new start:', time);
    }
  }

  /**
   * Update loop status display
   */
  private updateLoopStatusDisplay(state: LoopState): void {
    console.log('[DEBUG] updateLoopStatusDisplay called with state:', state);

    const statusEl = this.container?.querySelector('[data-loop-status]');
    const clearBtn = this.container?.querySelector('[data-action="clear-loop"]') as HTMLButtonElement;

    console.log('[DEBUG] statusEl found:', !!statusEl, 'clearBtn found:', !!clearBtn);

    if (!statusEl || !clearBtn) {
      console.warn('[DEBUG] Elements not found!');
      return;
    }

    if (state.isActive && state.startTime !== null && state.endTime !== null) {
      const newText = `🔁 ループ中: ${formatTimestamp(state.startTime)} → ${formatTimestamp(state.endTime)}`;
      console.log('[DEBUG] Setting ACTIVE state, text:', newText);
      statusEl.textContent = newText;
      statusEl.className = 'sl-loop-status sl-loop-active';
      clearBtn.disabled = false;
      console.log('[DEBUG] After update - statusEl.textContent:', statusEl.textContent);
      console.log('[DEBUG] After update - statusEl.className:', statusEl.className);
      console.log('[DEBUG] After update - clearBtn.disabled:', clearBtn.disabled);
      this.renderSegments(); // Update segment visual indicators
    } else if (state.startTime !== null && state.endTime === null) {
      const newText = `📍 開始: ${formatTimestamp(state.startTime)} (🔁 終了を選択 または 同じ行で単体ループ)`;
      console.log('[DEBUG] Setting SETTING state, text:', newText);
      statusEl.textContent = newText;
      statusEl.className = 'sl-loop-status sl-loop-setting';
      clearBtn.disabled = false;
      this.renderSegments();
    } else {
      console.log('[DEBUG] Setting OFF state');
      statusEl.textContent = 'ループ: OFF';
      statusEl.className = 'sl-loop-status';
      clearBtn.disabled = true;
      this.renderSegments();
    }
  }

  /**
   * Start syncing current segment highlight with video playback
   */
  private startHighlightSync(): void {
    if (this.highlightIntervalId !== null) {
      return;
    }

    this.highlightIntervalId = window.setInterval(() => {
      if (this.segments.length === 0) return;

      const currentTime = getCurrentTime();
      const segment = findSegmentAtTime(this.segments, currentTime);

      if (segment && segment.index !== this.currentSegmentIndex) {
        this.highlightSegment(segment.index);
      }
    }, PANEL_CONFIG.highlightInterval);
  }

  /**
   * Stop highlight sync
   */
  private stopHighlightSync(): void {
    if (this.highlightIntervalId !== null) {
      clearInterval(this.highlightIntervalId);
      this.highlightIntervalId = null;
    }
  }

  /**
   * Highlight a specific segment
   */
  private highlightSegment(index: number): void {
    if (!this.container) return;

    // Remove previous highlight
    const previousHighlight = this.container.querySelector('.sl-segment-active');
    previousHighlight?.classList.remove('sl-segment-active');

    // Add new highlight
    const newSegment = this.container.querySelector(`.sl-segment[data-index="${index}"]`);
    if (newSegment) {
      newSegment.classList.add('sl-segment-active');
      // Scroll into view if needed
      newSegment.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    this.currentSegmentIndex = index;
  }

  /**
   * Handle save button click
   */
  private async handleSaveClick(target: HTMLElement): Promise<void> {
    const indexStr = target.getAttribute('data-index');
    const index = indexStr ? parseInt(indexStr, 10) : -1;

    if (index < 0 || index >= this.segments.length) return;

    const segment = this.segments[index];
    const nextSegment = this.segments[index + 1];

    const videoInfo = getVideoInfo();
    if (!videoInfo) {
      showToast('❌ 動画情報を取得できませんでした');
      return;
    }

    const loopState = this.loopController.getState();

    // Determine time range
    let startTime: number;
    let endTime: number;
    let text: string;

    if (loopState.isActive && loopState.startTime !== null && loopState.endTime !== null) {
      // Use loop range
      startTime = loopState.startTime;
      endTime = loopState.endTime;
      text = getTextForRange(this.segments, startTime, endTime);
    } else {
      // Use single segment
      startTime = segment.startTime;
      endTime = nextSegment?.startTime ?? segment.startTime + 5;
      text = segment.text;
    }

    // Visual feedback - change button immediately
    const saveBtn = target.closest('.sl-btn-save') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.innerHTML = '💾';
      saveBtn.classList.add('sl-btn-saving');
      saveBtn.style.transform = 'scale(1.2)';

      setTimeout(() => {
        saveBtn.style.transform = 'scale(1)';
      }, 150);
    }

    // Show save dialog
    this.saveDialog = new SaveDialog({
      videoInfo,
      startTime,
      endTime,
      text,
      onSave: async (payload) => {
        await this.savePhrase(payload, saveBtn);
      },
      onClose: () => {
        // Reset button if dialog is closed without saving
        if (saveBtn && !saveBtn.classList.contains('sl-btn-saved')) {
          saveBtn.innerHTML = '💾';
          saveBtn.classList.remove('sl-btn-saving');
        }
        this.saveDialog?.destroy();
        this.saveDialog = null;
      },
    });

    this.saveDialog.show();
  }

  /**
   * Save phrase via background script
   */
  private async savePhrase(payload: SavePhrasePayload, saveBtn?: HTMLButtonElement): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_PHRASE',
        payload,
      });

      if (response.success) {
        showToast('✅ フレーズを保存しました');

        // Visual feedback on success
        if (saveBtn) {
          saveBtn.innerHTML = '✅';
          saveBtn.classList.remove('sl-btn-saving');
          saveBtn.classList.add('sl-btn-saved');

          // Reset after 2 seconds
          setTimeout(() => {
            saveBtn.innerHTML = '💾';
            saveBtn.classList.remove('sl-btn-saved');
          }, 2000);
        }

        // Reload saved phrases to show the new one
        await this.loadSavedPhrases();
      } else {
        showToast(`❌ 保存に失敗: ${response.error}`);

        // Reset button on error
        if (saveBtn) {
          saveBtn.innerHTML = '💾';
          saveBtn.classList.remove('sl-btn-saving');
        }
      }
    } catch (error) {
      console.error('[Subtitle Loop] Save error:', error);
      showToast('❌ 保存に失敗しました');

      // Reset button on error
      if (saveBtn) {
        saveBtn.innerHTML = '💾';
        saveBtn.classList.remove('sl-btn-saving');
      }
    }
  }

  /**
   * Check for pending loop from library and auto-set if found
   */
  async checkPendingLoop(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('pendingLoop');
      if (!result.pendingLoop) return;

      const pending = result.pendingLoop as {
        videoId: string;
        startTime: number;
        endTime: number;
        timestamp: number;
      };

      const currentVideo = getVideoInfo();

      // Check if this is the video we want to loop
      if (currentVideo && currentVideo.videoId === pending.videoId) {
        // Check if pending loop is not too old (5 minutes)
        const age = Date.now() - pending.timestamp;
        if (age < 5 * 60 * 1000) {
          console.log('[Subtitle Loop] Auto-setting loop from library:', pending);

          // Wait a bit for transcript to load if needed
          setTimeout(() => {
            // Set the loop
            this.loopController.setLoop(pending.startTime, pending.endTime);

            // If segments are loaded, re-render to show loop indicators
            if (this.segments.length > 0) {
              this.renderSegments();
            }
          }, 1000);
        }

        // Clear the pending loop
        await chrome.storage.local.remove('pendingLoop');
      }
    } catch (error) {
      console.error('[Subtitle Loop] Error checking pending loop:', error);
    }
  }

  /**
   * Switch to a saved loop
   */
  private switchToLoop(startTime: number, endTime: number): void {
    // Set the loop
    this.loopController.setLoop(startTime, endTime);

    // Seek to start time
    seekTo(startTime);

    // Re-render segments to show loop indicators
    if (this.segments.length > 0) {
      this.renderSegments();
    }

    showToast('🔁 ループを切り替えました');
  }

  /**
   * Load saved phrases for current video
   */
  async loadSavedPhrases(): Promise<void> {
    const videoInfo = getVideoInfo();
    if (!videoInfo) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PHRASES',
        payload: { videoId: videoInfo.videoId }
      });

      if (response.success && response.data.length > 0) {
        this.savedPhrases = response.data;
        this.renderSavedPhrases();
      }
    } catch (error) {
      console.error('[Subtitle Loop] Error loading saved phrases:', error);
    }
  }

  /**
   * Render saved phrases section
   */
  private renderSavedPhrases(): void {
    const savedSection = this.container?.querySelector('[data-saved-phrases]') as HTMLElement;
    const savedList = this.container?.querySelector('[data-saved-list]');
    const savedCount = this.container?.querySelector('[data-saved-count]');

    if (!savedSection || !savedList || !savedCount) return;

    if (this.savedPhrases.length === 0) {
      savedSection.style.display = 'none';
      return;
    }

    savedSection.style.display = 'block';
    savedCount.textContent = this.savedPhrases.length.toString();

    savedList.innerHTML = this.savedPhrases.map(phrase => `
      <div class="sl-saved-item" data-phrase-id="${phrase.id}" data-start="${phrase.startTime}" data-end="${phrase.endTime}">
        <div class="sl-saved-time">${formatTimestamp(phrase.startTime)} - ${formatTimestamp(phrase.endTime)}</div>
        <div class="sl-saved-text">"${this.escapeHtml(phrase.originalText.substring(0, 50))}${phrase.originalText.length > 50 ? '...' : ''}"</div>
        ${phrase.note ? `<div class="sl-saved-note">📝 ${this.escapeHtml(phrase.note)}</div>` : ''}
      </div>
    `).join('');
  }

  /**
   * Keyboard shortcut: Set loop start at current playback time
   */
  handleLoopStartShortcut(): void {
    const currentTime = getCurrentTime();
    const currentSegment = findSegmentAtTime(this.segments, currentTime);

    if (!currentSegment) {
      showToast('⚠️ 字幕セグメントが見つかりません');
      return;
    }

    this.loopController.setStart(currentSegment.startTime);
    showToast('✅ ループ開始点を設定しました');
  }

  /**
   * Keyboard shortcut: Set loop end at current playback time
   */
  handleLoopEndShortcut(): void {
    const currentTime = getCurrentTime();
    const currentSegment = findSegmentAtTime(this.segments, currentTime);

    if (!currentSegment) {
      showToast('⚠️ 字幕セグメントが見つかりません');
      return;
    }

    const state = this.loopController.getState();
    if (state.startTime === null) {
      showToast('⚠️ 先にループ開始点を設定してください');
      return;
    }

    this.loopController.setEnd(currentSegment.startTime);
    showToast('✅ ループを設定しました');
  }

  /**
   * Keyboard shortcut: Save current segment
   */
  async handleSaveShortcut(): Promise<void> {
    const currentTime = getCurrentTime();
    const currentSegment = findSegmentAtTime(this.segments, currentTime);

    if (!currentSegment) {
      showToast('⚠️ 字幕セグメントが見つかりません');
      return;
    }

    // Check if already saved
    const alreadySaved = this.savedPhrases.some(
      p => p.startTime === currentSegment.startTime
    );

    if (alreadySaved) {
      showToast('ℹ️ このセグメントは既に保存済みです');
      return;
    }

    // Get video info
    const videoInfo = getVideoInfo();
    if (!videoInfo) {
      showToast('❌ ビデオ情報を取得できませんでした');
      return;
    }

    // Find next segment for end time
    const nextSegment = this.segments[currentSegment.index + 1];
    const endTime = nextSegment?.startTime ?? currentSegment.startTime + 5;

    // Save directly without dialog (quick save)
    const payload: SavePhrasePayload = {
      videoId: videoInfo.videoId,
      videoUrl: videoInfo.videoUrl,
      videoTitle: videoInfo.title,
      startTime: currentSegment.startTime,
      endTime: endTime,
      originalText: currentSegment.text,
    };

    await this.savePhrase(payload);
  }

  /**
   * Keyboard shortcut: Clear loop
   */
  handleClearLoopShortcut(): void {
    this.loopController.clear();
    showToast('🔄 ループをクリアしました');
  }

  /**
   * Keyboard shortcut: Refresh subtitles
   */
  async handleRefreshShortcut(): Promise<void> {
    await this.loadTranscript();
    showToast('✅ 字幕を更新しました');
  }

  /**
   * Handle playback speed change
   */
  private handleSpeedChange(target: HTMLElement): void {
    const speedStr = target.dataset.speed;
    if (!speedStr) return;

    const speed = parseFloat(speedStr);
    const success = setPlaybackRate(speed);

    if (success) {
      // Update active button state
      const allSpeedButtons = this.container?.querySelectorAll('.sl-btn-speed');
      allSpeedButtons?.forEach(btn => btn.classList.remove('sl-active'));
      target.classList.add('sl-active');

      showToast(`🎵 再生速度: ${speed}x`);
    } else {
      showToast('⚠️ 再生速度の変更に失敗しました');
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
