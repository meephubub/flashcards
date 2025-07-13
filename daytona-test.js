import { Daytona } from '@daytonaio/sdk';

async function main() {
  // Initialize the SDK (uses environment variables by default)
  const daytona = new Daytona();

  // Create a new sandbox
  const sandbox = await daytona.create({
    language: 'typescript',
    envVars: { NODE_ENV: 'development' }
  });

  // Execute a command
  const response = await sandbox.process.executeCommand('echo "Hello, World!"');
  console.log(response.result);
}

main().catch(console.error);