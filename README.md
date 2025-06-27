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

The application uses environment variables for configuration. Create a file named `.env` in the root of the project to set them.

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

The dashboard communicates with the backend service via a `POST` request to the URL specified in `NEXT_PUBLIC_API_URL`.

### Request Body

The body of the `POST` request will contain either an `interval` for preset time ranges or a `dateRange` for custom selections.

#### Preset Time Ranges

For predefined time ranges, the request sends a PostgreSQL-compatible interval string.

*   **Last 4 hours:** `{ "interval": "4 hours" }`
*   **Last 8 hours:** `{ "interval": "8 hours" }`
*   **Last 1 day:** `{ "interval": "1 day" }`
*   **Last 7 days:** `{ "interval": "7 days" }`
*   **Last 15 days:** `{ "interval": "15 days" }`
*   **Last 1 month:** `{ "interval": "1 month" }`

#### Custom Date Range

For custom ranges selected via the calendar, the request sends `from` and `to` dates as ISO 8601 strings.

*   **Example:**
    ```json
    {
      "dateRange": {
        "from": "2023-10-26T00:00:00.000Z",
        "to": "2023-11-25T23:59:59.999Z"
      }
    }
    ```

### Expected Response

The API is expected to return a JSON array of error log objects. If no logs match the criteria, it should return an empty array `[]`.

#### Error Log Object Structure

Each object in the response array should conform to the following structure:

```json
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
```

The `log_date_time` and `as_start_date_time` fields should be in ISO 8601 format, which is the standard output for timestamp data types in most database libraries.

## Core Features

*   **Dynamic Data Fetching**: Retrieves error logs from a configurable backend service.
*   **Time-Based Filtering**: Filter logs by preset time ranges (e.g., "Last 4 hours") or a custom date range.
*   **Interactive Table**: Sort, filter, and view detailed log data.
*   **Data Grouping**: Group logs by common attributes like Host, Repository, or Error Code.
*   **Error Trend Visualization**: A chart that displays the frequency of errors over time.
