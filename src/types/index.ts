/**
 * @fileoverview
 * Type definitions for the Error Insights Dashboard. This file defines the shapes
 * of the core data structures used throughout the application, such as the error
 * log objects and filter descriptors. It also distinguishes between the raw data
 * format from the API and the processed format used by the frontend.
 */

/**
 * Represents the raw error log entry as it comes from the API.
 * Dates are strings, expected to be pre-formatted by the backend.
 */
export type ApiErrorLog = {
  log_date_time: string;
  host_name: string;
  repository_path: string;
  port_number: number;
  version_number: string;
  as_server_mode: string;
  as_start_date_time: string;
  as_server_config: string;
  user_id: string;
  report_id_name: string;
  error_number: number;
  xql_query_id: string;
  log_message: string;
};

/**
 * Represents a single error log entry used by the frontend.
 * It includes a unique ID for React keys. Timestamps are strings.
 */
export type ErrorLog = ApiErrorLog & {
  id: string;
};

/**
 * Represents a single data point in a grouped data summary from the API.
 * The `logs` property is not included, as they should be fetched on-demand.
 * For data consistency, `subgroups` must always be an array, even if empty.
 */
export type ApiGroupDataPoint = {
  key: string;
  count: number;
  subgroups: ApiGroupDataPoint[];
}

/**
 * Defines the structure of the successful response from the logs API.
 * The backend might return only a subset of these fields depending on the request.
 */
export type LogsApiResponse = {
  logs: ApiErrorLog[];
  totalCount: number;
  chartData: ErrorTrendDataPoint[];
  groupData: ApiGroupDataPoint[];
  dbTime: string;
  dbTimeUtc: string;
  dbTimezone: string;
};

/**
 * Describes the current sorting state of the data table.
 */
export type SortDescriptor = {
  column: keyof ErrorLog | null;
  direction: 'ascending' | 'descending' | null;
};

/**
 * Defines the available logical operators for column filtering.
 * - 'in': Corresponds to a SQL `IN` or `OR` condition.
 * - 'notIn': Corresponds to a SQL `NOT IN` condition.
 * - 'and': Corresponds to a series of `AND` conditions (e.g., `ILIKE '%a%' AND ILIKE '%b%'`).
 */
export type FilterOperator = 'in' | 'notIn' | 'and';

/**
 * Defines the structure for a single filter condition, including the
 * operator and the values to filter by.
 */
export type FilterCondition = {
  operator: FilterOperator;
  values: string[];
};

/**
 * Defines the structure for storing active column filters.
 * Each key is a column name, and the value is a `FilterCondition` object.
 */
export type ColumnFilters = Partial<Record<keyof ErrorLog, FilterCondition>>;


/**
 * Defines the available options for grouping logs in the table.
 */
export const GroupByOptionsList: { id: GroupByOption; name: string }[] = [
    { id: 'repository_path', name: 'Model' },
    { id: 'host_name', name: 'Host' },
    { id: 'error_number', name: 'Error Code' },
    { id: 'user_id', name: 'User' },
    { id: 'report_id_name', name: 'Report Name' },
    { id: 'port_number', name: 'Port' },
    { id: 'version_number', name: 'AS Version' },
    { id: 'as_server_mode', name: 'Server Mode' },
    { id: 'as_server_config', name: 'Server Config' },
    { id: 'xql_query_id', name: 'Query ID' },
    { id: 'log_message', name: 'Message' },
];

export type GroupByOption =
  | 'host_name'
  | 'repository_path'
  | 'port_number'
  | 'version_number'
  | 'as_server_mode'
  | 'as_server_config'
  | 'user_id'
  | 'report_id_name'
  | 'error_number'
  | 'xql_query_id'
  | 'log_message';

/**
 * Represents a single data point in a grouped data summary for frontend use.
 * Can be nested. `subgroups` is always an array. `logs` are not included.
 */
export type GroupDataPoint = {
  key: string;
  count: number;
  subgroups: GroupDataPoint[];
};

/**
 * Defines the available options for the chart's breakdown tooltip.
 */
export type ChartBreakdownByOption = GroupByOption;

/**
 * Defines the data structure for a single point in the error trend chart.
 * All date/time fields are strings, expected to be pre-formatted by the backend.
 */
export type ErrorTrendDataPoint = {
  /** The full ISO 8601 timestamp for the start of the time bucket. */
  date: string;
  /** A complete, user-friendly formatted date for the tooltip (e.g., "November 21, 2023, 10:30 UTC"). */
  fullDate: string;
  /** Total number of errors on this date. */
  count: number;
  /** A user-friendly formatted date for the chart's x-axis (e.g., "Nov 21" or "10:30"). */
  formattedDate: string;
  /**
   * A pre-fetched object containing breakdowns for all possible fields.
   * The frontend selects which breakdown to display without a new API call.
   */
  breakdown: Partial<Record<ChartBreakdownByOption, Record<string, number>>>;
};


/**
 * The shape of a date range sent to the API. Dates must be ISO strings.
 */
export type ApiDateRange = {
    from?: string;
    to?: string;
}

/**
 * The suggested granularity for time buckets in the chart data.
 */
export type ChartBucket = 'day' | 'hour';

/**
 * Defines the structure of the request body sent to the logs API.
 * The frontend will handle converting array filters to comma-separated strings.
 * Fields are optional to support specialized requests (e.g., logs only vs. chart only).
 */
export type LogsApiRequest = {
  requestId: string;
  interval?: string;
  dateRange?: ApiDateRange;
  pagination?: { page: number; pageSize: number };
  sort?: SortDescriptor;
  filters: ColumnFilters;
  groupBy?: GroupByOption[];
  chartBreakdownFields?: GroupByOption[];
  chartBucket?: ChartBucket;
};
