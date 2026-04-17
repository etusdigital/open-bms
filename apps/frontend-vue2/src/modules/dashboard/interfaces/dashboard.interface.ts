export interface TableHeader {
  text: string | any;
  value: string;
  sortable: boolean;
  width: string;
  align?: string;
}

export interface MessageMetric {
  title: string | any;
  icon: string | any;
  visible: boolean;
  types: string[];
  color: string;
}

export interface MessageMetrics {
  [key: string]: MessageMetric;
}

export interface TimeSerieInterface {
  name: string | any;
  data: any;
  value: string;
  yAxisIndex?: number;
  type?: 'line' | 'bar' | 'column';
}

export interface ChartOptionsInterface {
  chart: any;
  stroke: any;
  yaxis: any;
  xaxis: any;
  colors?: string[];
  tooltip: any;
  events?: any;
  plotOptions?: any;
  grid?: any;
}
