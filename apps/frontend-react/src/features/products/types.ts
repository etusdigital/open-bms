export interface ProductMessage {
  message_name: string;
  message_subject: string;
  message_sender: string;
  message_sender_name: string;
  campaign_message_statistics?: {
    delivered: number;
    open: number;
    click: number;
    bounce: number;
    unsubscribe: number;
  };
  campaign_message_winner?: boolean;
}

export interface ProductItem {
  title: string;
  link: string | string[];
  messages: ProductMessage[];
  tags: Record<string, unknown>;
  sendToAll: boolean;
}

export interface HourSlot {
  products: ProductItem[];
}

/** { "HH:MM": { products: [...] } } */
export type DateProducts = Record<string, HourSlot>;

/** { "YYYY-MM-DD": DateProducts } */
export type DayMap = Record<string, DateProducts>;

export interface ProductsResponse {
  products: DayMap[];
}
