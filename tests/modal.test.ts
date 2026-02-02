import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showHighlightModal, removeModal, injectModalStyles } from '../utils/modal';

describe('modal utils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    removeModal();
  });

  describe('injectModalStyles', () => {
    it('should inject modal styles only once', () => {
      injectModalStyles();
      const style1 = document.getElementById('text-highlighter-modal-styles');
      expect(style1).not.toBeNull();

      injectModalStyles();
      const styles = document.querySelectorAll('#text-highlighter-modal-styles');
      expect(styles).toHaveLength(1);
    });

    it('should inject styles into document head', () => {
      injectModalStyles();
      const style = document.getElementById('text-highlighter-modal-styles');
      expect(style?.parentElement).toBe(document.head);
    });
  });

  describe('showHighlightModal', () => {
    it('should create modal overlay and modal elements', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      showHighlightModal('test text', onSave, onCancel);

      const overlay = document.getElementById('text-highlighter-modal-overlay');
      const modal = document.getElementById('text-highlighter-modal');

      expect(overlay).not.toBeNull();
      expect(modal).not.toBeNull();
    });

    it('should display selected text in modal', () => {
      const selectedText = 'This is a test highlight';
      const onSave = vi.fn();
      const onCancel = vi.fn();

      showHighlightModal(selectedText, onSave, onCancel);

      const textDisplay = document.querySelector('.text-highlighter-modal-text-display');
      expect(textDisplay?.textContent).toBe(selectedText);
    });

    it('should escape HTML in selected text', () => {
      const selectedText = '<script>alert("xss")</script>';
      const onSave = vi.fn();
      const onCancel = vi.fn();

      showHighlightModal(selectedText, onSave, onCancel);

      const textDisplay = document.querySelector('.text-highlighter-modal-text-display');
      expect(textDisplay?.innerHTML).not.toContain('<script>');
      expect(textDisplay?.textContent).toBe(selectedText);
    });

    it('should call onCancel when cancel button is clicked', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      showHighlightModal('test', onSave, onCancel);

      const cancelBtn = document.querySelector('.text-highlighter-modal-button-cancel') as HTMLButtonElement;
      cancelBtn?.click();

      expect(onCancel).toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('should call onSave with metadata when save button is clicked', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      showHighlightModal('test', onSave, onCancel);

      const commentTextarea = document.querySelector('#highlight-comment') as HTMLTextAreaElement;
      commentTextarea.value = 'Test comment';

      const saveBtn = document.querySelector('.text-highlighter-modal-button-save') as HTMLButtonElement;
      saveBtn?.click();

      expect(onSave).toHaveBeenCalledWith({
        comment: 'Test comment',
        tags: [],
        color: 'yellow',
      });
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('should allow color selection', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      showHighlightModal('test', onSave, onCancel);

      const redOption = document.querySelector('[data-color="red"]') as HTMLElement;
      redOption?.click();

      const saveBtn = document.querySelector('.text-highlighter-modal-button-save') as HTMLButtonElement;
      saveBtn?.click();

      expect(onSave).toHaveBeenCalledWith({
        comment: '',
        tags: [],
        color: 'red',
      });
    });

    it('should add tags when Enter is pressed', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      showHighlightModal('test', onSave, onCancel);

      const tagsInput = document.querySelector('#highlight-tags') as HTMLInputElement;
      tagsInput.value = 'tag1';

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      tagsInput.dispatchEvent(event);

      tagsInput.value = 'tag2';
      tagsInput.dispatchEvent(event);

      const saveBtn = document.querySelector('.text-highlighter-modal-button-save') as HTMLButtonElement;
      saveBtn?.click();

      expect(onSave).toHaveBeenCalledWith({
        comment: '',
        tags: ['tag1', 'tag2'],
        color: 'yellow',
      });
    });

    it('should remove any existing modal before showing new one', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      showHighlightModal('test 1', onSave, onCancel);
      showHighlightModal('test 2', onSave, onCancel);

      const overlays = document.querySelectorAll('#text-highlighter-modal-overlay');
      expect(overlays).toHaveLength(1);
    });
  });

  describe('removeModal', () => {
    it('should remove modal from DOM', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      showHighlightModal('test', onSave, onCancel);
      expect(document.getElementById('text-highlighter-modal-overlay')).not.toBeNull();

      removeModal();
      expect(document.getElementById('text-highlighter-modal-overlay')).toBeNull();
    });

    it('should handle removing non-existent modal gracefully', () => {
      expect(() => removeModal()).not.toThrow();
    });
  });
});
