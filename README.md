# Firebase Studio Error Insights Dashboard

This is a Next.js application that provides a dashboard for viewing, filtering, and analyzing application error logs. It is designed to connect to an external logging service for its data.

## Getting Started

To run this project locally, follow these steps:

### 1. Install Dependencies

First, install the necessary Node.js packages using npm:

```bash
npm install
```

### 2. Configure Environment Variables

The application uses environment variables for configuration. To get started, copy the example file:

```bash
cp .env.example .env
```

Then, open the newly created `.env` file and update the variables to match your local setup.

1.  **API URL (Required)**: Add the URL for your external logging service.

    ```env
    NEXT_PUBLIC_API_URL=http://localhost:8000/v1/logs
    ```

2.  **Development Port (Optional)**: You can specify the port for the local development server. If you don't set this, it will default to port `3000`.

    ```env
    PORT=4000
    ```

### 3. Run the Development Server

With the dependencies installed and environment variables set, you can start the application:

```bash
npm run dev
```

This will launch the Next.js development server. If you set the `PORT` variable, it will use that port; otherwise, it will default to `3000`. Open the corresponding URL in your web browser to view the dashboard.

**Note:** This application is the frontend component. You must have your backend logging service running concurrently at the URL specified in your `.env` file for the dashboard to fetch and display data.

## API Interaction

The dashboard communicates with the backend service via a `POST` request to the URL specified in `NEXT_PUBLIC_API_URL`. The request body is a JSON object that can include parameters for time filtering, pagination, sorting, filtering, and data aggregation.

The `requestId` is a unique identifier generated for each request in the format `req_{epoch_timestamp}_{random_string}` to aid in server-side logging and tracking. The timestamp is the Unix epoch time in milliseconds.

The API has two primary modes of operation, determined by the `groupBy` parameter:

1.  **Fetching a List of Logs** (when `groupBy` is `[]`): This mode is for retrieving individual log rows. The backend **must apply pagination**.
2.  **Fetching Aggregated Data** (when `groupBy` is `["host_name", ...]`): This mode is for generating the nested `groupData` summary. The backend **must ignore pagination** for the grouping query.

### Request Body Scenarios

#### 1. Fetching Logs: Basic Request (First Page, Default Sort)
This is the simplest request, fetching the first page of logs for the last 7 days using a preset `interval`. `groupBy` is an empty array for a flat list of logs. Pagination should be applied.

The `chartBucket` parameter suggests the desired time granularity for the `chartData` response. For longer time ranges (e.g., 7 days or more), it will be `'day'`. For shorter ranges (e.g., 24 hours), it will be `'hour'`. The backend should use this to group chart data accordingly. The `chartBreakdownBy` parameter is no longer sent by the frontend but is left in the documentation for reference.

```json
{
  "requestId": "req_1700586000000_b3k4d5a1",
  "interval": "7 days",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": [],
  "chartBucket": "day"
}
```

**Note:** When using `interval`, the backend will receive one of the following string values, which are compatible with PostgreSQL's interval type:
- `'1 hour'`
- `'4 hours'`
- `'8 hours'`
- `'1 day'`
- `'7 days'`
- `'15 days'`
- `'1 month'`

#### 2. Fetching Logs: Request with Custom Date Range
When a user selects a custom date range from the calendar, the `dateRange` object is sent instead of `interval`. The `from` and `to` values are in ISO 8601 format.

```json
{
  "requestId": "req_1700586060000_c4l5e6b2",
  "dateRange": {
    "from": "2023-10-26T00:00:00.000Z",
    "to": "2023-11-25T23:59:59.999Z"
  },
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": [],
  "chartBucket": "day"
}
```

#### 3. Fetching Aggregated Data: Multi-Column Grouping
When a user selects "Group By" options, the frontend sends a request with an ordered array of column names in the `groupBy` parameter.

**IMPORTANT:** When the `groupBy` array is not empty, the backend service **must ignore** the `pagination` parameters for the query that generates `groupData`. The grouped summary must be calculated over the entire filtered dataset, not just one page. The response for a grouped request should **not** include individual logs inside the `groupData` structure.

```json
{
  "requestId": "req_1700586240000_f7o8h9e5",
  "interval": "1 day",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": ["host_name", "error_number"],
  "chartBucket": "hour"
}
```

#### 4. Fetching Logs: For a Specific Group (Drill-Down)
When a user expands a final-level group in the UI, the frontend makes a new request to fetch the individual logs for that group. This is an "on-demand" request that reuses the same API endpoint.

**How does the backend differentiate this from a general log request?**
The key is the content of the **`filters`** object. The frontend adds the keys of the parent groups to this object. The backend's logic is simple: apply all filters provided in the `filters` object to the `WHERE` clause. This single logic path correctly handles both general requests and specific drill-down requests.

**A drill-down request must:**
1.  Add the keys of the parent groups to the `filters` object.
2.  Send an **empty** `groupBy` array (`[]`).
3.  The `pagination` sent in this request **should be applied** by the backend, as it now applies to the list of individual logs being fetched.
4. The `chartBucket` parameter is not relevant here and will not be sent.

**Example Drill-Down Request:** This request fetches page 1 of logs where `host_name` is `'server-alpha-01'` and `error_number` is `'500'`.

```json
{
  "requestId": "req_1700586300000_g8p9i0f6",
  "interval": "1 day",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {
    "host_name": "server-alpha-01",
    "error_number": "500"
  },
  "groupBy": []
}
```

### Expected Response Structure

The API must always return a JSON object with the following structure. The contents of the `logs` and `groupData` fields depend on whether the `groupBy` parameter was provided in the request.

**Important Note on Timestamps:** The frontend does **not** perform any time conversion or formatting. The backend service is the single source of truth for time. All timestamp fields (`log_date_time`, `as_start_date_time`, and all fields in `chartData`) must be sent as **pre-formatted strings** in a consistent timezone (UTC is recommended).

#### Response for Log List Requests (`groupBy: []`)
When `groupBy` is an empty array, the response should contain the paginated list of logs and the total count of all matching logs before pagination.

- `logs`: An array of the paginated log objects.
- `totalCount`: The total number of logs matching the query filters. This is crucial for the UI's pagination controls, **both for the main table and for the drill-down sub-tables**.
- `groupData`: Must be an empty array `[]`.

To optimize performance, the `chartData` property now contains pre-aggregated breakdowns for all possible fields. The frontend will no longer request a specific breakdown; it will receive all of them and switch between them locally.

```json
{
  "logs": [
    { "log_date_time": "2023-11-21 10:30:00.123", "host_name": "server-alpha-01", "repository_path": "/models/model_a.xql", ... },
    { "log_date_time": "2023-11-21 10:28:00.456", "host_name": "server-beta-02", "repository_path": "/models/model_b.xql", ... }
  ],
  "totalCount": 5432,
  "chartData": [
    {
      "date": "2023-11-21T10:00:00.000Z",
      "fullDate": "November 21, 2023, 10:00 UTC",
      "count": 50,
      "formattedDate": "Nov 21",
      "breakdown": {
        "host_name": {
          "server-alpha-01": 25,
          "server-beta-02": 25
        },
        "error_number": {
          "500": 30,
          "404": 20
        }
      }
    }
  ],
  "groupData": []
}
```

#### Response for Grouped Requests (`groupBy: ["host_name", ...]`)
The `groupData` array contains a nested structure when `groupBy` is used. Each object contains a `key`, `count`, and a `subgroups` array for the next level of grouping.
- The `logs` property should **not** be included. It will be fetched on demand.
- For data consistency, `subgroups` should always be returned as an array, even if empty.

```json
{
  "logs": [],
  "totalCount": 12345,
  "chartData": [
    {
      "date": "2023-11-21T10:00:00.000Z",
      "fullDate": "November 21, 2023, 10:00 UTC",
      "count": 50,
      "formattedDate": "Nov 21",
      "breakdown": {
        "host_name": {
          "server-alpha-01": 25,
          "server-beta-02": 25
        },
        "error_number": {
          "503": 50
        }
      }
    }
  ],
  "groupData": [
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
      "subgroups": [
        {
          "key": "503",
          "count": 980,
          "subgroups": []
        }
      ]
    }
  ]
}
```
The `log_date_time` and `as_start_date_time` fields should be sent as pre-formatted strings, as the frontend will display them as-is.

## Core Features

*   **Dynamic Data Fetching**: Retrieves error logs from a configurable backend service.
*   **Time-Based Filtering**: Filter logs by preset time ranges (e.g., "Last 4 hours") or a custom date range.
*   **Interactive Table**: Sort, filter, and view detailed log data.
*   **Multi-Column Data Grouping**: Group logs by multiple attributes like Host, Repository, or Error Code in a nested view.
*   **Error Trend Visualization**: A chart that displays the frequency of errors over time.

    
