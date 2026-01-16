// ============================================================
// RUNTIME TYPES (not persisted)
// ============================================================

/**
 * A single subtitle segment parsed from YouTube's transcript panel
 */
export interface TranscriptSegment {
  /** Position in the transcript list (0-indexed) */
  index: number;
  /** Start time in seconds */
  startTime: number;
  /** Subtitle text content */
  text: string;
  /** Reference to DOM element for highlighting */
  element: HTMLElement;
}

/**
 * Current loop state
 */
export interface LoopState {
  isActive: boolean;
  startTime: number | null;
  endTime: number | null;
}

/**
 * Video metadata extracted from page
 */
export interface VideoInfo {
  videoId: string;
  videoUrl: string;
  title: string;
}

// ============================================================
// PERSISTED TYPES (stored in IndexedDB)
// ============================================================

/**
 * A saved phrase/segment for later review
 */
export interface Phrase {
  /** UUID v4 */
  id: string;
  /** YouTube video ID (from ?v= parameter) */
  videoId: string;
  /** Full YouTube URL */
  videoUrl: string;
  /** Video title at time of saving */
  videoTitle: string;
  /** Loop/segment start time in seconds */
  startTime: number;
  /** Loop/segment end time in seconds */
  endTime: number;
  /** Original subtitle text */
  originalText: string;
  /** Optional translated text */
  translatedText?: string;
  /** User's note/memo */
  note?: string;
  /** Group ID (null = ungrouped) */
  groupId: string | null;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * A group for organizing phrases
 */
export interface Group {
  /** UUID v4 */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Display color (hex, e.g., "#ff5722") */
  color: string;
  /** Sort order (lower = first) */
  order: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

// ============================================================
// MESSAGE TYPES (content <-> background communication)
// ============================================================

export type MessageType =
  | 'SAVE_PHRASE'
  | 'GET_PHRASES'
  | 'DELETE_PHRASE'
  | 'UPDATE_PHRASE'
  | 'GET_GROUPS'
  | 'CREATE_GROUP'
  | 'UPDATE_GROUP'
  | 'DELETE_GROUP'
  | 'GET_STATS'
  | 'DB_STATUS';

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Specific message payloads
export interface SavePhrasePayload {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText?: string;
  note?: string;
  groupId?: string;
}

export interface GetPhrasesPayload {
  groupId?: string | null;  // null = all, undefined = ungrouped only
  videoId?: string;
  limit?: number;
  offset?: number;
}

export interface StatsData {
  totalPhrases: number;
  totalGroups: number;
  phrasesByGroup: Record<string, number>;
}
