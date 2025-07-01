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

### Request Body Scenarios

The `requestId`, `dateRange` (or `interval`), and `pagination` properties are always sent. All others are optional or have defaults.

#### 1. Basic Request (First Page, Default Sort)
This is the simplest request, fetching the first page of logs for the last 7 days. `groupBy` is an empty array for a flat list of logs. Pagination should be applied.

```json
{
  "requestId": "req_1700586000000_b3k4d5a1",
  "interval": "7 days",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": [],
  "chartBreakdownBy": "host_name"
}
```

#### 2. Request with Custom Date Range
Here, we're requesting a specific date range.

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
  "chartBreakdownBy": "host_name"
}
```

#### 3. Request for Multi-Column Grouped Data
When a user selects "Group By" options, the frontend sends a request with an ordered array of column names in the `groupBy` parameter.

**IMPORTANT:** When the `groupBy` array is not empty, the backend service **must ignore** the `pagination` parameters for the query that generates `groupData`. The grouped summary must be calculated over the entire filtered dataset, not just one page.

```json
{
  "requestId": "req_1700586240000_f7o8h9e5",
  "interval": "1 day",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": ["host_name", "error_number"],
  "chartBreakdownBy": "host_name"
}
```

### Expected Response Structure

The API must always return a JSON object with the following structure. When a request is for grouped data (`groupBy` is not an empty array), the top-level `logs` array can be empty, as the UI will be populated from `groupData`.

#### `groupData` Structure
The `groupData` array contains a nested structure when `groupBy` is used. Each object contains a `key`, `count`, a `subgroups` array for the next level of grouping, and a `logs` array.
- The `logs` property is optional and should contain the individual log entries for the *deepest* level of a group hierarchy.
- For data consistency, `subgroups` and `logs` should always be returned as arrays, even if they are empty.

```json
{
  "logs": [
    /* This can be empty when groupData is populated */
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
      "count": 1500,
      "subgroups": [
        {
          "key": "500",
          "count": 800,
          "subgroups": [],
          "logs": [
            { "log_date_time": "...", "host_name": "server-alpha-01", "error_number": 500, "..." }
          ]
        },
        {
          "key": "404",
          "count": 700,
          "subgroups": [],
          "logs": []
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
          "subgroups": [],
          "logs": []
        }
      ]
    }
  ]
}
```
The `log_date_time` and `as_start_date_time` fields should be in ISO 8601 format, which is the standard output for timestamp data types in most database libraries.

## Core Features

*   **Dynamic Data Fetching**: Retrieves error logs from a configurable backend service.
*   **Time-Based Filtering**: Filter logs by preset time ranges (e.g., "Last 4 hours") or a custom date range.
*   **Interactive Table**: Sort, filter, and view detailed log data.
*   **Multi-Column Data Grouping**: Group logs by multiple attributes like Host, Repository, or Error Code in a nested view.
*   **Error Trend Visualization**: A chart that displays the frequency of errors over time.
