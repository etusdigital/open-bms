import { describe, it, expect } from 'vitest';
import { collectMessageIds } from '../editor/collect-message-ids';
import type { AutomationNode } from '../editor/types';

function makeNode(type: string, settings: Record<string, unknown>): AutomationNode {
  return {
    id: `node-${Math.random()}`,
    type,
    position: { x: 0, y: 0 },
    data: { stepId: 1, settings },
  } as AutomationNode;
}

describe('collectMessageIds', () => {
  it('returns empty arrays for empty node list', () => {
    const result = collectMessageIds([]);
    expect(result).toEqual({ emailIds: [], webPushIds: [], mobilePushIds: [] });
  });

  it('collects email message IDs', () => {
    const nodes = [makeNode('email', { id: 100 })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([100]);
    expect(result.webPushIds).toEqual([]);
    expect(result.mobilePushIds).toEqual([]);
  });

  it('collects webPush message IDs', () => {
    const nodes = [makeNode('webPush', { id: 200 })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([]);
    expect(result.webPushIds).toEqual([200]);
    expect(result.mobilePushIds).toEqual([]);
  });

  it('collects mobilePush message IDs', () => {
    const nodes = [makeNode('mobilePush', { id: 300 })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([]);
    expect(result.webPushIds).toEqual([]);
    expect(result.mobilePushIds).toEqual([300]);
  });

  it('collects testAB messages as email IDs', () => {
    const nodes = [makeNode('testAB', { messages: [{ id: 10 }, { id: 20 }] })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([10, 20]);
  });

  it('collects randomMessage messages as email IDs', () => {
    const nodes = [makeNode('randomMessage', { messages: [{ id: 30 }, { id: 40 }, { id: 50 }] })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([30, 40, 50]);
  });

  it('collects randomWebPush messages as webPush IDs', () => {
    const nodes = [makeNode('randomWebPush', { messages: [{ id: 60 }, { id: 70 }] })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([]);
    expect(result.webPushIds).toEqual([60, 70]);
  });

  it('collects randomMobilePush messages as mobilePush IDs', () => {
    const nodes = [makeNode('randomMobilePush', { messages: [{ id: 80 }] })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([]);
    expect(result.mobilePushIds).toEqual([80]);
  });

  it('skips nodes without settings.id', () => {
    const nodes = [makeNode('email', {}), makeNode('webPush', { id: undefined })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([]);
    expect(result.webPushIds).toEqual([]);
  });

  it('skips multi-message nodes without messages array', () => {
    const nodes = [makeNode('testAB', {}), makeNode('randomMessage', { messages: undefined })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([]);
  });

  it('skips messages with falsy IDs in multi-message nodes', () => {
    const nodes = [makeNode('testAB', { messages: [{ id: 0 }, { id: 10 }] })];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([10]);
  });

  it('ignores non-message node types', () => {
    const nodes = [
      makeNode('trigger', { id: 1 }),
      makeNode('wait', { timer: 10 }),
      makeNode('addTag', { id: 5 }),
      makeNode('split', {}),
      makeNode('httpRequest', { url: 'https://example.com' }),
      makeNode('end', {}),
    ];
    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([]);
    expect(result.webPushIds).toEqual([]);
    expect(result.mobilePushIds).toEqual([]);
  });

  it('collects from a mixed flow with multiple channel types', () => {
    const nodes = [
      makeNode('trigger', {}),
      makeNode('email', { id: 100 }),
      makeNode('webPush', { id: 200 }),
      makeNode('mobilePush', { id: 300 }),
      makeNode('testAB', { messages: [{ id: 10 }, { id: 20 }] }),
      makeNode('randomWebPush', { messages: [{ id: 60 }] }),
      makeNode('email', { id: 101 }),
      makeNode('wait', { timer: 5 }),
      makeNode('end', {}),
    ];

    const result = collectMessageIds(nodes);
    expect(result.emailIds).toEqual([100, 10, 20, 101]);
    expect(result.webPushIds).toEqual([200, 60]);
    expect(result.mobilePushIds).toEqual([300]);
  });
});
