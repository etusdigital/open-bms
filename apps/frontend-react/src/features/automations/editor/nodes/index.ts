import type { NodeTypes } from '@xyflow/react';
import { Mail, Bell, Smartphone, MessageSquare, Phone, Shuffle } from 'lucide-react';
import { TriggerNode } from './trigger-node';
import { WaitNode } from './wait-node';
import { createMessageNode } from './message-node';
import { TestABNode } from './testab-node';
import { createRandomMessageNode } from './random-message-node';
import {
  AddTagNode,
  RemoveTagNode,
  UpdateCustomFieldNode,
  ContactValidateNode,
  ContactTransferNode,
  RemoveAutomationNode,
} from './contact-nodes';
import { HttpRequestNode } from './http-request-node';
import {
  SplitNode,
  SplitPathNode,
  ConditionalNode,
  ConditionalTrueNode,
  ConditionalFalseNode,
  ConditionalTimeNode,
} from './condition-nodes';
import { EndNode } from './end-node';
import { UnsupportedNode } from './unsupported-node';

// ---------------------------------------------------------------------------
// Single-message channel nodes
// ---------------------------------------------------------------------------

const EmailNode = createMessageNode({
  labelKey: 'automations.editor.email',
  channelKey: 'email',
  icon: Mail,
  borderColor: 'border-green-300',
  iconBg: 'bg-green-100',
  iconColor: 'text-green-600',
  handleColor: '!bg-green-400',
});

const WebPushNode = createMessageNode({
  labelKey: 'automations.editor.channels.webPush',
  channelKey: 'webPush',
  icon: Bell,
  borderColor: 'border-indigo-300',
  iconBg: 'bg-indigo-100',
  iconColor: 'text-indigo-600',
  handleColor: '!bg-indigo-400',
});

const MobilePushNode = createMessageNode({
  labelKey: 'automations.editor.channels.mobilePush',
  channelKey: 'mobilePush',
  icon: Smartphone,
  borderColor: 'border-pink-300',
  iconBg: 'bg-pink-100',
  iconColor: 'text-pink-600',
  handleColor: '!bg-pink-400',
});

const SmsNode = createMessageNode({
  labelKey: 'automations.editor.channels.sms',
  icon: MessageSquare,
  borderColor: 'border-cyan-300',
  iconBg: 'bg-cyan-100',
  iconColor: 'text-cyan-600',
  handleColor: '!bg-cyan-400',
});

const WhatsappNode = createMessageNode({
  labelKey: 'automations.editor.channels.whatsapp',
  icon: Phone,
  borderColor: 'border-emerald-300',
  iconBg: 'bg-emerald-100',
  iconColor: 'text-emerald-600',
  handleColor: '!bg-emerald-400',
});

// ---------------------------------------------------------------------------
// Random (multiple) message channel nodes
// ---------------------------------------------------------------------------

const RandomMessageNode = createRandomMessageNode({
  labelKey: 'automations.editor.randomMessage.title',
  countKey: 'automations.editor.randomMessage.count',
  noMessagesKey: 'automations.editor.randomMessage.noMessages',
  icon: Shuffle,
  borderColor: 'border-teal-300',
  iconBg: 'bg-teal-100',
  iconColor: 'text-teal-600',
  handleColor: '!bg-teal-400',
});

const RandomWebPushNode = createRandomMessageNode({
  labelKey: 'automations.editor.randomWebPush.title',
  countKey: 'automations.editor.randomWebPush.count',
  noMessagesKey: 'automations.editor.randomWebPush.noMessages',
  icon: Shuffle,
  borderColor: 'border-indigo-300',
  iconBg: 'bg-indigo-100',
  iconColor: 'text-indigo-600',
  handleColor: '!bg-indigo-400',
});

const RandomMobilePushNode = createRandomMessageNode({
  labelKey: 'automations.editor.randomMobilePush.title',
  countKey: 'automations.editor.randomMobilePush.count',
  noMessagesKey: 'automations.editor.randomMobilePush.noMessages',
  icon: Shuffle,
  borderColor: 'border-pink-300',
  iconBg: 'bg-pink-100',
  iconColor: 'text-pink-600',
  handleColor: '!bg-pink-400',
});

// ---------------------------------------------------------------------------
// Registry — MUST be at module level (outside any component)
// ---------------------------------------------------------------------------

export const automationNodeTypes = {
  trigger: TriggerNode,
  wait: WaitNode,
  email: EmailNode,
  webPush: WebPushNode,
  mobilePush: MobilePushNode,
  sms: SmsNode,
  whatsapp: WhatsappNode,
  testAB: TestABNode,
  randomMessage: RandomMessageNode,
  randomWebPush: RandomWebPushNode,
  randomMobilePush: RandomMobilePushNode,
  addTag: AddTagNode,
  removeTag: RemoveTagNode,
  updateCustomField: UpdateCustomFieldNode,
  contactValidate: ContactValidateNode,
  contactTransfer: ContactTransferNode,
  removeAutomation: RemoveAutomationNode,
  split: SplitNode,
  splitPath: SplitPathNode,
  conditional: ConditionalNode,
  conditionalTrue: ConditionalTrueNode,
  conditionalFalse: ConditionalFalseNode,
  conditionalTime: ConditionalTimeNode,
  httpRequest: HttpRequestNode,
  end: EndNode,
  unsupported: UnsupportedNode,
} as const satisfies NodeTypes;
