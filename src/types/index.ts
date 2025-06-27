/**
 * @fileoverview
 * Type definitions for the Error Insights Dashboard. This file defines the shapes
 * of the core data structures used throughout the application, such as the error
 * log objects and filter descriptors. It also distinguishes between the raw data
 * format from the API and the processed format used by the frontend.
 */

/**
 * Represents the raw error log entry received from the API.
 * Dates are strings and there is no client-side 'id'.
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
 * It includes a unique 'id' for React keys and Date objects for dates.
 */
export type ErrorLog = Omit<ApiErrorLog, 'log_date_time' | 'as_start_date_time'> & {
  id: string;
  log_date_time: Date;
  as_start_date_time: Date;
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
export type GroupByOption = 'none' | 'host_name' | 'repository_path' | 'error_number' | 'user_id';

/**
 * Represents a single data point in a grouped data summary.
 */
export type GroupDataPoint = {
  key: string;
  count: number;
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
