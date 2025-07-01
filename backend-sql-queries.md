# Backend Service SQL Query Guide

This document outlines the SQL patterns required for the backend service to support server-side pagination, filtering, sorting, and aggregation for the Error Insights Dashboard. These examples use PostgreSQL syntax.

**IMPORTANT**: Always use **parameterized queries** in your backend code to prevent SQL injection vulnerabilities.

---

### Base Query

All subsequent modifications will build upon this base `JOIN` query.

```sql
SELECT
  ali.log_date_time,
  asli.host_name,
  asli.repository_path,
  asli.port_number,
  asli.version_number,
  asli.as_server_mode,
  asli.as_start_date_time,
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

Add a `WHERE` clause based on the `interval` or `dateRange` provided in the request body.

**A) By `interval` (e.g., `{ "interval": "7 days" }`)**

```sql
-- Appended to the base query:
WHERE ali.log_date_time >= NOW() - CAST($1 AS INTERVAL)

-- Parameter $1 would be: '7 days'
```

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
  ali.log_date_time,
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
  ali.log_date_time,
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

**3. `chartData` Query:**

Groups data into time buckets and creates a JSON object for the breakdown.

```sql
-- Example Request: { "chartBreakdownBy": "error_number" } (assuming hourly buckets)
WITH TimeBuckets AS (
  SELECT
    -- Dynamically truncate based on the time range: 'day', 'hour', or '30 minute'
    date_trunc('hour', ali.log_date_time AT TIME ZONE 'UTC') as date,
    -- This is the dynamic breakdown key, whitelisted
    ali.error_number::text as breakdown_key,
    COUNT(*) as error_count
  FROM as_log_info ali
  JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
  WHERE ... -- (Same WHERE clauses from filters)
  GROUP BY 1, 2
)
SELECT
  -- Cast to text to ensure consistent ISO 8601 format
  date::text,
  SUM(error_count)::integer as count,
  -- Aggregate the breakdowns into a JSONB object, ordered by count descending
  jsonb_object_agg(breakdown_key, error_count ORDER BY error_count DESC) as breakdown
FROM TimeBuckets
GROUP BY date
ORDER BY date;
```
