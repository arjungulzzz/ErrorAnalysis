# Backend Service SQL Query Guide

This document outlines the SQL patterns required for the backend service to support server-side pagination, filtering, sorting, and aggregation for the Error Insights Dashboard. These examples use PostgreSQL syntax.

**IMPORTANT**: Always use **parameterized queries** in your backend code to prevent SQL injection vulnerabilities.

---

### A Note on Timestamps and Timezones

The frontend application **does not perform any time conversion or formatting**. It displays the timestamp strings it receives directly from the API.

Therefore, the backend service is the **single source of truth** for time. It is critical that the service performs all time-related calculations and formatting consistently.

-   **All timestamp fields** (`log_date_time`, `as_start_date_time`, and all date fields within `chartData`) must be sent as **pre-formatted strings**.
-   It is highly recommended to perform all date truncation and formatting operations in a **consistent timezone (e.g., UTC)** to avoid ambiguity and ensure data is displayed correctly for all users. The examples below use UTC.

---

### Base Query

All subsequent modifications will build upon this base `JOIN` query. The `log_date_time` and `as_start_date_time` columns should be cast to a text format that is suitable for direct display in the UI.

```sql
SELECT
  -- Cast timestamps to a user-friendly string format
  to_char(ali.log_date_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') as log_date_time,
  asli.host_name,
  asli.repository_path,
  asli.port_number,
  asli.version_number,
  asli.as_server_mode,
  to_char(asli.as_start_date_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') as as_start_date_time,
  asli.as_server_config,
  ali.user_id,
  ali.report_id_name,
  ali.error_number,
  ali.xql_query_id,
  ali.log_message
FROM as_log_info ali
JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
```

---

### Filtering and Sorting

These clauses should be applied to all queries to ensure the data is consistent across all parts of the API response (logs, counts, charts, etc.).

#### 1. Applying Time Filters

Add a `WHERE` clause based on the `interval` or `dateRange` provided in the request body. The API will provide one or the other, but not both.

**A) By `interval` (e.g., `{ "interval": "7 days" }`)**

```sql
-- Appended to the base query:
WHERE ali.log_date_time >= NOW() - CAST($1 AS INTERVAL)

-- Parameter $1 would be: '7 days'
```
The parameter `$1` will be one of the following string values: `'1 hour'`, `'4 hours'`, `'8 hours'`, `'1 day'`, `'7 days'`, `'15 days'`, or `'1 month'`.

**B) By `dateRange` (e.g., `{ "dateRange": { "from": "...", "to": "..." } }`)**

```sql
-- Appended to the base query:
WHERE ali.log_date_time BETWEEN $1 AND $2

-- Parameter $1 would be: the 'from' date (ISO 8601 string)
-- Parameter $2 would be: the 'to' date (ISO 8601 string)
```

#### 2. Applying Column Filters

Append `AND` conditions by iterating through the `filters` object from the request. This is the key to handling both general and drill-down queries correctly.

**Example Request: `{ "filters": { "host_name": "server-alpha", "error_number": "500" } }`**

```sql
-- Appended after the time filter:
AND asli.host_name ILIKE $3
AND ali.error_number = CAST($4 AS INTEGER)

-- Use ILIKE for case-insensitive partial matching.
-- Parameter $3 would be: 'server-alpha%'
-- Parameter $4 would be: '500'
```

#### 3. Applying Sorting

Dynamically construct the `ORDER BY` clause. **Security is critical**: you must validate the `column` name against a whitelist of allowed columns.

**Example Request: `{ "sort": { "column": "host_name", "direction": "ascending" } }`**

```sql
-- After validating "host_name" is a safe column name:
ORDER BY asli.host_name ASC

-- If direction is "descending":
ORDER BY asli.host_name DESC
```
If no sort is specified, a sensible default is `ORDER BY ali.log_date_time DESC`.

---

### Data Fetching Modes

The API has two primary modes, determined by the `groupBy` parameter in the request.

#### Case A: Fetching a List of Logs (`groupBy: []`)

When `groupBy` is an empty array, the API should return a paginated list of individual logs and their total count. To do this efficiently, the backend should retrieve both the logs and the total count in a single query using a window function like `COUNT(*) OVER()`. This avoids a second database round trip for a separate `COUNT(*)` query.

**IMPORTANT**: Pagination (`LIMIT` and `OFFSET`) must be applied in this mode.

This mode is used in two contexts, but the backend's logic is the same: apply all provided filters.

##### **1. General Log Fetch (Main Table)**
This is a standard request for a page of logs. The `filters` are based on the main UI controls.

```sql
-- Combined Query Example (PostgreSQL):
SELECT
  to_char(ali.log_date_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') as log_date_time,
  asli.host_name,
  -- ... other columns
  ali.log_message,
  COUNT(*) OVER() AS total_count -- This calculates the total count before LIMIT is applied
FROM as_log_info ali
JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
WHERE
  -- Apply time and column filters from the main UI here
  -- e.g., ali.log_date_time >= NOW() - CAST($1 AS INTERVAL)
  -- The filters object may be empty or contain user-defined filters.
ORDER BY
  -- Apply sorting here
LIMIT $2 -- pageSize
OFFSET $3; -- (page - 1) * pageSize
```
The `totalCount` in the response should be populated with the `total_count` value from the query result.

##### **2. Drill-Down Log Fetch (Expanding a Group)**
This request fetches logs for a specific group. The only difference from a general fetch is that the `filters` object will contain **additional key-value pairs** corresponding to the expanded group's path. The backend logic is the same: simply add all provided filters to the `WHERE` clause.

```sql
-- Request filters might be: { "host_name": "server-alpha-01", "error_number": "500" }
-- This results in an extended WHERE clause:
SELECT
  to_char(ali.log_date_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') as log_date_time,
  asli.host_name,
  -- ... other columns
  ali.log_message,
  COUNT(*) OVER() AS total_count
FROM as_log_info ali
JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
WHERE
  -- Apply time and column filters from the main UI here
  ali.log_date_time >= NOW() - CAST($1 AS INTERVAL)
  -- AND add the specific drill-down filters from the request body
  AND asli.host_name = $2
  AND ali.error_number = CAST($3 AS INTEGER)
ORDER BY
  -- Apply sorting here
LIMIT $4 -- pageSize
OFFSET $5; -- (page - 1) * pageSize
```
The `totalCount` in this response is crucial for the sub-table's independent pagination.

#### Case B: Fetching Aggregated Data (`groupBy: ["column", ...]`)

When the `groupBy` array is not empty, the API should return an aggregated summary.

**IMPORTANT**: Pagination (`LIMIT` and `OFFSET`) must be **ignored** for these aggregation queries. They must run against the entire filtered dataset. The response **must not** contain the `logs` array within `groupData`, as logs will be fetched on demand.

The response should contain three main pieces of data, which can be generated with separate queries: `totalCount`, `groupData`, and `chartData`.

**1. `totalCount` Query:**

Calculates the total number of matching records before any grouping is applied.

```sql
SELECT COUNT(*)
FROM as_log_info ali
JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
WHERE ... -- (Apply same time and column filters)
```

**2. `groupData` Query (Multi-Column Grouping):**

A common approach is to fetch the aggregated data and then build the hierarchy in your application code, as this is often more straightforward than building complex JSON directly in SQL.

**Step 1: Fetch Flattened Aggregated Data**

```sql
-- Example for: { "groupBy": ["host_name", "error_number"] }
-- IMPORTANT: All `groupBy` column names MUST be validated against a whitelist.
SELECT
  asli.host_name,
  ali.error_number,
  COUNT(*) as count
FROM as_log_info ali
JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
WHERE ... -- (Apply same time and column filters)
GROUP BY
  asli.host_name,
  ali.error_number
ORDER BY
  asli.host_name,
  count DESC;
```

**Step 2: Build the Nested Structure in Application Code**

In your backend service (e.g., in Node.js, Python, Go), process the flattened results from Step 1 into the required nested JSON format. The final structure must be an array of objects, where each object has a `key`, `count`, and `subgroups`. The `logs` property should not be included.

**3. `chartData` Query (Dynamic Breakdowns):**

To support dynamic breakdowns based on visible columns in the UI, the backend service must now dynamically construct the `chartData` query. The static query with all possible breakdowns is no longer sufficient.

The frontend will send a `chartBreakdownFields` array in the request body (e.g., `["host_name", "error_number"]`).

**Backend Logic:**
1.  **Receive** the `chartBreakdownFields` array.
2.  **IMPORTANT: Validate** every string in the array against a whitelist of permissible, index-backed column names to prevent SQL injection.
3.  **Dynamically construct** the `jsonb_build_object(...)` part of the SQL query. For each validated field, generate the corresponding `(SELECT jsonb_object_agg(...) ...)` clause.

**Example Pseudocode (e.g., in Node.js):**
```javascript
const { chartBreakdownFields } = request.body;
// Map frontend names to actual DB column names and validate
const allowedColumns = {
  host_name: 'asli.host_name',
  error_number: 'ali.error_number::text',
  repository_path: 'asli.repository_path'
  // ... add all other valid columns
};

const breakdownClauses = (chartBreakdownFields || [])
  .map(field => {
    if (allowedColumns[field]) {
      // Important to use the mapped and validated column name
      const dbColumn = allowedColumns[field];
      return `'${field}', (SELECT jsonb_object_agg(t.key, t.count) FROM (SELECT ${dbColumn} as key, COUNT(*) as count FROM TimeBuckets WHERE date = Buckets.date GROUP BY key) as t)`;
    }
    return null;
  })
  .filter(Boolean) // Remove any invalid fields
  .join(', ');

const breakdownObject = breakdownClauses ? `jsonb_build_object(${breakdownClauses})` : `'{}'::jsonb`;

// The final query string would incorporate `breakdownObject`
const finalQuery = `
  WITH TimeBuckets AS (...)
  SELECT
    ...,
    ${breakdownObject} as breakdown
  FROM TimeBuckets as Buckets
  GROUP BY date
  ORDER BY date;
`;

// Execute the dynamically generated query
```

**Full SQL Query Structure:**

```sql
-- Request may include: { "chartBucket": "hour", "chartBreakdownFields": ["host_name", "error_number"] }
WITH TimeBuckets AS (
  SELECT
    -- Use the `chartBucket` parameter to dynamically set the truncation level.
    -- The parameter will be either 'day' or 'hour'. You must validate this value.
    date_trunc($1, ali.log_date_time AT TIME ZONE 'UTC') as date,
    -- Select all columns that could be used for breakdown
    asli.host_name,
    ali.error_number::text as error_number,
    asli.repository_path
    -- ... and so on for all other breakdown-able columns
  FROM as_log_info ali
  JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
  WHERE ... -- (Same WHERE clauses from filters)
)
SELECT
  -- The raw ISO 8601 timestamp for the bucket
  date::text,
  -- The full, formatted string for the chart tooltip
  to_char(date, 'FMMonth FMDD, YYYY, HH24:MI "UTC"') as "fullDate",
  -- The total count for the bucket
  COUNT(*)::integer as count,
  -- The formatted string for the chart's x-axis label
  CASE
    WHEN $1 = 'hour' THEN to_char(date, 'HH24:MI')
    ELSE to_char(date, 'Mon DD')
  END as "formattedDate",
  -- The JSON object containing the requested breakdowns, built dynamically in the application layer
  -- as described in the pseudocode above.
  -- Example of dynamically generated SQL part:
  jsonb_build_object(
      'host_name', (SELECT jsonb_object_agg(t.host_name, t.count) FROM (SELECT host_name, COUNT(*) FROM TimeBuckets WHERE date = Buckets.date GROUP BY host_name) as t(host_name, count)),
      'error_number', (SELECT jsonb_object_agg(t.error_number, t.count) FROM (SELECT error_number, COUNT(*) FROM TimeBuckets WHERE date = Buckets.date GROUP BY error_number) as t(error_number, count))
  ) as breakdown
FROM TimeBuckets as Buckets
GROUP BY date
ORDER BY date;

-- Parameter $1 would be: 'hour' or 'day'
```
