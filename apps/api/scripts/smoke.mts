// Fumaça do bootstrap real (main.ts via tsx, sem decorator metadata): sobe a API e exige GET /api/v1/health 200.
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const TIMEOUT_MS = 30_000;

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  if (address === null || typeof address === "string") throw new Error("sem porta livre");
  return address.port;
}

async function healthStatus(port: number): Promise<number | undefined> {
  try {
    return (await fetch(`http://127.0.0.1:${port.toString()}/api/v1/health`)).status;
  } catch {
    return undefined;
  }
}

const port = await freePort();
const child = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "--eval",
    "import('./src/main.ts').then((m) => m.bootstrap(process.env)).catch((e) => { console.error(e); process.exit(1); })",
  ],
  { env: { ...process.env, PILLA_API_PORT: port.toString() }, stdio: ["ignore", "inherit", "inherit"] },
);
const state = { exited: false };
child.on("exit", () => {
  state.exited = true;
});

const deadline = Date.now() + TIMEOUT_MS;
let status: number | undefined;
while (Date.now() < deadline && !state.exited) {
  status = await healthStatus(port);
  if (status === 200) break;
  await new Promise((resolve) => setTimeout(resolve, 300));
}
child.kill("SIGTERM");
if (status !== 200) {
  process.stderr.write(`smoke falhou: health=${String(status)} processoEncerrou=${String(state.exited)}\n`);
  process.exit(1);
}
process.stdout.write("smoke ok: GET /api/v1/health 200\n");
