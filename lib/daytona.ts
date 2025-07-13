import { Daytona, DaytonaConfig } from '@daytonaio/sdk';

const daytona = new Daytona(); // Initialize with environment variables by default

export async function createDaytonaSandbox(
  image: string,
  envVars?: Record<string, string>
) {
  const sandbox = await daytona.create({
    image,
    envVars,
  });
  // Wait for the sandbox to be ready
  await sandbox.waitUntilStarted();
  return sandbox;
}

export async function executeDaytonaCommand(
  sandboxId: string,
  command: string
) {
  const sandbox = await daytona.get(sandboxId);
  if (!sandbox) {
    throw new Error(`Sandbox with ID ${sandboxId} not found.`);
  }
  await sandbox.waitUntilStarted(); // Ensure sandbox is started before executing
  const response = await sandbox.process.executeCommand(command);
  return response;
}

export async function getDaytonaSandbox(sandboxId: string) {
  const sandbox = await daytona.get(sandboxId);
  return sandbox;
}

export async function stopDaytonaSandbox(sandboxId: string) {
  const sandbox = await daytona.get(sandboxId);
  if (!sandbox) {
    throw new Error(`Sandbox with ID ${sandboxId} not found.`);
  }
  await daytona.stop(sandbox);
} 