import { z } from "zod";

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

export type ColumnFilters = Partial<Record<keyof ErrorLog, string>>;

export type GroupedLog = {
    logs: ErrorLog[];
    count: number;
};

export type GroupedLogs = Record<string, GroupedLog>;

export type GroupByOption = 'none' | 'host_name' | 'repository_path' | 'error_number' | 'user_id';

export type ErrorTrendDataPoint = {
  date: string;
  count: number;
  formattedDate: string;
};

// Types for AI Error Summary Flow
const PartialErrorLogSchema = z.object({
  error_number: z.number(),
  log_message: z.string(),
});

export const SummarizeErrorsInputSchema = z.array(PartialErrorLogSchema);
export type SummarizeErrorsInput = z.infer<typeof SummarizeErrorsInputSchema>;

export const SummarizeErrorsOutputSchema = z.object({
  summary: z.string().describe("A concise, one-to-two sentence summary of the common theme across all the provided error logs."),
  rootCause: z.string().describe("The likely root cause or technical reason for this group of errors. Be specific if possible."),
  impact: z.string().describe("The potential impact of these errors on users or the system."),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).describe("The recommended priority for investigating this group of errors, based on their nature and frequency."),
});
export type SummarizeErrorsOutput = z.infer<typeof SummarizeErrorsOutputSchema>;
