/**
 * @fileoverview
 * Type definitions for the Error Insights Dashboard. This file defines the shapes
 * of the core data structures used throughout the application, such as the error
 * log objects and filter descriptors. It also distinguishes between the raw data
 * format from the API and the processed format used by the frontend.
 */

import { type DateRange } from "react-day-picker";

/**
 * Represents the raw error log entry as it comes from the API.
 * Dates are strings.
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
 * Represents a single error log entry once processed by the frontend.
 * It has a unique ID for React keys and Date objects for dates.
 */
export type ErrorLog = Omit<ApiErrorLog, 'log_date_time' | 'as_start_date_time'> & {
  id: string;
  log_date_time: Date;
  as_start_date_time: Date;
};

/**
 * Defines the structure of the successful response from the logs API.
 */
export type LogsApiResponse = {
  logs: ApiErrorLog[];
  totalCount: number;
  chartData: ErrorTrendDataPoint[];
  groupData: GroupDataPoint[];
};

/**
 * Describes the current sorting state of the data table.
 */
export type SortDescriptor = {
  column: keyof ErrorLog | null;
  direction: 'ascending' | 'descending' | null;
};

/**
 * Defines the structure for storing active column filters.
 * Each key is a column name, and the value is the string to filter by.
 */
export type ColumnFilters = Partial<Record<keyof ErrorLog, string>>;

/**
 * Defines the available options for grouping logs in the table.
 */
export type GroupByOption = 'host_name' | 'repository_path' | 'error_number' | 'user_id' | 'version_number';

/**
 * Represents a single data point in a grouped data summary.
 * Can be nested to support multi-level grouping.
 */
export type GroupDataPoint = {
  key: string;
  count: number;
  subgroups?: GroupDataPoint[];
};

/**
 * Defines the available options for the chart's breakdown tooltip.
 */
export type ChartBreakdownByOption = 'host_name' | 'error_number' | 'user_id' | 'version_number' | 'repository_path';

/**
 * Defines the data structure for a single point in the error trend chart.
 */
export type ErrorTrendDataPoint = {
  date: string; // The specific date for the data point (e.g., "2023-11-21T10:30:00.000Z")
  count: number; // Total number of errors on this date
  formattedDate: string; // A user-friendly formatted date for the chart's x-axis (e.g., "Nov 21" or "10:30")
  /** A breakdown of error counts by a secondary key (e.g., hostname, error code). The key is dynamic. */
  breakdown: Record<string, number>; 
};

/**
 * Defines the structure of the request body sent to the logs API.
 */
export type LogsApiRequest = {
  requestId: string;
  interval?: string | null;
  dateRange?: DateRange;
  pagination: { page: number; pageSize: number };
  sort: SortDescriptor;
  filters: ColumnFilters;
  groupBy: GroupByOption[];
  chartBreakdownBy: ChartBreakdownByOption;
};
