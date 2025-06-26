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

The application requires the URL of your external logging service.

1.  Create a file named `.env` in the root of the project.
2.  Add the following line to the `.env` file, replacing the placeholder URL with the actual endpoint of your running service:

    ```env
    NEXT_PUBLIC_API_URL=http://localhost:8000/v1/logs
    ```

### 3. Run the Development Server

With the dependencies installed and environment variables set, you can start the application:

```bash
npm run dev
```

This will launch the Next.js development server, typically available at `http://localhost:3000`. Open this URL in your web browser to view the dashboard.

**Note:** This application is the frontend component. You must have your backend logging service running concurrently at the URL specified in your `.env` file for the dashboard to fetch and display data.

## Core Features

*   **Dynamic Data Fetching**: Retrieves error logs from a configurable backend service.
*   **Time-Based Filtering**: Filter logs by preset time ranges (e.g., "Last 4 hours") or a custom date range.
*   **Interactive Table**: Sort, filter, and view detailed log data.
*   **Data Grouping**: Group logs by common attributes like Host, Repository, or Error Code.
*   **Error Trend Visualization**: A chart that displays the frequency of errors over time.
