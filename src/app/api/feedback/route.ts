import { NextResponse } from 'next/server';
import type { FeedbackSubmission } from '@/types';
import nodemailer from 'nodemailer';

// Helper function to format the application state for the email body
const formatApplicationState = (state: FeedbackSubmission['applicationState']) => {
  let output = 'Application State:\n';
  output += `  - Active Tab: ${state.activeTab}\n`;
  output += `  - Page: ${state.page}\n`;
  if (state.dateRange?.from) {
    output += `  - Date Range: ${new Date(state.dateRange.from).toISOString()} to ${state.dateRange.to ? new Date(state.dateRange.to).toISOString() : '...'}\n`;
  }
  if (state.selectedPreset) {
    output += `  - Time Preset: ${state.selectedPreset}\n`;
  }
  if (state.groupBy.length > 0) {
    output += `  - Grouped By: ${state.groupBy.join(', ')}\n`;
  }
  if (state.sort.column) {
    output += `  - Sorted By: ${state.sort.column} (${state.sort.direction})\n`;
  }
  if (Object.keys(state.columnFilters).length > 0) {
    output += '  - Filters:\n';
    for (const [key, filter] of Object.entries(state.columnFilters)) {
      output += `    - ${key}: ${filter.operator.toUpperCase()} [${filter.values.join(', ')}]\n`;
    }
  }
  output += `  - Visible Columns: ${state.visibleColumns.join(', ')}\n`;
  output += `  - Last Request ID: ${state.latestRequestId}\n`;
  return output;
};

// Helper function to format the user environment for the email body
const formatUserEnvironment = (env: FeedbackSubmission['userEnvironment']) => {
  let output = 'User Environment:\n';
  output += `  - URL: ${env.url}\n`;
  output += `  - Browser: ${env.userAgent}\n`;
  output += `  - Viewport: ${env.viewport}\n`;
  output += `  - Screen Resolution: ${env.screenResolution}\n`;
  return output;
};

export async function POST(request: Request) {
  try {
    const feedbackData = (await request.json()) as FeedbackSubmission;

    // Log the received data to the server console as a fallback
    console.log("--- New Feedback Submission ---");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Feedback Data:", JSON.stringify(feedbackData, null, 2));
    console.log("----------------------------");

    // Check for necessary environment variables
    const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_TO } = process.env;
    if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
      console.warn("Email configuration is incomplete. Skipping email notification.");
      // Still return a success to the user, as the feedback was logged.
      return NextResponse.json(
        { message: "Feedback submitted successfully. Thank you!" },
        { status: 200 }
      );
    }

    // Create a transporter object using SMTP transport
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT, 10),
      secure: parseInt(EMAIL_PORT, 10) === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    // Prepare email content
    const subject = `[${feedbackData.feedbackType.toUpperCase()}] New Feedback for Error Dashboard`;
    const textBody = `
A new piece of feedback has been submitted.

From: ${feedbackData.email || 'Not provided'}
Type: ${feedbackData.feedbackType}
--------------------------------
Description:
${feedbackData.description}
--------------------------------

${formatApplicationState(feedbackData.applicationState)}
--------------------------------

${formatUserEnvironment(feedbackData.userEnvironment)}
`;

    const htmlBody = `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>New Feedback Submission</h2>
        <p><strong>From:</strong> ${feedbackData.email || 'Not provided'}</p>
        <p><strong>Type:</strong> <span style="text-transform: capitalize; font-weight: bold;">${feedbackData.feedbackType}</span></p>
        <hr>
        <h3>Description</h3>
        <p style="white-space: pre-wrap;">${feedbackData.description}</p>
        <hr>
        <h3>Application State</h3>
        <pre style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; white-space: pre-wrap;">${formatApplicationState(feedbackData.applicationState)}</pre>
        <hr>
        <h3>User Environment</h3>
        <pre style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; white-space: pre-wrap;">${formatUserEnvironment(feedbackData.userEnvironment)}</pre>
      </div>
    `;

    // Send mail with defined transport object
    await transporter.sendMail({
      from: `"Error Dashboard Feedback" <${EMAIL_USER}>`,
      to: EMAIL_TO,
      subject: subject,
      text: textBody,
      html: htmlBody,
    });

    return NextResponse.json(
      { message: "Feedback submitted successfully. Thank you!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing feedback:", error);
    return NextResponse.json(
      { message: "An error occurred while submitting feedback." },
      { status: 500 }
    );
  }
}
