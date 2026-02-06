import type { HighlightColor, HighlightPosition, PageHighlights } from '@/utils/types';

// State
let allHighlights: Array<HighlightPosition & { url: string }> = [];
let filteredHighlights: Array<HighlightPosition & { url: string }> = [];
let currentPage = 1;
let itemsPerPage = 20;
let currentSort = { column: 'createdAt', direction: 'desc' as 'asc' | 'desc' };
let currentTagFilter = '';
let currentSearchQuery = '';
let editingHighlightId: string | null = null;
let editingHighlightUrl: string | null = null;
let editTags: string[] = [];

// DOM Elements
const tableBody = document.getElementById('highlights-table') as HTMLElement;
const paginationEl = document.getElementById('pagination') as HTMLElement;
const paginationInfo = document.getElementById('pagination-info') as HTMLElement;
const paginationControls = document.getElementById('pagination-controls') as HTMLElement;
const tagFilter = document.getElementById('tag-filter') as HTMLSelectElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const totalCountEl = document.getElementById('total-count') as HTMLElement;
const pagesCountEl = document.getElementById('pages-count') as HTMLElement;
const tagsCountEl = document.getElementById('tags-count') as HTMLElement;

// Modal Elements
const editModal = document.getElementById('edit-modal') as HTMLElement;
const editComment = document.getElementById('edit-comment') as HTMLTextAreaElement;
const editTagsContainer = document.getElementById('edit-tags-container') as HTMLDivElement;
const editTagsInput = document.getElementById('edit-tags-input') as HTMLInputElement;
const modalCancel = document.getElementById('modal-cancel') as HTMLButtonElement;
const modalSave = document.getElementById('modal-save') as HTMLButtonElement;

// Utility Functions
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname + new URL(url).pathname;
  } catch {
    return url;
  }
}

function getUniqueTags(highlights: Array<HighlightPosition & { url: string }>): string[] {
  const tags = new Set<string>();
  highlights.forEach(h => {
    h.tags?.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
}

// Sort Function
function sortHighlights(
  highlights: Array<HighlightPosition & { url: string }>,
  column: string,
  direction: 'asc' | 'desc'
): Array<HighlightPosition & { url: string }> {
  return [...highlights].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (column) {
      case 'text':
        aVal = a.text.toLowerCase();
        bVal = b.text.toLowerCase();
        break;
      case 'url':
        aVal = getHostname(a.url).toLowerCase();
        bVal = getHostname(b.url).toLowerCase();
        break;
      case 'color':
        aVal = a.color || 'yellow';
        bVal = b.color || 'yellow';
        break;
      case 'tags':
        aVal = (a.tags?.join(', ') || '').toLowerCase();
        bVal = (b.tags?.join(', ') || '').toLowerCase();
        break;
      case 'comment':
        aVal = (a.comment || '').toLowerCase();
        bVal = (b.comment || '').toLowerCase();
        break;
      case 'createdAt':
        aVal = a.createdAt;
        bVal = b.createdAt;
        break;
      default:
        aVal = a.createdAt;
        bVal = b.createdAt;
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

// Filter Function
function filterHighlights(): Array<HighlightPosition & { url: string }> {
  return allHighlights.filter(h => {
    // Tag filter
    if (currentTagFilter && (!h.tags || !h.tags.includes(currentTagFilter))) {
      return false;
    }

    // Search filter
    if (currentSearchQuery) {
      const query = currentSearchQuery.toLowerCase();
      const textMatch = h.text.toLowerCase().includes(query);
      const commentMatch = h.comment?.toLowerCase().includes(query) || false;
      const tagMatch = h.tags?.some(t => t.toLowerCase().includes(query)) || false;
      const urlMatch = getHostname(h.url).toLowerCase().includes(query);

      if (!textMatch && !commentMatch && !tagMatch && !urlMatch) {
        return false;
      }
    }

    return true;
  });
}

// Render Table
function renderTable(): void {
  // Apply filters
  filteredHighlights = filterHighlights();

  // Apply sort
  filteredHighlights = sortHighlights(
    filteredHighlights,
    currentSort.column,
    currentSort.direction
  );

  // Calculate pagination
  const totalItems = filteredHighlights.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageHighlights = filteredHighlights.slice(startIndex, endIndex);

  // Update stats
  totalCountEl.textContent = totalItems.toString();

  const uniquePages = new Set(allHighlights.map(h => h.url)).size;
  pagesCountEl.textContent = uniquePages.toString();

  const uniqueTags = getUniqueTags(allHighlights);
  tagsCountEl.textContent = uniqueTags.length.toString();

  // Render table
  if (totalItems === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p>No highlights found</p>
        </td>
      </tr>
    `;
    paginationEl.style.display = 'none';
    return;
  }

  tableBody.innerHTML = pageHighlights.map(h => `
    <tr data-highlight-id="${h.id}">
      <td class="highlight-text-cell">
        <span class="highlight-text-preview color-${h.color || 'yellow'}" title="${escapeHtml(h.text)}">
          ${escapeHtml(truncateText(h.text, 150))}
        </span>
      </td>
      <td class="url-cell">
        <a href="${h.url}" target="_blank" title="${h.url}">
          ${escapeHtml(getHostname(h.url))}
        </a>
      </td>
      <td>
        <span class="tag" style="background: ${getColorHex(h.color || 'yellow')}; color: #333;">
          ${h.color || 'yellow'}
        </span>
      </td>
      <td class="tags-cell">
        ${h.tags && h.tags.length > 0 ? `
          <div class="tags-list">
            ${h.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : '<span style="color: #999;">-</span>'}
      </td>
      <td class="comment-cell">
        ${h.comment ? escapeHtml(truncateText(h.comment, 80)) : '<span style="color: #999;">-</span>'}
      </td>
      <td class="date-cell">${formatDate(h.createdAt)}</td>
      <td class="actions-cell">
        <button class="action-btn btn-navigate" data-action="navigate" data-url="${h.url}">Open</button>
        <button class="action-btn btn-edit" data-action="edit" data-id="${h.id}" data-url="${h.url}">Edit</button>
        <button class="action-btn btn-delete" data-action="delete" data-id="${h.id}" data-url="${h.url}">Delete</button>
      </td>
    </tr>
  `).join('');

  // Add event listeners
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleAction);
  });

  // Render pagination
  renderPagination(totalPages);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getColorHex(color: string): string {
  const colors: Record<string, string> = {
    yellow: '#ffeb3b',
    red: '#ff8a80',
    green: '#b9f6ca',
    lightBlue: '#80d8ff',
    lightPurple: '#ea80fc'
  };
  return colors[color] || colors.yellow;
}

// Render Pagination
function renderPagination(totalPages: number): void {
  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = 'flex';

  const totalItems = filteredHighlights.length;
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} highlights`;

  let buttons = '';

  // Previous button
  buttons += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`;

  // Page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    buttons += `<button class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      buttons += `<span style="padding: 6px;">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    buttons += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      buttons += `<span style="padding: 6px;">...</span>`;
    }
    buttons += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next button
  buttons += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;

  paginationControls.innerHTML = buttons;

  // Items per page selector
  const itemsPerPageHtml = `
    <div class="items-per-page">
      <span>Show:</span>
      <select id="items-per-page">
        <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
        <option value="20" ${itemsPerPage === 20 ? 'selected' : ''}>20</option>
        <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
        <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
      </select>
    </div>
  `;
  paginationControls.insertAdjacentHTML('beforeend', itemsPerPageHtml);

  // Event listeners
  paginationControls.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt((btn as HTMLElement).dataset.page || '1');
      if (page >= 1 && page <= Math.ceil(filteredHighlights.length / itemsPerPage)) {
        currentPage = page;
        renderTable();
      }
    });
  });

  const itemsPerPageSelect = document.getElementById('items-per-page') as HTMLSelectElement;
  itemsPerPageSelect?.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value);
    currentPage = 1;
    renderTable();
  });
}

// Handle Actions
function handleAction(event: Event): void {
  const target = event.target as HTMLElement;
  const action = target.dataset.action;
  const id = target.dataset.id;
  const url = target.dataset.url;

  if (!action || !id || !url) return;

  switch (action) {
    case 'navigate':
      chrome.tabs.create({ url });
      break;
    case 'edit':
      openEditModal(id, url);
      break;
    case 'delete':
      deleteHighlight(id, url);
      break;
  }
}

// Load Data
async function loadHighlights(): Promise<void> {
  tableBody.innerHTML = `
    <tr>
      <td colspan="7" class="loading">Loading highlights...</td>
    </tr>
  `;

  try {
    const pages = await new Promise<PageHighlights[]>((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getAllHighlights' },
        (response) => resolve(response || [])
      );
    });

    allHighlights = pages.flatMap(p =>
      p.highlights.map(h => ({ ...h, url: p.url }))
    );

    // Update tag filter dropdown
    updateTagFilter();

    // Initial render
    renderTable();
  } catch (error) {
    console.error('Error loading highlights:', error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">❌</div>
          <p>Error loading highlights</p>
        </td>
      </tr>
    `;
  }
}

// Update Tag Filter
function updateTagFilter(): void {
  const tags = getUniqueTags(allHighlights);
  const currentValue = tagFilter.value;

  tagFilter.innerHTML = '<option value="">All Tags</option>' +
    tags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');

  if (tags.includes(currentValue)) {
    tagFilter.value = currentValue;
  }
}

// Edit Modal
function openEditModal(id: string, url: string): Promise<void> {
  editingHighlightId = id;
  editingHighlightUrl = url;

  const highlight = allHighlights.find(h => h.id === id);
  if (!highlight) return Promise.resolve();

  editComment.value = highlight.comment || '';
  editTags = [...(highlight.tags || [])];
  renderEditTags();

  editModal.classList.add('active');
  setTimeout(() => editComment.focus(), 100);

  return Promise.resolve();
}

function closeEditModal(): void {
  editModal.classList.remove('active');
  editingHighlightId = null;
  editingHighlightUrl = null;
  editTags = [];
}

function renderEditTags(): void {
  const input = editTagsInput;
  editTagsContainer.innerHTML = '';

  editTags.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'modal-tag';
    tagEl.innerHTML = `${escapeHtml(tag)}
      <button class="modal-tag-remove" data-tag="${escapeHtml(tag)}">×</button>
    `;
    editTagsContainer.appendChild(tagEl);
  });

  editTagsContainer.appendChild(input);
  input.focus();
}

async function saveEdit(): Promise<void> {
  if (!editingHighlightId || !editingHighlightUrl) return;

  const updates = {
    comment: editComment.value.trim(),
    tags: editTags
  };

  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: 'updateHighlightData',
        url: editingHighlightUrl,
        highlightId: editingHighlightId,
        updates
      },
      () => resolve()
    );
  });

  closeEditModal();
  await loadHighlights();
}

async function deleteHighlight(id: string, url: string): Promise<void> {
  const confirmed = confirm('Are you sure you want to delete this highlight?');
  if (!confirmed) return;

  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'removeHighlightData', url, highlightId: id },
      () => resolve()
    );
  });

  await loadHighlights();
}

// Event Listeners
tagFilter.addEventListener('change', () => {
  currentTagFilter = tagFilter.value;
  currentPage = 1;
  renderTable();
});

searchInput.addEventListener('input', () => {
  currentSearchQuery = searchInput.value;
  currentPage = 1;
  renderTable();
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    currentSearchQuery = '';
    renderTable();
  }
});

refreshBtn.addEventListener('click', () => {
  loadHighlights();
});

// Sort headers
document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const column = (th as HTMLElement).dataset.sort || 'createdAt';

    if (currentSort.column === column) {
      currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort.column = column;
      currentSort.direction = 'desc';
    }

    // Update header classes
    document.querySelectorAll('th').forEach(h => {
      h.classList.remove('sorted-asc', 'sorted-desc');
    });
    th.classList.add(`sorted-${currentSort.direction}`);

    renderTable();
  });
});

// Modal events
modalCancel.addEventListener('click', closeEditModal);
modalSave.addEventListener('click', saveEdit);

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
});

editTagsInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const tag = editTagsInput.value.trim();
    if (tag && !editTags.includes(tag)) {
      editTags.push(tag);
      renderEditTags();
    }
    editTagsInput.value = '';
  } else if (e.key === 'Backspace' && editTagsInput.value === '' && editTags.length > 0) {
    editTags.pop();
    renderEditTags();
  }
});

editTagsContainer.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('modal-tag-remove')) {
    const tag = target.dataset.tag;
    editTags = editTags.filter(t => t !== tag);
    renderEditTags();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editModal.classList.contains('active')) {
    closeEditModal();
  }
  if (e.key === 'Enter' && e.ctrlKey && editModal.classList.contains('active')) {
    saveEdit();
  }
});

// Initialize
loadHighlights();

// Listen for storage changes
chrome.storage.onChanged.addListener(() => {
  loadHighlights();
});

// Listen for highlights-updated event
window.addEventListener('highlights-updated', () => {
  loadHighlights();
});
