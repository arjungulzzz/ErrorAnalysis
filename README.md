# Error Insights Dashboard

The Error Insights Dashboard is a comprehensive, web-based tool designed for viewing, filtering, and analyzing application error logs. Built with Next.js, it provides a highly interactive and performant interface that connects to an external logging service for its data.

## Core Features

- **Dynamic Data Fetching**: Retrieves and displays error logs from a configurable backend service.
- **Advanced Time-Based Filtering**: Filter logs by convenient presets (e.g., "Last 4 hours") or select a custom date range with a dual-calendar picker.
- **Interactive Data Table**: A feature-rich table that supports multi-column sorting, per-column filtering, and dynamic column visibility. Column widths are also user-resizable.
- **Multi-Column Data Grouping**: Aggregate logs by multiple attributes like Host, Model Name, or Error Code, presented in a nested, drill-down view.
- **On-Demand Loading**: For grouped data, individual logs are fetched on-demand when a group is expanded, ensuring fast initial load times.
- **Error Trend Visualization**: An interactive chart displays the frequency of errors over the selected time period, with tooltips that provide detailed breakdowns by any visible column.
- **Optimized Charting**: The chart intelligently requests data in daily or hourly buckets based on the time range and only fetches breakdown data for currently visible columns, minimizing payload size.
- **CSV Export**: Export the currently filtered and visible log data to a CSV file for offline analysis.

## Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, React Server Components)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI Library**: [React](https://react.dev/)
- **Component Library**: [ShadCN UI](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Charting**: [Recharts](https://recharts.org/)
- **State Management**: Client-side state managed with React Hooks (`useState`, `useEffect`, `useCallback`, `useTransition`).

## Project Structure

The project follows a standard Next.js App Router structure:

```
src
├── app/                  # Next.js App Router pages, layout, and API routes
├── components/           # Reusable React components
│   ├── ui/               # Core ShadCN UI components
│   ├── error-dashboard.tsx # Main stateful component managing the dashboard
│   ├── error-table.tsx     # Data table, grouping, and drill-down logic
│   └── error-trend-chart.tsx # Chart visualization component
├── hooks/                # Custom React hooks (e.g., useToast)
├── lib/                  # Utility functions (e.g., cn for classnames)
└── types/                # TypeScript type definitions for the application
```

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or a compatible package manager
- A running instance of the backend logging service.

### 1. Installation

Clone the repository and install the dependencies:

```bash
npm install
```

### 2. Environment Configuration

The application requires an environment file to connect to the backend.

1.  Copy the example file:
    ```bash
    cp .env.example .env
    ```
2.  Edit the `.env` file and set the following variables:

    -   `NEXT_PUBLIC_API_URL` (Required): The full URL of your backend logging service endpoint.
        ```env
        NEXT_PUBLIC_API_URL=http://localhost:8000/v1/logs
        ```
    -   `PORT` (Optional): The port for the local development server. Defaults to `3000`.
        ```env
        PORT=4000
        ```

### 3. Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000` (or your specified `PORT`).

## Architecture and Code Analysis

### Centralized State Management

The core of the application's state is managed within the `src/components/error-dashboard.tsx` component. This component acts as the "single source of truth" for:

-   Filters (date range, column filters, grouping)
-   Sorting and pagination state
-   Fetched data (`logs`, `groupData`, `chartData`, `totalLogs`)
-   UI state (column visibility, column widths)

This centralized approach simplifies data flow, as all data modifications are triggered from this component, which then passes down the necessary data and callbacks to its children (`ErrorTable`, `ErrorTrendChart`).

### Efficient Data Fetching with `useTransition`

All data fetching operations are wrapped in a `startTransition` call from React's `useTransition` hook. This prevents the UI from blocking while new data is being loaded. The `isPending` state returned by the hook is used to show loading indicators (skeletons, spinners) across the application, providing a responsive user experience.

### Component Responsibilities

-   **`ErrorDashboard`**: Manages all state and triggers data fetches. Renders the layout, filter controls, and passes data to child components.
-   **`ErrorTable`**: A versatile component that can render either a flat list of logs or a nested, grouped view. It handles its own internal state for expanded groups and makes on-demand requests for drill-down data via a callback function provided by `ErrorDashboard`.
-   **`ErrorTrendChart`**: A presentational component that visualizes the `chartData`. It receives all possible breakdowns from its parent and uses its own state to manage which breakdown is currently displayed in the tooltip, making the interaction instantaneous.

---

## API Contract

The frontend communicates with a single backend endpoint defined by `NEXT_PUBLIC_API_URL`.

-   **Method**: `POST`
-   **Content-Type**: `application/json`

### A Note on Timestamps and Timezones

> **Important**: The frontend application **does not perform any time conversion or formatting**. It displays the timestamp strings it receives directly from the API. The backend service is the **single source of truth** for time and is responsible for all time-related calculations and formatting.

### Request Body Parameters

| Parameter               | Type                                | Description                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `requestId`             | `string`                            | A unique ID for tracking the request (`req_{timestamp}_{random}`).                                                                                                                                           |
| `interval`              | `string` (Optional)                 | A time interval string (e.g., `'7 days'`, `'4 hours'`). Used when a preset is selected.                                                                                                                      |
| `dateRange`             | `object` (Optional)                 | An object with `from` and `to` ISO 8601 date strings. Used when a custom range is selected.                                                                                                                  |
| `pagination`            | `{ page: number, pageSize: number }`| Specifies the page and number of items to return. **The backend must ignore this for `groupData` queries.**                                                                                                  |
| `sort`                  | `{ column: string, direction: string }`| The column to sort by and the direction (`ascending` or `descending`).                                                                                                                                       |
| `filters`               | `object`                            | A key-value map for filtering columns (e.g., `{ "host_name": "server-alpha" }`).                                                                                                                             |
| `groupBy`               | `string[]`                          | An array of column names to group by. If empty, a flat list of logs is returned.                                                                                                                             |
| `chartBucket`           | `'day' \| 'hour'`                   | The desired granularity for the chart's x-axis.                                                                                                                                                              |
| `chartBreakdownFields`  | `string[]`                          | An array of column names for which the backend should pre-calculate breakdown data for the chart. **This is not needed for drill-down requests.**                                                               |

### Request & Response Scenarios

#### 1. Fetching a List of Logs (Flat View)

This is the standard request for a paginated list of logs. `groupBy` is empty. The `chartBreakdownFields` array tells the backend which breakdowns to calculate.

**Request (`/v1/logs`)**:
```json
{
  "requestId": "req_1700586000000_b3k4d5a1",
  "interval": "7 days",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": [],
  "chartBucket": "day",
  "chartBreakdownFields": ["host_name", "error_number"]
}
```

**Response**:
The response contains paginated `logs`, the `totalCount` before pagination, and `chartData` with the requested breakdowns. `groupData` is empty.

```json
{
  "logs": [
    { "log_date_time": "2023-11-21 10:30:00.123", "host_name": "server-alpha-01", "error_number": 500, "log_message": "...", ... },
    { "log_date_time": "2023-11-21 10:28:00.456", "host_name": "server-beta-02", "error_number": 404, "log_message": "...", ... }
  ],
  "totalCount": 5432,
  "chartData": [
    {
      "date": "2023-11-21T10:00:00.000Z",
      "fullDate": "November 21, 2023, 10:00 UTC",
      "count": 50,
      "formattedDate": "Nov 21",
      "breakdown": {
        "host_name": { "server-alpha-01": 25, "server-beta-02": 25 },
        "error_number": { "500": 30, "404": 20 }
      }
    }
  ],
  "groupData": []
}
```

#### 2. Fetching Aggregated Data (Grouped View)

When `groupBy` is used, the backend returns a nested `groupData` structure and must ignore `pagination` for this part of the query.

**Request (`/v1/logs`)**:
```json
{
  "requestId": "req_1700586240000_f7o8h9e5",
  "interval": "1 day",
  "pagination": { "page": 1, "pageSize": 100 },
  "sort": { "column": "log_date_time", "direction": "descending" },
  "filters": {},
  "groupBy": ["host_name", "error_number"],
  "chartBucket": "hour",
  "chartBreakdownFields": ["host_name", "repository_path"]
}
```

**Response**:
The response contains the nested `groupData`. The `logs` array must be empty, as logs will be fetched on demand. `totalCount` still reflects the total logs before grouping.

```json
{
  "logs": [],
  "totalCount": 12345,
  "chartData": [ ... ],
  "groupData": [
    {
      "key": "server-alpha-01",
      "count": 1500,
      "subgroups": [
        { "key": "500", "count": 800, "subgroups": [] },
        { "key": "404", "count": 700, "subgroups": [] }
      ]
    },
    { "key": "server-beta-02", "count": 980, "subgroups": [ ... ] }
  ]
}
```

#### 3. Fetching Logs for a Specific Group (Drill-Down)

When a user expands a final-level group, the frontend makes a new request to fetch the logs for just that group. This is achieved by adding the group's path to the `filters` object and sending an empty `groupBy` array.

**Request (`/v1/logs`)**:
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
**Note**: `chartBreakdownFields` and `chartBucket` are not sent for drill-down requests. The response for this request follows the same structure as Scenario 1, but `chartData` and `groupData` will be empty.

---

## Backend Implementation Guide

A successful implementation of the backend service is critical for the dashboard to function correctly. Please refer to the detailed SQL patterns and logic described in:

**[backend-sql-queries.md](./backend-sql-queries.md)**

This guide contains detailed information on:
-   **Time Formatting**: How to correctly format timestamps for direct display.
-   **Filtering and Sorting**: Applying filters from the request body.
-   **Pagination vs. Aggregation**: The logic for handling `groupBy` requests.
-   **Dynamic Chart Queries**: A guide with pseudocode on how to dynamically build the `chartData` query based on the `chartBreakdownFields` parameter.

## Deployment

This Next.js application is configured for deployment on **Firebase App Hosting**.

The `apphosting.yaml` file contains the basic configuration for the service.

### To Deploy:

1.  Ensure you have the [Firebase CLI](https://firebase.google.com/docs/cli) installed and are logged in.
2.  Set up a Firebase project and connect it to your local repository.
3.  Deploy using the following command:
    ```bash
    firebase deploy --only apphosting
    ```
4.  Remember to configure the necessary environment variables (like `NEXT_PUBLIC_API_URL`) in the Firebase console for your App Hosting backend.

## Available Scripts

-   `npm run dev`: Starts the development server.
-   `npm run build`: Creates a production build of the application.
-   `npm run start`: Starts the production server.
-   `npm run lint`: Runs the Next.js linter.

## Known Caveats & Future Scope

### Caveats

-   **Single API Endpoint**: The use of a single API endpoint to return different data shapes (logs vs. grouped data) can make the backend logic more complex.
-   **Initial Load Performance**: If a user makes many columns visible, the initial API call to fetch all their breakdowns could become large and slow.

### Future Scope

-   **Dedicated API Endpoints**: Refactor the backend to use separate, dedicated endpoints (e.g., `/logs`, `/groups`, `/chart`) for better separation of concerns and simpler logic.
-   **Backend Caching**: Implement a caching layer (e.g., Redis) on the backend to cache frequent queries, especially for chart and group data.
-   **Real-time Updates**: Integrate WebSockets to push new error logs to the client in real-time.
-   **User Preferences**: Allow users to save their filter, column visibility, and layout configurations.
-   **Advanced Analytics**: Introduce more complex visualizations and statistical analysis of error patterns.
