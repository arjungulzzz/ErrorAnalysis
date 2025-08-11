import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const feedbackData = await request.json();

    // In a real application, you would process this data:
    // 1. Save it to a database (e.g., PostgreSQL, MongoDB).
    // 2. Send an email notification to your support team.
    // 3. Create an issue in a project management tool (e.g., Jira, GitHub Issues).
    // 4. Post a message to a Slack channel.

    // For this example, we will just log the received data to the server console.
    console.log("--- New Feedback Submission ---");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Feedback Data:", JSON.stringify(feedbackData, null, 2));
    console.log("----------------------------");

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
