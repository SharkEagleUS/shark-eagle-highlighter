// Centralized type definitions for highlight functionality

export type HighlightColor = 'yellow' | 'red' | 'green' | 'lightBlue' | 'lightPurple';

export interface HighlightPosition {
  text: string;
  xpath: string;
  startOffset: number;
  endOffset: number;
  beforeContext: string;
  afterContext: string;
  id: string;
  createdAt: number;
  comment?: string;
  tags?: string[];
  color?: HighlightColor;
}

export interface PageHighlights {
  url: string;
  highlights: HighlightPosition[];
}
