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
const reportNames = ['daily_summary', 'user_activity_report', 'payment_failures', 'system_health_check', ''];
const errorNumbers = [500, 404, 401, 503, 1201, 1337, 429];
const logMessages = [
  'Failed to connect to database: timeout expired.',
  'Null pointer exception at user processing module.',
  'API rate limit exceeded for user.',
  'Authentication token is invalid or has expired.',
  'Disk space is critically low.',
  'Could not resolve external service DNS.',
  'Request failed with status code 503',
  'Unable to acquire lock for resource: payment-processing',
  'A very long log message that is definitely going to be truncated by the default table cell styling to demonstrate how the tooltip functionality works for users who need to see the full context of an error without expanding every single row in the table.',
  '',
];

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
