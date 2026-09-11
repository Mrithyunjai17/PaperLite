export type Tool = "select" | "pen" | "highlight" | "text" | "eraser";

export interface Point {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  page: number;
  rotation: number;
  color: string;
  opacity: number;
}

export interface InkAnnotation extends BaseAnnotation {
  type: "ink";
  points: Point[];
  width: number;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  start: Point;
  end: Point;
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  point: Point;
  text: string;
  size: number;
}

export type Annotation = InkAnnotation | HighlightAnnotation | TextAnnotation;

export interface ToolSettings {
  color: string;
  width: number;
  opacity: number;
  textSize: number;
}

export interface PageLayout {
  width: number;
  height: number;
  rotation: number;
}

export interface SearchResult {
  page: number;
  index: number;
  snippet: string;
}
