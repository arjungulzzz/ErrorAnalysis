
import { NextResponse } from 'next/server';
import type { FeedbackSubmission } from '@/types';
import nodemailer from 'nodemailer';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

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

// Check if localhost SMTP is available (Linux/Mac)
async function isLocalSMTPAvailable(): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: 'localhost',
      port: 25,
      secure: false,
      ignoreTLS: true,
    });
    
    await transporter.verify();
    return true;
  } catch (error) {
    return false;
  }
}

// Send email using system sendmail command (Linux/Mac)
async function sendViaSystemMail(to: string, subject: string, body: string): Promise<void> {
  const message = `To: ${to}
Subject: ${subject}
Content-Type: text/plain; charset=utf-8

${body}`;

  try {
    // Try sendmail first
    await execAsync('which sendmail');
    const sendmail = exec('sendmail -t');
    sendmail.stdin?.write(message);
    sendmail.stdin?.end();
    
    return new Promise((resolve, reject) => {
      sendmail.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`sendmail exited with code ${code}`));
        }
      });
      sendmail.on('error', reject);
    });
  } catch (error) {
    // Fallback to mail command
    const escapedSubject = subject.replace(/"/g, '\\"');
    const command = `echo "${body.replace(/"/g, '\\"')}" | mail -s "${escapedSubject}" ${to}`;
    await execAsync(command);
  }
}

// Send email using localhost SMTP (Linux/Mac)
async function sendViaLocalSMTP(to: string, subject: string, textBody: string, htmlBody: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: 'localhost',
    port: 25,
    secure: false,
    ignoreTLS: true,
  });

  await transporter.sendMail({
    from: 'feedback@localhost',
    to: to,
    subject: subject,
    text: textBody,
    html: htmlBody,
  });
}

// Send email using SMTP with credentials (Windows/fallback)
async function sendViaSMTP(to: string, subject: string, textBody: string, htmlBody: string): Promise<void> {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  
  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT, 10),
    secure: parseInt(EMAIL_PORT, 10) === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Error Dashboard Feedback" <${EMAIL_USER}>`,
    to: to,
    subject: subject,
    text: textBody,
    html: htmlBody,
  });
}

// Smart email sender that tries different methods based on platform
async function sendEmail(to: string, subject: string, textBody: string, htmlBody: string): Promise<{ success: boolean; method?: string; error?: string }> {
  const platform = os.platform();
  const isUnix = platform === 'linux' || platform === 'darwin';
  
  // On Unix-like systems, try local methods first
  if (isUnix) {
    // Try localhost SMTP first
    try {
      if (await isLocalSMTPAvailable()) {
        await sendViaLocalSMTP(to, subject, textBody, htmlBody);
        return { success: true, method: 'localhost SMTP' };
      }
    } catch (error) {
      console.log('Localhost SMTP failed:', (error as Error).message);
    }

    // Try system mail commands
    try {
      await sendViaSystemMail(to, subject, textBody);
      return { success: true, method: 'system sendmail' };
    } catch (error) {
      console.log('System sendmail failed:', (error as Error).message);
    }
  }

  // Fallback to SMTP with credentials (Windows or when local methods fail)
  try {
    await sendViaSMTP(to, subject, textBody, htmlBody);
    return { success: true, method: 'SMTP with credentials' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function POST(request: Request) {
  try {
    const feedbackData = (await request.json()) as FeedbackSubmission;

    // Log the received data to the server console as a fallback
    console.log("--- New Feedback Submission ---");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Feedback Data:", JSON.stringify(feedbackData, null, 2));
    console.log("----------------------------");

    // Get email recipient from environment
    const EMAIL_TO = process.env.EMAIL_TO;
    const platform = os.platform();
    const isWindows = platform === 'win32';

    // Check if we can send emails
    let canSendEmail = true;
    let emailError = '';

    if (isWindows) {
      // On Windows, require all SMTP environment variables
      const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
      if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
        canSendEmail = false;
        emailError = "Email configuration incomplete. On Windows, EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, and EMAIL_TO are required.";
      }
    } else {
      // On Unix-like systems, only EMAIL_TO is required (we can use system mail)
      if (!EMAIL_TO) {
        canSendEmail = false;
        emailError = "EMAIL_TO environment variable is required.";
      }
    }

    if (!canSendEmail) {
      console.warn(emailError);
      return NextResponse.json(
        { 
          message: "Feedback logged successfully, but email notification could not be sent.",
          error: emailError,
          logged: true,
          emailSent: false
        },
        { status: 200 }
      );
    }

    // Prepare email content
    const subject = `[${feedbackData.feedbackType.toUpperCase()}] New Feedback for Error Dashboard`;
    const textBody = `
A new piece of feedback has been submitted.

From: ${feedbackData.email || 'Not provided'}
Type: ${feedbackData.feedbackType}
Platform: ${platform}
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
        <p><strong>Platform:</strong> ${platform}</p>
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

    // Attempt to send email
    const emailResult = await sendEmail(EMAIL_TO, subject, textBody, htmlBody);

    if (emailResult.success) {
      console.log(`Email sent successfully via ${emailResult.method}`);
      return NextResponse.json(
        { 
          message: "Feedback submitted successfully. Thank you!",
          logged: true,
          emailSent: true,
          method: emailResult.method
        },
        { status: 200 }
      );
    } else {
      console.warn(`Failed to send email: ${emailResult.error}`);
      return NextResponse.json(
        { 
          message: "Feedback logged successfully, but email notification could not be sent.",
          error: emailResult.error,
          logged: true,
          emailSent: false
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error processing feedback:", error);
    return NextResponse.json(
      { 
        message: "An error occurred while submitting feedback.",
        error: (error as Error).message,
        logged: false,
        emailSent: false
      },
      { status: 500 }
    );
  }
}