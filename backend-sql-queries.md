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

### Scenario 4: Applying Pagination

Use `LIMIT` and `OFFSET` to fetch the correct page of data.

**Example Request: `{ "pagination": { "page": 3, "pageSize": 100 } }`**

```sql
-- Appended at the very end of the query:
LIMIT $5 OFFSET $6

-- Parameter $5 (LIMIT) would be: 100
-- Parameter $6 (OFFSET) would be: 200 (calculated as (page - 1) * pageSize)
```

---

### Aggregation Queries

These queries run separately to calculate `totalCount`, `groupData`, and `chartData`. They must use the **same `WHERE` clauses** from scenarios 1 and 2 to ensure the aggregations match the filtered dataset.

**1. `totalCount` Query:**

Calculates the total number of matching records before pagination.

```sql
SELECT COUNT(*)
FROM as_log_info ali
JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
WHERE ... -- (Same WHERE clauses from Scenarios 1 & 2)
```

**2. `groupData` Query (Multi-Column Grouping):**

When `groupBy` is an array (e.g., `["host_name", "error_number"]`), the query becomes more complex. It needs to generate a hierarchical JSON structure. The following is a conceptual example using a recursive CTE in PostgreSQL. The exact implementation will depend on the number of group levels and database dialect.

```sql
-- Example for: { "groupBy": ["host_name", "error_number"] }

-- NOTE: This is a conceptual query. A production implementation would need to
-- dynamically generate the CTEs based on the length and contents of the 'groupBy' array.
-- All 'groupBy' column names MUST be validated against a whitelist to prevent SQL injection.

WITH RECURSIVE
  -- Define the hierarchy of grouping columns
  grouping_levels (level, col_name) AS (
    VALUES (1, 'host_name'), (2, 'error_number')
  ),
  -- Aggregate data at each level
  grouped_data AS (
    SELECT
      g.level,
      -- Create an array of group keys for the current path, e.g., [server-alpha, 500]
      ARRAY_AGG(
        CASE
          WHEN g2.col_name = 'host_name' THEN asli.host_name
          WHEN g2.col_name = 'error_number' THEN ali.error_number::text
          -- Add other whitelisted columns here
        END
      ) OVER (PARTITION BY g.level ORDER BY
        CASE WHEN g2.col_name = 'host_name' THEN asli.host_name END,
        CASE WHEN g2.col_name = 'error_number' THEN ali.error_number::text END
      ) as group_path,
      COUNT(*) AS count
    FROM as_log_info ali
    JOIN as_start_log_info asli ON ali.as_instance_id = asli.as_instance_id
    CROSS JOIN grouping_levels g
    JOIN grouping_levels g2 ON g2.level <= g.level
    WHERE ... -- (Apply same time and column filters)
    GROUP BY g.level, group_path
  ),
  -- Build the JSON hierarchy
  json_hierarchy AS (
    SELECT
      level,
      group_path[level] as key,
      (SELECT array_to_json(group_path[1:level-1])) as parent_path,
      count,
      (
        SELECT jsonb_agg(sub)
        FROM (
          SELECT s.group_path[s.level] as key, s.count, s.subgroups
          FROM json_hierarchy s
          WHERE s.level = h.level + 1 AND s.group_path[1:h.level] = h.group_path
        ) sub
      ) as subgroups
    FROM grouped_data h
  )
SELECT key, count, subgroups
FROM json_hierarchy
WHERE level = 1; -- Select only the top-level groups
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
