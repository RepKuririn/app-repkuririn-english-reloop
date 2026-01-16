import Dexie, { type Table } from 'dexie';
import type { Phrase, Group } from '../types';

/**
 * Subtitle Loop Database
 * IndexedDB wrapper using Dexie.js
 */
export class SubtitleLoopDB extends Dexie {
  phrases!: Table<Phrase, string>;
  groups!: Table<Group, string>;

  constructor() {
    super('SubtitleLoopDB');

    // Define schema
    this.version(1).stores({
      phrases: 'id, videoId, groupId, createdAt, startTime',
      groups: 'id, order, createdAt',
    });
  }
}

// Global database instance
export const db = new SubtitleLoopDB();

// Track if database is available
let isDatabaseAvailable = true;
let databaseError: string | null = null;

/**
 * Check if IndexedDB is available and working
 */
export async function checkDatabaseAvailability(): Promise<boolean> {
  try {
    // Try to open and perform a simple operation
    await db.open();
    await db.phrases.count(); // Simple read to verify access
    isDatabaseAvailable = true;
    databaseError = null;
    console.log('[Subtitle Loop] IndexedDB is available');
    return true;
  } catch (error) {
    isDatabaseAvailable = false;
    databaseError = error instanceof Error ? error.message : 'IndexedDB is not available';
    console.error('[Subtitle Loop] IndexedDB unavailable:', error);
    return false;
  }
}

/**
 * Get database availability status
 */
export function isDatabaseReady(): boolean {
  return isDatabaseAvailable;
}

/**
 * Get database error message if any
 */
export function getDatabaseError(): string | null {
  return databaseError;
}

/**
 * Generate UUID v4
 */
function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================
// PHRASE OPERATIONS
// ============================================================

/**
 * Save a new phrase
 */
export async function savePhrase(data: {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText?: string;
  note?: string;
  groupId?: string;
}): Promise<Phrase> {
  if (!isDatabaseAvailable) {
    throw new Error('Database is not available. Save features are disabled.');
  }

  const now = new Date();

  const phrase: Phrase = {
    id: generateId(),
    videoId: data.videoId,
    videoUrl: data.videoUrl,
    videoTitle: data.videoTitle,
    startTime: data.startTime,
    endTime: data.endTime,
    originalText: data.originalText,
    translatedText: data.translatedText,
    note: data.note,
    groupId: data.groupId || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.phrases.add(phrase);
  console.log('[Subtitle Loop] Phrase saved:', phrase.id);

  return phrase;
}

/**
 * Get all phrases (with optional filters)
 */
export async function getPhrases(filters?: {
  groupId?: string | null;
  videoId?: string;
  limit?: number;
  offset?: number;
}): Promise<Phrase[]> {
  let query = db.phrases.toCollection();

  // Apply filters
  if (filters?.groupId !== undefined) {
    if (filters.groupId === null) {
      // Get all phrases
      query = db.phrases.toCollection();
    } else {
      // Get phrases in specific group
      query = db.phrases.where('groupId').equals(filters.groupId);
    }
  }

  if (filters?.videoId) {
    query = db.phrases.where('videoId').equals(filters.videoId);
  }

  // Sort by creation date (newest first)
  const phrases = await query.reverse().sortBy('createdAt');

  // Apply pagination
  if (filters?.offset) {
    phrases.splice(0, filters.offset);
  }
  if (filters?.limit) {
    phrases.splice(filters.limit);
  }

  return phrases;
}

/**
 * Update an existing phrase
 */
export async function updatePhrase(
  id: string,
  updates: Partial<Omit<Phrase, 'id' | 'createdAt'>>
): Promise<void> {
  await db.phrases.update(id, {
    ...updates,
    updatedAt: new Date(),
  });

  console.log('[SubtitleLoop DB] Phrase updated:', id);
}

/**
 * Delete a phrase
 */
export async function deletePhrase(id: string): Promise<void> {
  await db.phrases.delete(id);
  console.log('[SubtitleLoop DB] Phrase deleted:', id);
}

// ============================================================
// GROUP OPERATIONS
// ============================================================

/**
 * Create a new group
 */
export async function createGroup(data: {
  name: string;
  description?: string;
  color: string;
}): Promise<Group> {
  const now = new Date();

  // Get next order value
  const lastGroup = await db.groups.orderBy('order').last();
  const order = lastGroup ? lastGroup.order + 1 : 0;

  const group: Group = {
    id: generateId(),
    name: data.name,
    description: data.description,
    color: data.color,
    order,
    createdAt: now,
    updatedAt: now,
  };

  await db.groups.add(group);
  console.log('[SubtitleLoop DB] Group created:', group.id);

  return group;
}

/**
 * Get all groups (sorted by order)
 */
export async function getGroups(): Promise<Group[]> {
  return await db.groups.orderBy('order').toArray();
}

/**
 * Update a group
 */
export async function updateGroup(
  id: string,
  updates: Partial<Omit<Group, 'id' | 'createdAt'>>
): Promise<void> {
  await db.groups.update(id, {
    ...updates,
    updatedAt: new Date(),
  });

  console.log('[SubtitleLoop DB] Group updated:', id);
}

/**
 * Delete a group and ungroup its phrases
 */
export async function deleteGroup(id: string): Promise<void> {
  // First, ungroup all phrases in this group
  const phrasesInGroup = await db.phrases.where('groupId').equals(id).toArray();

  await db.transaction('rw', db.phrases, db.groups, async () => {
    // Ungroup phrases
    for (const phrase of phrasesInGroup) {
      await db.phrases.update(phrase.id, { groupId: null });
    }

    // Delete group
    await db.groups.delete(id);
  });

  console.log('[SubtitleLoop DB] Group deleted:', id);
}

// ============================================================
// STATISTICS
// ============================================================

/**
 * Get database statistics
 */
export async function getStats(): Promise<{
  totalPhrases: number;
  totalGroups: number;
  phrasesByGroup: Record<string, number>;
}> {
  const totalPhrases = await db.phrases.count();
  const totalGroups = await db.groups.count();

  const phrases = await db.phrases.toArray();
  const phrasesByGroup: Record<string, number> = {};

  for (const phrase of phrases) {
    const groupId = phrase.groupId || 'ungrouped';
    phrasesByGroup[groupId] = (phrasesByGroup[groupId] || 0) + 1;
  }

  return {
    totalPhrases,
    totalGroups,
    phrasesByGroup,
  };
}
