#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { findAvailablePort } = require("./port-utils.cjs");

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      if (!key || process.env[key] !== undefined) continue;

      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
}

function commandExists(command, args = ["--version"]) {
  const check = spawnSync(command, args, {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return check.status === 0;
}

function resolvePythonCommand() {
  // Allow explicit override when users have multiple Python installs.
  if (process.env.PYTHON_EXECUTABLE) {
    return { command: process.env.PYTHON_EXECUTABLE, args: [] };
  }

  if (process.platform === "win32") {
    if (commandExists("py", ["-3", "--version"])) {
      return { command: "py", args: ["-3"] };
    }
    if (commandExists("python")) {
      return { command: "python", args: [] };
    }
    return { command: "python3", args: [] };
  }

  if (commandExists("python3")) {
    return { command: "python3", args: [] };
  }
  return { command: "python", args: [] };
}

async function startBackend() {
  loadLocalEnv();
  const { command, args } = resolvePythonCommand();

  const port = await findAvailablePort(process.env.BACKEND_PORT, {
    host: "127.0.0.1",
  });

  process.env.BACKEND_PORT = String(port);

  const child = spawn(command, [
    ...args,
    "-m",
    "uvicorn",
    "backend.app:app",
    "--reload",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("error", (error) => {
    console.error("Failed to start backend.");
    console.error(
      "Set PYTHON_EXECUTABLE to a valid Python path or install Python 3 and dependencies from backend/requirements.txt."
    );
    console.error(error.message);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

startBackend().catch((error) => {
  console.error("Failed to start backend.");
  console.error(error.message);
  process.exit(1);
});
