export type MessageType = 'email' | 'web-push';

export type DisplayMode = 'numeric' | 'percentage';

export interface StatisticsGeneral {
  delivered: number;
  open: number;
  unique_opens: number;
  click: number;
  unique_clicks: number;
  unsubscribe: number;
  bounce: number;
  sent: number;
  close: number;
  unique_user_delivered: number;
  unique_user_open: number;
  unique_user_click: number;
  unique_user_unsubscribe: number;
  unique_user_bounce: number;
  opens_per_contact: number;
  clicks_per_contact: number;
}

export interface StatisticsDaily extends StatisticsGeneral {
  date: string;
}

export interface StatisticsResponse {
  general: StatisticsGeneral;
  daily: StatisticsDaily[];
}

/** Table row with pre-computed percentages */
export interface StatisticsTableRow extends StatisticsDaily {
  percentageOpen: number;
  percentageUniqueOpen: number;
  percentageClick: number;
  percentageUniqueClick: number;
  percentageCtor: number;
  percentageUto: number;
  percentageUnsubscribe: number;
  percentageBounce: number;
  percentageDelivered: number;
  percentageClose: number;
  percentageUserOpen: number;
  percentageUserClick: number;
  percentageUserUnsubscribe: number;
  percentageUserBounce: number;
}

export interface StatisticsFilterParams {
  startDate: string;
  endDate: string;
  campaigns?: string;
  automations?: string;
  messages?: string;
  tags?: string;
  segments?: string;
  senders?: string;
  subUsers?: string;
}
