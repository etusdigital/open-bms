import { InterationEmailTypes } from './types';

export function parseEventType(event: string): string | undefined {
  switch (event) {
    case InterationEmailTypes.SEND:
      return 'delivered';
    case InterationEmailTypes.DELIVERED:
      return 'delivered';
    case InterationEmailTypes.OPEN:
      return 'open';
    case InterationEmailTypes.CLICK:
      return 'click';
  }
}
