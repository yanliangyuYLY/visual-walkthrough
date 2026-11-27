// Author: a

export type Tone = "good" | "warn" | "bad" | "info" | "neutral";
export type CalloutTone = "good" | "info" | "warn" | "bad";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type RiskLevel = "low" | "medium" | "high";

export interface StepItem {
  number?: number;
  title: string;
  description: string;
  fileRef?: string;
  fileUri?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface CodeBlock {
  title: string;
  fileRef?: string;
  fileUri?: string;
  language?: string;
  startLine?: number;
  code: string;
  defaultOpen?: boolean;
}

export interface MermaidNodeDetail {
  title?: string;
  summary: string;
  stepNumber?: number;
  fileRef?: string;
  fileUri?: string;
  lineStart?: number;
}

export type CellValue =
  | string
  | { badge: string; tone?: Tone }
  | { code: string }
  | { fileRef: string; fileUri?: string };

export type ButtonAction =
  | { type: "send"; text: string }
  | { type: "queue"; text: string; label?: string }
  | { type: "copy"; text: string }
  | { type: "open_file"; fileUri: string };

export interface ActionButton {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  action: ButtonAction;
}

export interface MetricItem {
  label: string;
  value: string;
  delta?: string;
  tone?: Tone;
}

export interface FindingItem {
  id?: string;
  severity: Severity;
  title: string;
  fileRef?: string;
  fileUri?: string;
  line?: number;
  rule?: string;
  detail?: string;
  fix?: string;
  fixIsDiff?: boolean;
  defaultSelected?: boolean;
}

export interface PlanStepItem {
  id?: string;
  title: string;
  detail?: string;
  files?: Array<{ fileRef: string; fileUri?: string }>;
  risk?: RiskLevel;
  estimate?: string;
  optional?: boolean;
  defaultChecked?: boolean;
}

export interface DecisionCriterion {
  name: string;
  weight?: number;
  note?: string;
}

export interface DecisionOption {
  name: string;
  scores: number[];
  pros?: string[];
  cons?: string[];
  note?: string;
  recommended?: boolean;
  actionText?: string;
}

export interface TableBlock {
  type: "table";
  columns: string[];
  rows: CellValue[][];
  commentable?: boolean;
}

export interface CalloutBlock {
  type: "callout";
  title?: string;
  text: string;
  tone?: CalloutTone;
}

export interface MermaidBlock {
  type: "mermaid";
  code: string;
  nodeDetails?: Record<string, MermaidNodeDetail>;
}

export interface StepsBlock {
  type: "steps";
  items: StepItem[];
  commentable?: boolean;
}

export interface CodeUiBlock extends CodeBlock {
  type: "code";
}

export interface TextBlock {
  type: "text";
  content: string;
}

export interface ActionsBlock {
  type: "actions";
  buttons: ActionButton[];
}

export interface MetricsBlock {
  type: "metrics";
  items: MetricItem[];
}

export interface DiffBlock {
  type: "diff";
  title?: string;
  fileRef?: string;
  fileUri?: string;
  patch: string;
  defaultOpen?: boolean;
}

export interface FindingsBlock {
  type: "findings";
  title?: string;
  items: FindingItem[];
  commentable?: boolean;
  selectable?: boolean;
  submitLabel?: string;
}

export interface PlanBlock {
  type: "plan";
  title?: string;
  steps: PlanStepItem[];
  commentable?: boolean;
  submitLabel?: string;
}

export interface DecisionBlock {
  type: "decision";
  criteria: DecisionCriterion[];
  options: DecisionOption[];
  submitLabel?: string;
}

export type LeafUiBlock =
  | TableBlock
  | CalloutBlock
  | MermaidBlock
  | StepsBlock
  | CodeUiBlock
  | TextBlock
  | ActionsBlock
  | MetricsBlock
  | DiffBlock
  | FindingsBlock
  | PlanBlock
  | DecisionBlock;

export interface TabPane {
  id: string;
  label: string;
  badge?: string;
  blocks: LeafUiBlock[];
}

export interface TabsBlock {
  type: "tabs";
  defaultTab?: string;
  tabs: TabPane[];
}

export type UiBlock = LeafUiBlock | TabsBlock;

export interface HistorySummary {
  cardId: string;
  kind: "walkthrough" | "ui_card";
  title: string;
  subtitle?: string;
  createdAt: number;
}

export interface CardDraft {
  cardId: string;
  updatedAt: number;
  queued: Array<{ key: string; label: string; text: string }>;
  comments: Record<string, { label: string; text: string }>;
  customNote: string;
}

export interface NormalizedWalkthrough {
  [key: string]: unknown;
  kind: "walkthrough";
  cardId: string;
  createdAt: number;
  title: string;
  subtitle?: string;
  mermaid?: string;
  nodeDetails?: Record<string, MermaidNodeDetail>;
  steps: Array<StepItem & { number: number }>;
  codeBlocks: Array<CodeBlock & { startLine: number; defaultOpen: boolean }>;
  notes: string[];
  commentable?: boolean;
  allowCustomInput?: boolean;
  truncated?: boolean;
  surfaceHint?: "inline" | "aux_pane";
  history?: HistorySummary[];
  draft?: CardDraft;
}

export interface NormalizedUiCard {
  [key: string]: unknown;
  kind: "ui_card";
  cardId: string;
  createdAt: number;
  title: string;
  subtitle?: string;
  blocks: UiBlock[];
  commentable?: boolean;
  allowCustomInput?: boolean;
  truncated?: boolean;
  surfaceHint?: "inline" | "aux_pane";
  history?: HistorySummary[];
  draft?: CardDraft;
}

export type StoredPayload = NormalizedWalkthrough | NormalizedUiCard;

export interface GalleryEntry {
  id: string;
  label: string;
  description: string;
  payload: StoredPayload;
}
