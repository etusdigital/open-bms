export interface RedisStatistics {
  [key: string]: string; // Redis hgetall returns string values
  delivered?: string;
  open?: string;
  click?: string;
  bounce?: string;
  blocked?: string;
  bot_click?: string;
  datacenter_click?: string;
  spam_report?: string;
  unsubscribe?: string;
  unique_open?: string;
  unique_click?: string;
  pool?: string;
}

export interface AggregatedData {
  // Basic event counts
  processed: number;
  delivered: number;
  open: number;
  unique_open: number;
  click: number;
  unique_click: number;
  bounce: number;
  blocked: number;
  bot_click: number;
  datacenter_click: number;
  spam_report: number;
  unsubscribe: number;
  deferred: number;
  sent: number;
  close: number;

  // Metadata
  pool?: string;
  is_test_ab: boolean;

  // Detailed statistics stored as JSON
  click_position_data: {
    [position: string]: number;
  };

  email_provider_data: {
    [eventType: string]: {
      [provider: string]: number;
    };
  };

  browser_data: {
    [eventType: string]: {
      [browser: string]: number;
    };
  };

  os_data: {
    [eventType: string]: {
      [os: string]: number;
    };
  };

  device_data: {
    mobile_open: number;
    desktop_open: number;
    mobile_click: number;
    desktop_click: number;
  };

  country_data: {
    [eventType: string]: {
      [country: string]: number;
    };
  };

  region_data: {
    [eventType: string]: {
      [region: string]: number;
    };
  };
}

export interface HourlyInsight {
  date: string;
  [eventName: string]: string | { [hour: string]: number };
}
