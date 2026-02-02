// Share modal component for sharing highlights via email

const MODAL_ID = 'text-highlighter-share-modal';
const MODAL_OVERLAY_ID = 'text-highlighter-share-modal-overlay';

export interface ShareModalResult {
  email: string;
  expiresInDays: number | null;
}

export function injectShareModalStyles(): void {
  if (document.getElementById('text-highlighter-share-modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'text-highlighter-share-modal-styles';
  style.textContent = `
    .${MODAL_OVERLAY_ID} {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    .${MODAL_ID} {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      width: 90%;
      max-width: 450px;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .${MODAL_ID}-header {
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .${MODAL_ID}-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .${MODAL_ID}-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #666;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .${MODAL_ID}-close:hover {
      background-color: #f0f0f0;
    }

    .${MODAL_ID}-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .${MODAL_ID}-highlight-preview {
      background-color: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 13px;
      line-height: 1.6;
      color: #666;
      max-height: 100px;
      overflow-y: auto;
      border-left: 3px solid #2196f3;
    }

    .${MODAL_ID}-form-group {
      margin-bottom: 20px;
    }

    .${MODAL_ID}-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }

    .${MODAL_ID}-input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
      box-sizing: border-box;
    }

    .${MODAL_ID}-input:focus {
      outline: none;
      border-color: #2196f3;
      box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }

    .${MODAL_ID}-select {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
      box-sizing: border-box;
      background-color: white;
      cursor: pointer;
    }

    .${MODAL_ID}-select:focus {
      outline: none;
      border-color: #2196f3;
      box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }

    .${MODAL_ID}-hint {
      font-size: 12px;
      color: #666;
      margin-top: 6px;
    }

    .${MODAL_ID}-footer {
      padding: 16px 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .${MODAL_ID}-button {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .${MODAL_ID}-button-cancel {
      background-color: #f5f5f5;
      color: #333;
    }

    .${MODAL_ID}-button-cancel:hover {
      background-color: #e0e0e0;
    }

    .${MODAL_ID}-button-share {
      background-color: #2196f3;
      color: white;
    }

    .${MODAL_ID}-button-share:hover {
      background-color: #1976d2;
    }

    .${MODAL_ID}-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .${MODAL_ID}-icon {
      margin-right: 6px;
    }
  `;
  document.head.appendChild(style);
}

export function showShareModal(
  highlightText: string,
  onShare: (result: ShareModalResult) => void,
  onCancel: () => void
): void {
  // Inject styles if not already present
  injectShareModalStyles();

  // Remove any existing modal
  removeShareModal();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = MODAL_OVERLAY_ID;
  overlay.id = MODAL_OVERLAY_ID;

  // Create modal
  const modal = document.createElement('div');
  modal.className = MODAL_ID;
  modal.id = MODAL_ID;

  // Truncate highlight text for preview
  const truncatedText = highlightText.length > 150
    ? highlightText.substring(0, 150) + '...'
    : highlightText;

  // Create modal HTML
  modal.innerHTML = `
    <div class="${MODAL_ID}-header">
      <h3 class="${MODAL_ID}-title">📧 Share Highlight</h3>
      <button class="${MODAL_ID}-close" type="button" aria-label="Close">&times;</button>
    </div>
    <div class="${MODAL_ID}-body">
      <div class="${MODAL_ID}-highlight-preview">${escapeHtml(truncatedText)}</div>

      <div class="${MODAL_ID}-form-group">
        <label class="${MODAL_ID}-label" for="share-email">Recipient Email</label>
        <input
          id="share-email"
          class="${MODAL_ID}-input"
          type="email"
          required
          placeholder="friend@example.com"
          autocomplete="email"
        />
        <div class="${MODAL_ID}-hint">Enter the email address of the person you want to share with</div>
      </div>

      <div class="${MODAL_ID}-form-group">
        <label class="${MODAL_ID}-label" for="share-expiry">Link Expiration</label>
        <select id="share-expiry" class="${MODAL_ID}-select">
          <option value="never">Never expires</option>
          <option value="7" selected>7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
        <div class="${MODAL_ID}-hint">Choose when the share link should expire</div>
      </div>
    </div>
    <div class="${MODAL_ID}-footer">
      <button class="${MODAL_ID}-button ${MODAL_ID}-button-cancel" type="button">Cancel</button>
      <button class="${MODAL_ID}-button ${MODAL_ID}-button-share" type="button">
        <span class="${MODAL_ID}-icon">📤</span>Share
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Get elements
  const closeBtn = modal.querySelector(`.${MODAL_ID}-close`) as HTMLButtonElement;
  const cancelBtn = modal.querySelector(`.${MODAL_ID}-button-cancel`) as HTMLButtonElement;
  const shareBtn = modal.querySelector(`.${MODAL_ID}-button-share`) as HTMLButtonElement;
  const emailInput = modal.querySelector('#share-email') as HTMLInputElement;
  const expirySelect = modal.querySelector('#share-expiry') as HTMLSelectElement;

  function handleShare(): void {
    const email = emailInput.value.trim();

    if (!email) {
      emailInput.focus();
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      emailInput.focus();
      return;
    }

    const expiryValue = expirySelect.value;
    const expiresInDays = expiryValue === 'never' ? null : parseInt(expiryValue, 10);

    onShare({ email, expiresInDays });
    removeShareModal();
  }

  function handleCancel(): void {
    onCancel();
    removeShareModal();
  }

  // Event listeners
  closeBtn.addEventListener('click', handleCancel);
  cancelBtn.addEventListener('click', handleCancel);
  shareBtn.addEventListener('click', handleShare);

  // Enter key to share
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleShare();
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      handleCancel();
    }
  });

  // Close on Escape key
  const escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Focus email input
  setTimeout(() => emailInput.focus(), 100);
}

export function removeShareModal(): void {
  const overlay = document.getElementById(MODAL_OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
