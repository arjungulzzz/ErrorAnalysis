# **App Name**: Error Insights Dashboard

## Core Features:

- Tabular Display: Display error logs in a sortable, searchable tabular format.
- Repository Path Filter: Implement real-time filtering based on repository path, specified by the user via a text field.
- Date Range Filtering: Provide pre-defined time range filters (Last 4 hours, 8 hours, 1 day, 1 week) and a custom date range selector for log data.
- Data Fetching API: Service endpoint that retrieves paginated and filtered error data based on repository path and time range.
- Anomaly Detection: Visually highlight unusual error patterns by highlighting frequent errors using clustering and outlier detection - leveraging generative AI as a tool to determine what information to highlight and when to highlight it, based on various heuristics.

## Style Guidelines:

- Primary color: Deep purple (#6750A4) to convey seriousness and insight.
- Background color: Light grey (#F2F0F4) to provide a neutral backdrop.
- Accent color: Teal (#00A3A3) for interactive elements and highlights.
- Body and headline font: 'Inter' sans-serif font for readability.
- Simple, consistent icons for filtering and sorting actions.
- Clean, grid-based layout with clear separation of filters and data table.
- Subtle animations on data load and filter interactions to provide user feedback.