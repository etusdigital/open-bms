import type { Node, Edge } from '@xyflow/react';

// ---------------------------------------------------------------------------
// Step types
// ---------------------------------------------------------------------------

/** All message channel types */
export type MessageChannelType = 'email' | 'webPush' | 'mobilePush' | 'sms' | 'whatsapp';

/** All random message variant types */
export type RandomMessageType = 'randomMessage' | 'randomWebPush' | 'randomMobilePush';

/** All contact action types */
export type ContactStepType =
  | 'addTag'
  | 'removeTag'
  | 'updateCustomField'
  | 'contactTransfer'
  | 'removeAutomation';

/** Integration types */
export type IntegrationStepType = 'httpRequest';

/** Condition/branching types */
export type ConditionStepType =
  | 'split'
  | 'splitPath'
  | 'conditional'
  | 'conditionalTrue'
  | 'conditionalFalse'
  | 'conditionalTime';

export type AutomationStepType =
  | 'trigger'
  | 'wait'
  | MessageChannelType
  | 'testAB'
  | RandomMessageType
  | ContactStepType
  | ConditionStepType
  | IntegrationStepType
  | 'end';

// ---------------------------------------------------------------------------
// Step settings (match API payload exactly)
// ---------------------------------------------------------------------------

export interface TriggerSettings {
  id?: number;
  type?: 'tag' | 'events' | 'web-push' | 'mobile-push';
  name?: string;
  applyFrequency?: 'unique' | 'multiply' | 'multiply-period';
  timePeriod?: number;
  typeMultiply?: 'days' | 'hours' | 'minutes' | '';
  eventType?: 'open' | 'click' | 'first_open_30_days';
  title?: string;
  conditional?: ConditionalRule[];
}

export interface WaitSettings {
  timer: number;
  timerType: 'hours' | 'minutes';
}

/** Shared settings shape for all single-message channel steps */
export interface MessageSettings {
  id?: number;
  name?: string;
  title?: string;
  subject?: string;
  links?: Array<{ url: string; id: string }>;
}

export interface TestABMessage {
  id: number;
  name: string;
  title: string;
  subject?: string;
  fromMail?: string;
  winnerMessage?: boolean;
  statistics?: Record<string, number>;
}

export interface TestABSettings {
  messages: TestABMessage[];
  winnerCriteria: 'click' | 'open';
  status: 'notStarted' | 'running' | 'finished';
  duration: number;
  durationType: 'day' | 'hour';
  startDate?: string | null;
  endDate?: string | null;
  taskId?: string;
}

/** Shared settings shape for all random-message steps */
export interface RandomMessageSettings {
  messages: Array<{
    id: number;
    name: string;
    title: string;
    subject?: string;
    fromMail?: string;
  }>;
}

/** Settings for addTag / removeTag — can be array or legacy single object */
export type TagStepSettings = Array<{ id: number; name: string }>;

export interface UpdateCustomFieldSettings {
  customFieldValue: string;
  customFieldSelected: { id: number; title: string; type: string };
}

export interface ContactTransferSettings {
  accountId: number;
  accountName: string;
  tagId: number;
  tagName: string;
  apiKey: string;
}

export interface RemoveAutomationSettings {
  automations: Array<{ id: number; name: string; title: string }>;
}

/** Settings for split node: percentage map keyed by path number "1"-"5" */
export interface SplitSettings {
  [key: string]: number;
}

/** Settings for splitPath node */
export interface SplitPathSettings {
  path: string; // "1" through "5"
  value: number; // percentage
}

/** Settings for conditionalTime node */
export interface ConditionalTimeSettings {
  initialTime: number | string; // 0-23
  endTime: number | string; // 0-23
}

export interface HttpKeyValueItem {
  key: string;
  value: {
    id: string;
    description: string;
    type: 'custom' | 'replace';
  };
}

export interface HttpRequestSettings {
  operation: 'get' | 'post' | 'put' | 'delete';
  url: string;
  headers: HttpKeyValueItem[];
  body: HttpKeyValueItem[];
  queryString?: string;
  newTry: boolean;
  quantityTry: number;
}

export type EmptySettings = Record<string, never>;

export interface ConditionalRule {
  type: string;
  conditional?: 'and' | 'or';
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Discriminated union: step type correlates with settings
// ---------------------------------------------------------------------------

interface StepBase<T extends string, S> {
  id: number;
  type: T;
  settings: S;
  child: ApiStep[];
}

export type TriggerStep = StepBase<'trigger', TriggerSettings>;
export type WaitStep = StepBase<'wait', WaitSettings>;
export type EmailStep = StepBase<'email', MessageSettings>;
export type WebPushStep = StepBase<'webPush', MessageSettings>;
export type MobilePushStep = StepBase<'mobilePush', MessageSettings>;
export type SmsStep = StepBase<'sms', MessageSettings>;
export type WhatsappStep = StepBase<'whatsapp', MessageSettings>;
export type TestABStep = StepBase<'testAB', TestABSettings>;
export type RandomMessageStep = StepBase<'randomMessage', RandomMessageSettings>;
export type RandomWebPushStep = StepBase<'randomWebPush', RandomMessageSettings>;
export type RandomMobilePushStep = StepBase<'randomMobilePush', RandomMessageSettings>;
export type AddTagStep = StepBase<'addTag', TagStepSettings>;
export type RemoveTagStep = StepBase<'removeTag', TagStepSettings>;
export type UpdateCustomFieldStep = StepBase<'updateCustomField', UpdateCustomFieldSettings>;
export type ContactTransferStep = StepBase<'contactTransfer', ContactTransferSettings>;
export type RemoveAutomationStep = StepBase<'removeAutomation', RemoveAutomationSettings>;
export type SplitStep = StepBase<'split', SplitSettings>;
export type SplitPathStep = StepBase<'splitPath', SplitPathSettings>;
export type ConditionalStep = StepBase<'conditional', ConditionalRule[]>;
export type ConditionalTrueStep = StepBase<'conditionalTrue', ConditionalRule[]>;
export type ConditionalFalseStep = StepBase<'conditionalFalse', EmptySettings>;
export type ConditionalTimeStep = StepBase<'conditionalTime', ConditionalTimeSettings>;
export type HttpRequestStep = StepBase<'httpRequest', HttpRequestSettings>;
export type EndStep = StepBase<'end', EmptySettings>;

export type AutomationStep =
  | TriggerStep
  | WaitStep
  | EmailStep
  | WebPushStep
  | MobilePushStep
  | SmsStep
  | WhatsappStep
  | TestABStep
  | RandomMessageStep
  | RandomWebPushStep
  | RandomMobilePushStep
  | AddTagStep
  | RemoveTagStep
  | UpdateCustomFieldStep
  | ContactTransferStep
  | RemoveAutomationStep
  | SplitStep
  | SplitPathStep
  | ConditionalStep
  | ConditionalTrueStep
  | ConditionalFalseStep
  | ConditionalTimeStep
  | HttpRequestStep
  | EndStep;

/** Handles step types not yet supported by the React editor (from Vue 2) */
export interface UnsupportedStep {
  id: number;
  type: string;
  settings: Record<string, unknown>;
  child: ApiStep[];
}

/** Any step from the API — known or unknown */
export type ApiStep = AutomationStep | UnsupportedStep;

// ---------------------------------------------------------------------------
// Automation payload (matches API POST/PUT /automations/complete)
// ---------------------------------------------------------------------------

export interface AutomationPayload {
  id?: number;
  title: string;
  description?: string;
  type?: string;
  isActive: boolean;
  isRateLimit: boolean;
  stepId: number;
  steps: ApiStep;
  verticalType?: string;
  target?: string;
  labels?: Array<{ id: number; name: string }>;
  flowLayout?: FlowLayout | null;
  /** ISO timestamp of the loaded automation; sent on update so the API can reject stale writes */
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Flow layout (persisted in DB for visual state)
// ---------------------------------------------------------------------------

export interface FlowLayout {
  nodes: Array<{ id: string; position: { x: number; y: number } }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
  viewport?: { x: number; y: number; zoom: number };
}

// ---------------------------------------------------------------------------
// Editor handle (exposed to parent via ref)
// ---------------------------------------------------------------------------

export interface AutomationEditorHandle {
  getState: () => {
    nodes: AutomationNode[];
    edges: AutomationEdge[];
    stepIdCounter: number;
    viewport?: { x: number; y: number; zoom: number };
  };
  /** Highlight a step with an error border and zoom to it */
  highlightError: (stepId: number | string) => void;
  /** Clear the error highlight */
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// React Flow node data
// ---------------------------------------------------------------------------

/** Base interface to satisfy xyflow's Record<string, unknown> constraint */
interface NodeDataBase {
  [key: string]: unknown;
}

export interface TriggerNodeData extends NodeDataBase {
  stepId: number;
  settings: TriggerSettings;
}
export interface WaitNodeData extends NodeDataBase {
  stepId: number;
  settings: WaitSettings;
}
export interface MessageNodeData extends NodeDataBase {
  stepId: number;
  settings: MessageSettings;
}
export interface TestABNodeData extends NodeDataBase {
  stepId: number;
  settings: TestABSettings;
}
export interface RandomMessageNodeData extends NodeDataBase {
  stepId: number;
  settings: RandomMessageSettings;
}
export interface TagNodeData extends NodeDataBase {
  stepId: number;
  settings: TagStepSettings;
}
export interface UpdateCustomFieldNodeData extends NodeDataBase {
  stepId: number;
  settings: UpdateCustomFieldSettings;
}
export interface ContactTransferNodeData extends NodeDataBase {
  stepId: number;
  settings: ContactTransferSettings;
}
export interface RemoveAutomationNodeData extends NodeDataBase {
  stepId: number;
  settings: RemoveAutomationSettings;
}
export interface SplitNodeData extends NodeDataBase {
  stepId: number;
  settings: SplitSettings;
}
export interface SplitPathNodeData extends NodeDataBase {
  stepId: number | string;
  settings: SplitPathSettings;
}
export interface ConditionalNodeData extends NodeDataBase {
  stepId: number;
  settings: ConditionalRule[];
}
export interface ConditionalBranchNodeData extends NodeDataBase {
  stepId: number | string;
  settings: ConditionalRule[] | EmptySettings;
}
export interface ConditionalTimeNodeData extends NodeDataBase {
  stepId: number;
  settings: ConditionalTimeSettings;
}
export interface HttpRequestNodeData extends NodeDataBase {
  stepId: number;
  settings: HttpRequestSettings;
}
export interface EndNodeData extends NodeDataBase {
  stepId: number;
  settings: EmptySettings;
}

export type AutomationNodeData =
  | TriggerNodeData
  | WaitNodeData
  | MessageNodeData
  | TestABNodeData
  | RandomMessageNodeData
  | TagNodeData
  | UpdateCustomFieldNodeData
  | ContactTransferNodeData
  | RemoveAutomationNodeData
  | SplitNodeData
  | SplitPathNodeData
  | ConditionalNodeData
  | ConditionalBranchNodeData
  | ConditionalTimeNodeData
  | HttpRequestNodeData
  | EndNodeData;

/** Fallback data for steps the React editor doesn't support yet */
export interface UnsupportedNodeData extends NodeDataBase {
  stepId: number;
  originalType: string;
  settings: Record<string, unknown>;
}

export type AnyNodeData = AutomationNodeData | UnsupportedNodeData;

// ---------------------------------------------------------------------------
// Typed React Flow primitives
// ---------------------------------------------------------------------------

export type AutomationNode = Node<AnyNodeData>;
export type AutomationEdge = Edge;

// ---------------------------------------------------------------------------
// Serializer result
// ---------------------------------------------------------------------------

export type SerializeResult = { success: true; root: ApiStep } | { success: false; error: string };

export interface DeserializeResult {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  maxStepId: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NODE_SPACING = 150;
export const NODE_WIDTH = 240;

/** Step types known to the React editor */
export const KNOWN_STEP_TYPES = new Set<string>([
  'trigger',
  'wait',
  'email',
  'webPush',
  'mobilePush',
  'sms',
  'whatsapp',
  'testAB',
  'randomMessage',
  'randomWebPush',
  'randomMobilePush',
  'addTag',
  'removeTag',
  'updateCustomField',
  'contactTransfer',
  'removeAutomation',
  'split',
  'splitPath',
  'conditional',
  'conditionalTrue',
  'conditionalFalse',
  'conditionalTime',
  'httpRequest',
  'end',
] satisfies AutomationStepType[]);

/** Step types that branch into multiple paths (need per-handle connection logic) */
export const BRANCHING_STEP_TYPES = new Set(['split', 'conditional']);

/** Step types that are sub-nodes of branching steps (cannot be deleted individually) */
export const SUB_NODE_TYPES = new Set(['splitPath', 'conditionalTrue', 'conditionalFalse']);

/** Maps step type → API message type param for fetching messages */
export const MESSAGE_TYPE_MAP: Record<string, string> = {
  email: 'email',
  webPush: 'web-push',
  mobilePush: 'mobile-push',
  sms: 'sms',
  whatsapp: 'whatsapp',
  randomMessage: 'email',
  randomWebPush: 'web-push',
  randomMobilePush: 'mobile-push',
};

/** Maps step type → AccountChannels key for permission check */
export const CHANNEL_FLAG_MAP: Record<string, string> = {
  email: 'email',
  webPush: 'webPush',
  mobilePush: 'mobilePush',
  sms: 'sms',
  whatsapp: 'whatsapp',
  testAB: 'email',
  randomMessage: 'email',
  randomWebPush: 'webPush',
  randomMobilePush: 'mobilePush',
};
