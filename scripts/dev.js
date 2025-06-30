const { execSync } = require('child_process');

// Load environment variables from .env file
require('dotenv').config();

// Get the port from environment variables, defaulting to 3000
const port = process.env.PORT || 3000;

// Construct the command to run
const command = `next dev --turbopack -p ${port}`;

try {
  // Execute the command, inheriting stdio to see the output in the console
  console.log(`> Executing: ${command}`);
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to start Next.js server:', error);
  process.exit(1);
}
