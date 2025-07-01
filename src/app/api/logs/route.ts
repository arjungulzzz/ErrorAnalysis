import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // This route is not in use, as the frontend calls the external service directly.
  // Returning a 'Not Implemented' status makes this a valid API route and prevents server errors.
  return NextResponse.json(
    { message: "This API endpoint is not operational." },
    { status: 501 } // 501 Not Implemented
  );
}
