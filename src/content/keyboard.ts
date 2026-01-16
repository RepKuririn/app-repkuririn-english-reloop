import { KEYBOARD_SHORTCUTS } from './constants';

/**
 * Keyboard shortcut handler configuration
 */
interface ShortcutHandlers {
  setLoopStart: () => void;
  setLoopEnd: () => void;
  saveSegment: () => void;
  clearLoop: () => void;
  refreshSubtitles: () => void;
}

/**
 * Keyboard shortcut manager
 * Handles global keyboard shortcuts for the extension
 */
export class KeyboardHandler {
  private handlers: ShortcutHandlers;
  private isEnabled = true;

  constructor(handlers: ShortcutHandlers) {
    this.handlers = handlers;
    this.bindEvents();
  }

  /**
   * Enable keyboard shortcuts
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable keyboard shortcuts (e.g., when input is focused)
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  /**
   * Bind keyboard event listeners
   */
  private bindEvents(): void {
    document.addEventListener('keydown', this.handleKeydown);
  }

  /**
   * Handle keydown events
   */
  private handleKeydown = (event: KeyboardEvent): void => {
    // Skip if disabled
    if (!this.isEnabled) {
      return;
    }

    // Skip if user is typing in an input field
    const target = event.target as HTMLElement;
    if (this.isInputElement(target)) {
      return;
    }

    // Check each shortcut
    for (const [action, shortcut] of Object.entries(KEYBOARD_SHORTCUTS)) {
      if (this.matchesShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();

        // Execute the corresponding handler
        const handler = this.handlers[action as keyof ShortcutHandlers];
        if (handler) {
          handler();
          console.log(`[Subtitle Loop] Keyboard shortcut triggered: ${action}`);
        }
        break;
      }
    }
  };

  /**
   * Check if the event matches a shortcut definition
   */
  private matchesShortcut(
    event: KeyboardEvent,
    shortcut: { key: string; alt: boolean; ctrl: boolean; shift: boolean }
  ): boolean {
    return (
      event.key.toLowerCase() === shortcut.key.toLowerCase() &&
      event.altKey === shortcut.alt &&
      event.ctrlKey === shortcut.ctrl &&
      event.shiftKey === shortcut.shift
    );
  }

  /**
   * Check if the target element is an input element where we should not capture shortcuts
   */
  private isInputElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    const isEditable = element.isContentEditable;

    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      isEditable ||
      element.hasAttribute('contenteditable')
    );
  }
}
