#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");

const UVICORN_ARGS = [
  "-m",
  "uvicorn",
  "backend.app:app",
  "--reload",
  "--host",
  "127.0.0.1",
  "--port",
  "8001",
];

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

function startBackend() {
  const { command, args } = resolvePythonCommand();
  const child = spawn(command, [...args, ...UVICORN_ARGS], {
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

startBackend();
