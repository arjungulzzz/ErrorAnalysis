import { type ErrorLog } from '@/types';

// Helper function to generate random data
const randomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const randomItem = <T,>(items: T[]): T => {
  return items[Math.floor(Math.random() * items.length)];
};

const hosts = ['server-alpha-01', 'server-beta-02', 'server-gamma-03', 'web-prod-1', 'db-cluster-5'];
const repos = ['/apps/main-service', '/apps/auth-service', '/apps/payment-gateway', '/apps/user-profiles'];
const versions = ['1.2.3', '1.2.4', '2.0.0-beta', '2.0.1'];
const users = ['user-101', 'user-203', 'system-internal', 'api-key-xyz', 'guest'];
const reportNames = [
  'daily_summary',
  'user_activity_report',
  'payment_failures',
  'system_health_check',
  'this_is_an_extremely_long_report_name_that_is_designed_to_test_the_truncation_and_tooltip_functionality_of_the_data_table_interface_to_ensure_a_clean_and_user_friendly_experience_across_all_columns_and_data_types',
  'short_report',
  'another_very_long_report_name_for_the_purpose_of_testing_ui_behavior_with_long_strings_and_ensuring_that_the_elipsis_and_tooltips_work_correctly',
  ''
];
const logMessages = [
  'Failed to connect to database: timeout expired.',
  'Null pointer exception at user processing module.',
  'API rate limit exceeded for user.',
  'Authentication token is invalid or has expired.',
  'Disk space is critically low on the primary data partition.',
  'This is an exceptionally long and detailed log message created specifically for testing purposes. It needs to be long enough to ensure that the truncation logic in the UI is triggered correctly and that the expandable row feature functions as expected, showing the full content without breaking the layout. The message details a hypothetical critical failure scenario involving multiple subsystems, such as: [Subsystem: Authentication, Error: TokenValidationFailure, Timestamp: 2023-11-21T10:30:00Z], [Subsystem: DatabaseConnector, Error: ConnectionPoolExhausted, Details: All connections are in use and the timeout of 30s was reached while waiting for a free connection], [Subsystem: CachingLayer, Error: RedisCacheMiss, Key: \'user:session:xyz123\']. This comprehensive message simulates real-world verbosity.',
  'Request failed with status code 503: Service Unavailable.',
  'Here is another very long log message designed to stretch the boundaries of the UI components. It contains a lot of technical jargon and error codes like "0xDEADBEEF" and "ERR_CONNECTION_RESET" to simulate a real-world debugging scenario. We need to verify that line breaks, special characters, and long uninterrupted strings are all handled gracefully by the expandable details view and that the copy-to-clipboard functionality works seamlessly with this complex content. The goal is to create a robust and resilient user interface that never fails, no matter how chaotic the input data gets. This includes handling paths like C:\\Users\\Default\\AppData\\Local\\Temp and URLs like https://example.com/this/is/a/very/long/url/that/should/also/be/handled/correctly.',
  '',
];
const errorNumbers = [500, 404, 401, 503, 1201, 1337, 429];


const generateMockLog = (id: number): ErrorLog => {
  const logDateTime = randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()); // last 30 days
  return {
    id: `log-${id}-${logDateTime.getTime()}`,
    log_date_time: logDateTime,
    host_name: randomItem(hosts),
    repository_path: randomItem(repos),
    port_number: randomItem([8080, 9000, 5432, 3000]),
    version_number: randomItem(versions),
    as_server_mode: randomItem(['production', 'staging']),
    as_start_date_time: new Date(logDateTime.getTime() - 1000 * 60 * 60 * 6), // 6 hours before log
    as_server_config: `config_${randomItem(['A', 'B', 'C'])}.json`,
    user_id: randomItem(users),
    report_id_name: randomItem(reportNames),
    error_number: randomItem(errorNumbers),
    xql_query_id: `q-${Math.random().toString(36).substring(2, 10)}`,
    log_message: randomItem(logMessages),
  };
};

export const generateMockLogs = (count: number = 250): ErrorLog[] => {
    return Array.from({ length: count }, (_, i) => generateMockLog(i + 1));
};
