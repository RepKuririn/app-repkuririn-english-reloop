import { formatTimestamp } from '../transcript';
import type { VideoInfo, SavePhrasePayload } from '../../types';

interface SaveDialogOptions {
  videoInfo: VideoInfo;
  startTime: number;
  endTime: number;
  text: string;
  onSave: (payload: SavePhrasePayload) => Promise<void>;
  onClose: () => void;
}

export class SaveDialog {
  private overlay: HTMLElement | null = null;
  private options: SaveDialogOptions;

  constructor(options: SaveDialogOptions) {
    this.options = options;
  }

  show(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'sl-dialog-overlay';
    this.overlay.innerHTML = this.getTemplate();

    document.body.appendChild(this.overlay);
    this.bindEvents();

    // Focus note input
    const noteInput = this.overlay.querySelector('[data-note]') as HTMLTextAreaElement;
    noteInput?.focus();
  }

  destroy(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private getTemplate(): string {
    const { videoInfo, startTime, endTime, text } = this.options;

    return `
      <div class="sl-dialog">
        <div class="sl-dialog-header">
          <h3>💾 フレーズを保存</h3>
          <button class="sl-btn sl-btn-icon" data-action="close">✕</button>
        </div>

        <div class="sl-dialog-body">
          <div class="sl-dialog-info">
            <div class="sl-dialog-video">${this.escapeHtml(videoInfo.title)}</div>
            <div class="sl-dialog-time">
              ${formatTimestamp(startTime)} - ${formatTimestamp(endTime)}
            </div>
          </div>

          <div class="sl-dialog-text">
            "${this.escapeHtml(text)}"
          </div>

          <div class="sl-dialog-field">
            <label for="sl-note">メモ（任意）</label>
            <textarea
              id="sl-note"
              data-note
              rows="3"
              placeholder="このフレーズについてのメモ..."
            ></textarea>
          </div>
        </div>

        <div class="sl-dialog-footer">
          <button class="sl-btn sl-btn-secondary" data-action="close">
            キャンセル
          </button>
          <button class="sl-btn sl-btn-primary" data-action="save">
            保存
          </button>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.overlay) return;

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.options.onClose();
      }
    });

    // Button actions
    this.overlay.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');

      if (action === 'close') {
        this.options.onClose();
      } else if (action === 'save') {
        await this.handleSave();
      }
    });

    // Keyboard shortcuts
    this.overlay.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        this.options.onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        await this.handleSave();
      }
    });
  }

  private async handleSave(): Promise<void> {
    const { videoInfo, startTime, endTime, text } = this.options;
    const noteInput = this.overlay?.querySelector('[data-note]') as HTMLTextAreaElement;
    const note = noteInput?.value.trim() || undefined;

    const payload: SavePhrasePayload = {
      videoId: videoInfo.videoId,
      videoUrl: videoInfo.videoUrl,
      videoTitle: videoInfo.title,
      startTime,
      endTime,
      originalText: text,
      note,
    };

    // Disable save button
    const saveBtn = this.overlay?.querySelector('[data-action="save"]') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    try {
      await this.options.onSave(payload);
      this.options.onClose();
    } catch (error) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
