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

### Request Body Scenarios

The `dateRange` (or `interval`) and `pagination` properties are always sent. All others are optional or have defaults.

#### 1. Basic Request (First Page, Default Sort)
This is the simplest request, fetching the first page of logs for the last 7 days.

```json
{
  "interval": "7 days",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": "none",
  "chartBreakdownBy": "host_name"
}
```

#### 2. Request with Custom Date Range
Here, we're requesting a specific date range.

```json
{
  "dateRange": {
    "from": "2023-10-26T00:00:00.000Z",
    "to": "2023-11-25T23:59:59.999Z"
  },
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": "none",
  "chartBreakdownBy": "host_name"
}
```

#### 3. Request with Pagination and Sorting
This request fetches the third page of results, sorted by `host_name` in ascending order.

```json
{
  "interval": "1 day",
  "pagination": { "page": 3, "pageSize": 100 },
  "sort": { "column": "host_name", "direction": "ascending" },
  "filters": {},
  "groupBy": "none",
  "chartBreakdownBy": "host_name"
}
```

#### 4. Request with Column Filters
This request adds filters to find logs from a specific host and for a specific error code.

```json
{
  "interval": "1 day",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {
    "host_name": "server-alpha",
    "error_number": "500"
  },
  "groupBy": "none",
  "chartBreakdownBy": "host_name"
}
```

#### 5. Request for Grouped Data
When a user selects a "Group By" option (e.g., "User"), the frontend makes a request with the `groupBy` parameter.

```json
{
  "interval": "1 day",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": "user_id",
  "chartBreakdownBy": "host_name"
}
```

#### 6. Request with a Different Chart Breakdown
The `chartBreakdownBy` parameter can be changed by the user to get different insights in the chart's tooltip.

```json
{
  "interval": "1 day",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": "none",
  "chartBreakdownBy": "repository_path"
}
```

### Expected Response Structure

The API must always return a JSON object with the following structure. If a request is for grouped data (`groupBy` is not `'none'`), the `logs` array can be empty, but `groupData` must be populated.

```json
{
  "logs": [
    {
      "log_date_time": "2023-11-21T10:30:00.000Z",
      "host_name": "server-alpha-01",
      "repository_path": "/apps/main-service",
      "port_number": 8080,
      "version_number": "1.2.3",
      "as_server_mode": "production",
      "as_start_date_time": "2023-11-21T04:30:00.000Z",
      "as_server_config": "config_A.json",
      "user_id": "user-101",
      "report_id_name": "daily_summary",
      "error_number": 500,
      "xql_query_id": "q-abcdef12",
      "log_message": "Failed to connect to database: timeout expired."
    }
  ],
  "totalCount": 12345,
  "chartData": [
    {
      "date": "2023-11-21T10:00:00.000Z",
      "count": 50,
      "formattedDate": "Nov 21",
      "breakdown": {
        "server-alpha-01": 25,
        "server-beta-02": 25
      }
    }
  ],
  "groupData": [
    {
      "key": "server-alpha-01",
      "count": 1500
    },
    {
      "key": "server-beta-02",
      "count": 980
    }
  ]
}
```
The `log_date_time` and `as_start_date_time` fields should be in ISO 8601 format, which is the standard output for timestamp data types in most database libraries.

## Core Features

*   **Dynamic Data Fetching**: Retrieves error logs from a configurable backend service.
*   **Time-Based Filtering**: Filter logs by preset time ranges (e.g., "Last 4 hours") or a custom date range.
*   **Interactive Table**: Sort, filter, and view detailed log data.
*   **Data Grouping**: Group logs by common attributes like Host, Repository, or Error Code.
*   **Error Trend Visualization**: A chart that displays the frequency of errors over time.
