/**
 * Represents a single error log entry from the logging service.
 */
export type ErrorLog = {
  id: string; // Add a unique ID for React keys
  log_date_time: Date;
  host_name: string;
  repository_path: string;
  port_number: number;
  version_number: string;
  as_server_mode: string;
  as_start_date_time: Date;
  as_server_config: string;
  user_id: string;
  report_id_name: string;
  error_number: number;
  xql_query_id: string;
  log_message: string;
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
 * Represents a group of logs, containing the log entries and their total count.
 */
export type GroupedLog = {
    logs: ErrorLog[];
    count: number;
};

/**
 * A record of grouped logs, where each key is the group identifier (e.g., a hostname).
 */
export type GroupedLogs = Record<string, GroupedLog>;

/**
 * Defines the available options for grouping logs in the table.
 */
export type GroupByOption = 'none' | 'host_name' | 'repository_path' | 'error_number' | 'user_id';

/**
 * Defines the data structure for a single point in the error trend chart.
 */
export type ErrorTrendDataPoint = {
  date: string; // The specific date for the data point (e.g., "2023-11-21")
  count: number; // Total number of errors on this date
  formattedDate: string; // A user-friendly formatted date for the chart's x-axis (e.g., "Nov 21")
  breakdown: Record<string, number>; // A breakdown of error counts by a secondary key, like hostname
};
