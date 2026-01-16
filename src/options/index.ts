import type { Phrase, Group } from '../types';
import { GROUP_COLORS } from '../content/constants';

console.log('[Subtitle Loop] Options page loaded');

// State
let groups: Group[] = [];
let phrases: Phrase[] = [];
let selectedGroupId: string | null = null;
let selectedPhrase: Phrase | null = null;
let editingGroupId: string | null = null;
let selectedPhraseIds: Set<string> = new Set();

// DOM Elements
const groupList = document.getElementById('group-list')!;
const phraseList = document.getElementById('phrase-list')!;
const currentGroupName = document.getElementById('current-group-name')!;
const phraseCount = document.getElementById('phrase-count')!;
const addGroupBtn = document.getElementById('add-group')!;
const groupModal = document.getElementById('group-modal')!;
const groupForm = document.getElementById('group-form') as HTMLFormElement;
const groupModalTitle = document.getElementById('group-modal-title')!;
const phraseModal = document.getElementById('phrase-modal')!;
const phraseDetail = document.getElementById('phrase-detail')!;
const colorPicker = document.getElementById('color-picker')!;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initColorPicker();
  setupEventListeners();
  await loadData();
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadData(): Promise<void> {
  await Promise.all([loadGroups(), loadPhrases()]);
  renderGroups();
  renderPhrases();
}

async function loadGroups(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_GROUPS' });
  if (response.success) {
    groups = response.data;
  }
}

async function loadPhrases(): Promise<void> {
  const payload = selectedGroupId !== null
    ? { groupId: selectedGroupId }
    : undefined;

  const response = await chrome.runtime.sendMessage({
    type: 'GET_PHRASES',
    payload
  });

  if (response.success) {
    phrases = response.data;
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderGroups(): void {
  groupList.innerHTML = `
    <button class="group-item ${selectedGroupId === null ? 'active' : ''}"
            data-group-id="">
      <span class="group-color" style="background: #888"></span>
      <span class="group-name">すべて</span>
    </button>
    ${groups.map(group => `
      <button class="group-item ${selectedGroupId === group.id ? 'active' : ''}"
              data-group-id="${group.id}">
        <span class="group-color" style="background: ${group.color}"></span>
        <span class="group-name">${escapeHtml(group.name)}</span>
        <button class="btn btn-icon btn-small group-edit"
                data-action="edit-group"
                data-group-id="${group.id}"
                title="編集">
          ✏️
        </button>
      </button>
    `).join('')}
  `;
}

function renderPhrases(): void {
  // Render bulk toolbar if any phrases are selected
  const mainHeader = document.querySelector('.main-header')!;
  if (selectedPhraseIds.size > 0) {
    let bulkToolbar = document.getElementById('bulk-toolbar');
    if (!bulkToolbar) {
      bulkToolbar = document.createElement('div');
      bulkToolbar.id = 'bulk-toolbar';
      bulkToolbar.className = 'bulk-toolbar';
      mainHeader.after(bulkToolbar);
    }
    bulkToolbar.innerHTML = `
      <div class="bulk-toolbar-left">
        <span class="bulk-count">${selectedPhraseIds.size}件選択中</span>
      </div>
      <div class="bulk-toolbar-right">
        <button class="btn" id="bulk-assign-group">グループに追加</button>
        <button class="btn" id="bulk-clear">選択解除</button>
      </div>
    `;
  } else {
    document.getElementById('bulk-toolbar')?.remove();
  }

  if (phrases.length === 0) {
    phraseList.innerHTML = `
      <div class="empty-state">
        <p>まだフレーズが保存されていません</p>
        <p class="hint">YouTubeで動画を見ながら💾ボタンで保存</p>
      </div>
    `;
    phraseCount.textContent = '';
    return;
  }

  phraseCount.textContent = `(${phrases.length}件)`;

  phraseList.innerHTML = phrases.map(phrase => {
    const isSelected = selectedPhraseIds.has(phrase.id);
    return `
      <div class="phrase-card ${isSelected ? 'selected' : ''}" data-phrase-id="${phrase.id}">
        <div class="phrase-checkbox">
          <input type="checkbox"
                 data-phrase-checkbox
                 data-phrase-id="${phrase.id}"
                 ${isSelected ? 'checked' : ''}>
        </div>
        <div class="phrase-content">
          <div class="phrase-video">${escapeHtml(phrase.videoTitle)}</div>
          <div class="phrase-text">"${escapeHtml(phrase.originalText)}"</div>
          <div class="phrase-meta">
            <span class="phrase-time">
              ${formatTimestamp(phrase.startTime)} - ${formatTimestamp(phrase.endTime)}
            </span>
            ${phrase.note ? `<span class="phrase-note">📝 ${escapeHtml(phrase.note)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function initColorPicker(): void {
  colorPicker.innerHTML = GROUP_COLORS.map((color, i) => `
    <label class="color-option">
      <input type="radio" name="color" value="${color}" ${i === 0 ? 'checked' : ''}>
      <span class="color-swatch" style="background: ${color}"></span>
    </label>
  `).join('');
}

// ============================================================
// EVENT HANDLERS
// ============================================================

function setupEventListeners(): void {
  // Group selection
  groupList.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;

    // Edit group button
    if (target.closest('[data-action="edit-group"]')) {
      e.stopPropagation();
      const groupId = target.closest('[data-group-id]')?.getAttribute('data-group-id');
      if (groupId) openEditGroupModal(groupId);
      return;
    }

    // Group selection
    const groupItem = target.closest('[data-group-id]') as HTMLElement;
    if (groupItem) {
      const groupId = groupItem.dataset.groupId || null;
      await selectGroup(groupId === '' ? null : groupId);
    }
  });

  // Add group button
  addGroupBtn.addEventListener('click', openCreateGroupModal);

  // Group form submit
  groupForm.addEventListener('submit', handleGroupFormSubmit);

  // Modal close buttons
  document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', closeGroupModal);
  });

  document.querySelectorAll('[data-action="close-phrase-modal"]').forEach(btn => {
    btn.addEventListener('click', closePhraseModal);
  });

  // Phrase checkbox toggle
  phraseList.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.hasAttribute('data-phrase-checkbox')) {
      const checkbox = target as HTMLInputElement;
      const phraseId = checkbox.dataset.phraseId;
      if (phraseId) {
        if (checkbox.checked) {
          selectedPhraseIds.add(phraseId);
        } else {
          selectedPhraseIds.delete(phraseId);
        }
        renderPhrases();
        setupBulkActions();
      }
    }
  });

  // Phrase card click (but not checkbox)
  phraseList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Ignore clicks on checkbox
    if (target.hasAttribute('data-phrase-checkbox') || target.closest('.phrase-checkbox')) {
      return;
    }

    const card = target.closest('.phrase-card') as HTMLElement;
    if (card) {
      const phraseId = card.dataset.phraseId;
      if (phraseId) openPhraseModal(phraseId);
    }
  });

  // Phrase modal actions
  document.getElementById('play-phrase')?.addEventListener('click', playSelectedPhrase);
  document.getElementById('delete-phrase')?.addEventListener('click', deleteSelectedPhrase);

  // Click outside modal to close
  groupModal.addEventListener('click', (e) => {
    if (e.target === groupModal) closeGroupModal();
  });

  phraseModal.addEventListener('click', (e) => {
    if (e.target === phraseModal) closePhraseModal();
  });
}

async function selectGroup(groupId: string | null): Promise<void> {
  selectedGroupId = groupId;
  selectedPhraseIds.clear(); // Clear selection when switching groups

  if (groupId === null) {
    currentGroupName.textContent = 'すべてのフレーズ';
  } else {
    const group = groups.find(g => g.id === groupId);
    currentGroupName.textContent = group?.name || 'グループ';
  }

  await loadPhrases();
  renderGroups();
  renderPhrases();
}

function setupBulkActions(): void {
  document.getElementById('bulk-clear')?.addEventListener('click', () => {
    selectedPhraseIds.clear();
    renderPhrases();
  });

  document.getElementById('bulk-assign-group')?.addEventListener('click', async () => {
    // Show modal to select group
    const selectedGroup = await showGroupSelectionModal();
    if (selectedGroup !== undefined) {
      // Assign all selected phrases to the group
      for (const phraseId of selectedPhraseIds) {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_PHRASE',
          payload: { id: phraseId, updates: { groupId: selectedGroup } }
        });
      }
      selectedPhraseIds.clear();
      await loadPhrases();
      renderPhrases();
    }
  });
}

async function showGroupSelectionModal(): Promise<string | null | undefined> {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>グループを選択</h3>
          <button class="btn btn-icon" data-action="close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>グループ</label>
            <select id="bulk-group-select">
              <option value="">なし</option>
              ${groups.map(g => `
                <option value="${g.id}">${escapeHtml(g.name)}</option>
              `).join('')}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="close">キャンセル</button>
          <button class="btn btn-primary" data-action="confirm">適用</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');

      if (action === 'close' || target === modal) {
        modal.remove();
        resolve(undefined);
      } else if (action === 'confirm') {
        const select = document.getElementById('bulk-group-select') as HTMLSelectElement;
        const groupId = select.value || null;
        modal.remove();
        resolve(groupId);
      }
    });
  });
}

// ============================================================
// GROUP MODAL
// ============================================================

function openCreateGroupModal(): void {
  editingGroupId = null;
  groupModalTitle.textContent = 'グループを作成';
  groupForm.reset();
  groupModal.hidden = false;
}

function openEditGroupModal(groupId: string): void {
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  editingGroupId = groupId;
  groupModalTitle.textContent = 'グループを編集';

  (document.getElementById('group-name') as HTMLInputElement).value = group.name;
  (document.getElementById('group-description') as HTMLTextAreaElement).value = group.description || '';

  // Select color
  const colorRadio = colorPicker.querySelector(`input[value="${group.color}"]`) as HTMLInputElement;
  if (colorRadio) colorRadio.checked = true;

  groupModal.hidden = false;
}

function closeGroupModal(): void {
  groupModal.hidden = true;
  editingGroupId = null;
  groupForm.reset();
}

async function handleGroupFormSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const name = (document.getElementById('group-name') as HTMLInputElement).value.trim();
  const description = (document.getElementById('group-description') as HTMLTextAreaElement).value.trim();
  const colorRadio = colorPicker.querySelector('input:checked') as HTMLInputElement;
  const color = colorRadio?.value || GROUP_COLORS[0];

  if (!name) return;

  if (editingGroupId) {
    // Update
    await chrome.runtime.sendMessage({
      type: 'UPDATE_GROUP',
      payload: { id: editingGroupId, updates: { name, description, color } }
    });
  } else {
    // Create
    await chrome.runtime.sendMessage({
      type: 'CREATE_GROUP',
      payload: { name, description, color }
    });
  }

  closeGroupModal();
  await loadGroups();
  renderGroups();
}

// ============================================================
// PHRASE MODAL
// ============================================================

function openPhraseModal(phraseId: string): void {
  selectedPhrase = phrases.find(p => p.id === phraseId) || null;
  if (!selectedPhrase) return;

  phraseDetail.innerHTML = `
    <div class="detail-section">
      <h4>動画</h4>
      <p>${escapeHtml(selectedPhrase.videoTitle)}</p>
    </div>

    <div class="detail-section">
      <h4>フレーズ</h4>
      <p class="detail-text">"${escapeHtml(selectedPhrase.originalText)}"</p>
    </div>

    <div class="detail-section">
      <h4>時間</h4>
      <p>${formatTimestamp(selectedPhrase.startTime)} - ${formatTimestamp(selectedPhrase.endTime)}</p>
    </div>

    ${selectedPhrase.note ? `
      <div class="detail-section">
        <h4>メモ</h4>
        <p>${escapeHtml(selectedPhrase.note)}</p>
      </div>
    ` : ''}

    <div class="detail-section">
      <h4>グループ</h4>
      <select id="phrase-group-select">
        <option value="">なし</option>
        ${groups.map(g => `
          <option value="${g.id}" ${g.id === selectedPhrase!.groupId ? 'selected' : ''}>
            ${escapeHtml(g.name)}
          </option>
        `).join('')}
      </select>
    </div>
  `;

  // Group change handler
  const select = document.getElementById('phrase-group-select') as HTMLSelectElement;
  select.addEventListener('change', async () => {
    const groupId = select.value || null;
    await chrome.runtime.sendMessage({
      type: 'UPDATE_PHRASE',
      payload: { id: selectedPhrase!.id, updates: { groupId } }
    });
    await loadPhrases();
    renderPhrases();
  });

  phraseModal.hidden = false;
}

function closePhraseModal(): void {
  phraseModal.hidden = true;
  selectedPhrase = null;
}

async function playSelectedPhrase(): Promise<void> {
  if (!selectedPhrase) return;

  // Store pending loop info for content script to pick up
  await chrome.storage.local.set({
    pendingLoop: {
      videoId: selectedPhrase.videoId,
      startTime: selectedPhrase.startTime,
      endTime: selectedPhrase.endTime,
      timestamp: Date.now()
    }
  });

  // Open YouTube at the timestamp
  const url = new URL(selectedPhrase.videoUrl);
  url.searchParams.set('t', Math.floor(selectedPhrase.startTime).toString());

  chrome.tabs.create({ url: url.toString() });
  closePhraseModal();
}

async function deleteSelectedPhrase(): Promise<void> {
  if (!selectedPhrase) return;

  if (!confirm('このフレーズを削除しますか？')) return;

  await chrome.runtime.sendMessage({
    type: 'DELETE_PHRASE',
    payload: { id: selectedPhrase.id }
  });

  closePhraseModal();
  await loadPhrases();
  renderPhrases();
}

// ============================================================
// UTILITIES
// ============================================================

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
