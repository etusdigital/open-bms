import type { AutomationNode, AnyNodeData } from './types';

/**
 * Walk all nodes and collect message IDs for statistics fetching.
 * Returns separate arrays for email, webPush, mobilePush IDs.
 */
export function collectMessageIds(nodes: AutomationNode[]): {
  emailIds: number[];
  webPushIds: number[];
  mobilePushIds: number[];
} {
  const emailIds: number[] = [];
  const webPushIds: number[] = [];
  const mobilePushIds: number[] = [];

  for (const node of nodes) {
    const data = node.data as AnyNodeData;
    const settings = data.settings as Record<string, any>;
    const type = node.type;

    if (type === 'email' && settings?.id) {
      emailIds.push(settings.id);
    } else if (type === 'webPush' && settings?.id) {
      webPushIds.push(settings.id);
    } else if (type === 'mobilePush' && settings?.id) {
      mobilePushIds.push(settings.id);
    } else if (type === 'testAB' || type === 'randomMessage') {
      // Multi-message steps: collect each message's ID as email
      const messages = settings?.messages as Array<{ id: number }> | undefined;
      if (messages) {
        for (const msg of messages) {
          if (msg.id) emailIds.push(msg.id);
        }
      }
    } else if (type === 'randomWebPush') {
      const messages = settings?.messages as Array<{ id: number }> | undefined;
      if (messages) {
        for (const msg of messages) {
          if (msg.id) webPushIds.push(msg.id);
        }
      }
    } else if (type === 'randomMobilePush') {
      const messages = settings?.messages as Array<{ id: number }> | undefined;
      if (messages) {
        for (const msg of messages) {
          if (msg.id) mobilePushIds.push(msg.id);
        }
      }
    }
  }

  return { emailIds, webPushIds, mobilePushIds };
}
