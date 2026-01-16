import {
  savePhrase,
  getPhrases,
  updatePhrase,
  deletePhrase,
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getStats,
  checkDatabaseAvailability,
  isDatabaseReady,
  getDatabaseError,
} from '../db';
import type {
  Message,
  MessageResponse,
  SavePhrasePayload,
  GetPhrasesPayload,
} from '../types';

console.log('[Subtitle Loop] Background service worker loaded');

// Initialize database availability check
checkDatabaseAvailability().then((isAvailable) => {
  if (!isAvailable) {
    console.error('[Subtitle Loop] Database initialization failed - save features will be disabled');
  }
});

/**
 * Message handler for content scripts and popup
 */
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  console.log('[Subtitle Loop] Message received:', message.type);

  // Handle message asynchronously
  handleMessage(message)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error) => {
      console.error('[Subtitle Loop] Message handler error:', error);
      sendResponse({
        success: false,
        error: error.message || 'Unknown error',
      });
    });

  // Return true to indicate async response
  return true;
});

/**
 * Handle incoming messages
 */
async function handleMessage(message: Message): Promise<MessageResponse> {
  switch (message.type) {
    case 'DB_STATUS':
      return await handleDatabaseStatus();

    case 'SAVE_PHRASE':
      return await handleSavePhrase(message.payload as SavePhrasePayload);

    case 'GET_PHRASES':
      return await handleGetPhrases(message.payload as GetPhrasesPayload);

    case 'UPDATE_PHRASE':
      return await handleUpdatePhrase(message.payload);

    case 'DELETE_PHRASE':
      return await handleDeletePhrase(message.payload);

    case 'GET_GROUPS':
      return await handleGetGroups();

    case 'CREATE_GROUP':
      return await handleCreateGroup(message.payload);

    case 'UPDATE_GROUP':
      return await handleUpdateGroup(message.payload);

    case 'DELETE_GROUP':
      return await handleDeleteGroup(message.payload);

    case 'GET_STATS':
      return await handleGetStats();

    default:
      return {
        success: false,
        error: `Unknown message type: ${message.type}`,
      };
  }
}

// ============================================================
// MESSAGE HANDLERS
// ============================================================

async function handleDatabaseStatus(): Promise<MessageResponse> {
  return {
    success: true,
    data: {
      isAvailable: isDatabaseReady(),
      error: getDatabaseError(),
    },
  };
}

async function handleSavePhrase(
  payload: SavePhrasePayload
): Promise<MessageResponse> {
  try {
    const phrase = await savePhrase(payload);
    return {
      success: true,
      data: phrase,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save phrase',
    };
  }
}

async function handleGetPhrases(
  payload?: GetPhrasesPayload
): Promise<MessageResponse> {
  try {
    const phrases = await getPhrases(payload);
    return {
      success: true,
      data: phrases,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get phrases',
    };
  }
}

async function handleUpdatePhrase(payload: any): Promise<MessageResponse> {
  try {
    const { id, updates } = payload;
    await updatePhrase(id, updates);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update phrase',
    };
  }
}

async function handleDeletePhrase(payload: any): Promise<MessageResponse> {
  try {
    await deletePhrase(payload.id);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete phrase',
    };
  }
}

async function handleGetGroups(): Promise<MessageResponse> {
  try {
    const groups = await getGroups();
    return {
      success: true,
      data: groups,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get groups',
    };
  }
}

async function handleCreateGroup(payload: any): Promise<MessageResponse> {
  try {
    const group = await createGroup(payload);
    return {
      success: true,
      data: group,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create group',
    };
  }
}

async function handleUpdateGroup(payload: any): Promise<MessageResponse> {
  try {
    const { id, updates } = payload;
    await updateGroup(id, updates);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update group',
    };
  }
}

async function handleDeleteGroup(payload: any): Promise<MessageResponse> {
  try {
    await deleteGroup(payload.id);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete group',
    };
  }
}

async function handleGetStats(): Promise<MessageResponse> {
  try {
    const stats = await getStats();
    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    };
  }
}
