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

export type SortDescriptor = {
  column: keyof ErrorLog | null;
  direction: 'ascending' | 'descending' | null;
};

export type GroupedLog = {
    logs: ErrorLog[];
    count: number;
    anomalousCount: number;
};

export type GroupedLogs = Record<string, GroupedLog>;
