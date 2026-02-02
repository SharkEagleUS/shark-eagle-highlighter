import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateId,
  normalizeUrl,
  getStorageKey,
  saveHighlights,
  loadHighlights,
  addHighlight,
  removeHighlight,
  getAllHighlights,
} from '../utils/storage';
import type { HighlightPosition } from '../utils/types';

describe('storage utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateId', () => {
    it('should generate unique IDs with correct format', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toMatch(/^hl_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^hl_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('normalizeUrl', () => {
    it('should normalize URL by removing hash and trailing slash', () => {
      expect(normalizeUrl('https://example.com/path/#hash')).toBe(
        'https://example.com/path'
      );
      expect(normalizeUrl('https://example.com/path/')).toBe(
        'https://example.com/path'
      );
      expect(normalizeUrl('https://example.com/path?query=1')).toBe(
        'https://example.com/path?query=1'
      );
    });

    it('should handle invalid URLs gracefully', () => {
      const invalid = 'not-a-valid-url';
      expect(normalizeUrl(invalid)).toBe(invalid);
    });

    it('should preserve search params', () => {
      const url = 'https://example.com/path?foo=bar&baz=qux';
      expect(normalizeUrl(url)).toBe(url);
    });
  });

  describe('getStorageKey', () => {
    it('should create storage key with prefix', () => {
      const url = 'https://example.com/path';
      const key = getStorageKey(url);
      expect(key).toBe('highlights_https://example.com/path');
    });

    it('should normalize URL in storage key', () => {
      const url = 'https://example.com/path/#hash';
      const key = getStorageKey(url);
      expect(key).toBe('highlights_https://example.com/path');
    });
  });

  describe('saveHighlights', () => {
    it('should save highlights to chrome storage', async () => {
      const url = 'https://example.com';
      const highlights: HighlightPosition[] = [
        {
          id: 'hl1',
          text: 'test',
          xpath: '//div',
          startOffset: 0,
          endOffset: 4,
          beforeContext: '',
          afterContext: '',
          createdAt: Date.now(),
        },
      ];

      const mockSet = vi.fn().mockResolvedValue(undefined);
      global.chrome.storage.local.set = mockSet;

      await saveHighlights(url, highlights);

      expect(mockSet).toHaveBeenCalledWith({
        'highlights_https://example.com': {
          url: 'https://example.com',
          highlights,
        },
      });
    });
  });

  describe('loadHighlights', () => {
    it('should load highlights from chrome storage', async () => {
      const url = 'https://example.com';
      const highlights: HighlightPosition[] = [
        {
          id: 'hl1',
          text: 'test',
          xpath: '//div',
          startOffset: 0,
          endOffset: 4,
          beforeContext: '',
          afterContext: '',
          createdAt: Date.now(),
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        'highlights_https://example.com': {
          url: 'https://example.com',
          highlights,
        },
      });
      global.chrome.storage.local.get = mockGet;

      const result = await loadHighlights(url);

      expect(mockGet).toHaveBeenCalledWith('highlights_https://example.com');
      expect(result).toEqual(highlights);
    });

    it('should return empty array when no highlights exist', async () => {
      const mockGet = vi.fn().mockResolvedValue({});
      global.chrome.storage.local.get = mockGet;

      const result = await loadHighlights('https://example.com');

      expect(result).toEqual([]);
    });
  });

  describe('addHighlight', () => {
    it('should add highlight to existing highlights', async () => {
      const url = 'https://example.com';
      const existing: HighlightPosition[] = [
        {
          id: 'hl1',
          text: 'existing',
          xpath: '//div',
          startOffset: 0,
          endOffset: 8,
          beforeContext: '',
          afterContext: '',
          createdAt: Date.now(),
        },
      ];
      const newHighlight: HighlightPosition = {
        id: 'hl2',
        text: 'new',
        xpath: '//span',
        startOffset: 0,
        endOffset: 3,
        beforeContext: '',
        afterContext: '',
        createdAt: Date.now(),
      };

      const mockGet = vi.fn().mockResolvedValue({
        'highlights_https://example.com': {
          url: 'https://example.com',
          // Return a copy to avoid mutation issues
          highlights: [...existing],
        },
      });
      const mockSet = vi.fn().mockResolvedValue(undefined);
      global.chrome.storage.local.get = mockGet;
      global.chrome.storage.local.set = mockSet;

      await addHighlight(url, newHighlight);

      expect(mockSet).toHaveBeenCalledWith({
        'highlights_https://example.com': {
          url: 'https://example.com',
          highlights: [...existing, newHighlight],
        },
      });
    });
  });

  describe('removeHighlight', () => {
    it('should remove highlight by ID', async () => {
      const url = 'https://example.com';
      const highlights: HighlightPosition[] = [
        {
          id: 'hl1',
          text: 'keep',
          xpath: '//div',
          startOffset: 0,
          endOffset: 4,
          beforeContext: '',
          afterContext: '',
          createdAt: Date.now(),
        },
        {
          id: 'hl2',
          text: 'remove',
          xpath: '//span',
          startOffset: 0,
          endOffset: 6,
          beforeContext: '',
          afterContext: '',
          createdAt: Date.now(),
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        'highlights_https://example.com': {
          url: 'https://example.com',
          highlights,
        },
      });
      const mockSet = vi.fn().mockResolvedValue(undefined);
      global.chrome.storage.local.get = mockGet;
      global.chrome.storage.local.set = mockSet;

      await removeHighlight(url, 'hl2');

      expect(mockSet).toHaveBeenCalledWith({
        'highlights_https://example.com': {
          url: 'https://example.com',
          highlights: [highlights[0]],
        },
      });
    });
  });

  describe('getAllHighlights', () => {
    it('should return all highlights across all pages', async () => {
      const mockData = {
        'highlights_https://example.com': {
          url: 'https://example.com',
          highlights: [
            {
              id: 'hl1',
              text: 'test1',
              xpath: '//div',
              startOffset: 0,
              endOffset: 5,
              beforeContext: '',
              afterContext: '',
              createdAt: Date.now(),
            },
          ],
        },
        'highlights_https://another.com': {
          url: 'https://another.com',
          highlights: [
            {
              id: 'hl2',
              text: 'test2',
              xpath: '//span',
              startOffset: 0,
              endOffset: 5,
              beforeContext: '',
              afterContext: '',
              createdAt: Date.now(),
            },
          ],
        },
        'some_other_key': 'should be ignored',
      };

      const mockGet = vi.fn().mockResolvedValue(mockData);
      global.chrome.storage.local.get = mockGet;

      const result = await getAllHighlights();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(mockData['highlights_https://example.com']);
      expect(result).toContainEqual(mockData['highlights_https://another.com']);
    });
  });
});
