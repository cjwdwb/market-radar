import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Use the build's real compatibility date and flags, without copying secrets or inventing runtime declarations.
if (!existsSync("dist/server/wrangler.json")) {
  console.error("Run npm run build before npm run typecheck.");
  process.exit(1);
}
mkdirSync(".wrangler/types", { recursive: true });
const env = { ...process.env, WRANGLER_LOG_PATH: ".wrangler/logs", WRANGLER_SEND_METRICS: "false" };
for (const args of [
  ["node_modules/wrangler/bin/wrangler.js", "types", ".wrangler/types/worker-configuration.d.ts", "--config", "dist/server/wrangler.json", "--include-env=false"],
  ["node_modules/typescript/bin/tsc", "--noEmit"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
