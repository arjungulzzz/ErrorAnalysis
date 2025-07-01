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

### Scenario 1: Applying Time Filters

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

---

### Scenario 2: Applying Column Filters

Append `AND` conditions by iterating through the `filters` object from the request.

**Example Request: `{ "filters": { "host_name": "server-alpha", "error_number": "500" } }`**

```sql
-- Appended after the time filter:
AND asli.host_name ILIKE $3
AND ali.error_number = CAST($4 AS INTEGER)

-- Use ILIKE for case-insensitive partial matching.
-- Parameter $3 would be: 'server-alpha%'
-- Parameter $4 would be: '500'
```

---

### Scenario 3: Applying Sorting

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

### Scenario 4: Applying Pagination (for Flat Lists)

Use `LIMIT` and `OFFSET` to fetch the correct page of data.

**IMPORTANT**: Pagination should **only** be applied when fetching a flat list of logs (i.e., when the `groupBy` array in the request body is empty). Aggregation queries for `totalCount` and `groupData` should **not** be paginated.

**Example Request: `{ "pagination": { "page": 3, "pageSize": 100 } }`**

```sql
-- Appended at the very end of the query for a FLAT LIST of logs:
LIMIT $5 OFFSET $6

-- Parameter $5 (LIMIT) would be: 100
-- Parameter $6 (OFFSET) would be: 200 (calculated as (page - 1) * pageSize)
```

---

### Aggregation Queries

These queries run separately to calculate `totalCount`, `groupData`, and `chartData`. They must use the **same `WHERE` clauses** from scenarios 1 and 2 to ensure the aggregations match the filtered dataset. They **must not** be paginated.

**1. `totalCount` Query:**

Calculates the total number of matching records before pagination.

```sql
SELECT COUNT(*)
FROM as_log_info ali
JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
WHERE ... -- (Same WHERE clauses from Scenarios 1 & 2)
```

**2. `groupData` Query (Multi-Column Grouping):**

When the `groupBy` array in the request contains one or more column names (e.g., `["host_name", "error_number"]`), the backend must generate a nested JSON structure. The order of columns in the array determines the hierarchy.

**CRITICAL**: This query must **not** be paginated with `LIMIT` or `OFFSET`. It must aggregate over the entire filtered result set to provide a complete summary. The resulting nested objects should not contain the individual logs, as they will be fetched on demand.

A common approach is to fetch the aggregated data and then build the hierarchy in your application code, as this is often more straightforward than building complex JSON directly in SQL.

**Step 1: Fetch Flattened Aggregated Data**

First, run a query that groups by all requested columns and gets the count for each unique combination.

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

In your backend service (e.g., in Node.js, Python, Go), process the flattened results from Step 1 into the required nested JSON format.

**Expected `groupData` structure:**

The final structure must be an array of objects, where each object has a `key`, `count`, and `subgroups`. For data consistency, `subgroups` must always be an array, even if empty. The `logs` property should not be included.

```json
// Example response for groupBy: ["host_name", "error_number"]
[
  {
    "key": "server-alpha-01",
    "count": 1500,
    "subgroups": [
      {
        "key": "500",
        "count": 800,
        "subgroups": []
      },
      {
        "key": "404",
        "count": 700,
        "subgroups": []
      }
    ]
  },
  {
    "key": "server-beta-02",
    "count": 980,
    "subgroups": [ /* ... */ ]
  }
]
```

**3. `chartData` Query:**

Groups data into time buckets and creates a JSON object for the breakdown. This is the most complex query.

**Example Request: `{ "chartBreakdownBy": "error_number" }` (assuming hourly buckets)**

```sql
WITH TimeBuckets AS (
  SELECT
    -- Dynamically truncate based on the time range: 'day', 'hour', or '30 minute'
    date_trunc('hour', ali.log_date_time AT TIME ZONE 'UTC') as date,
    -- This is the dynamic breakdown key, whitelisted
    ali.error_number::text as breakdown_key,
    COUNT(*) as error_count
  FROM as_log_info ali
  JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
  WHERE ... -- (Same WHERE clauses from Scenarios 1 & 2)
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
