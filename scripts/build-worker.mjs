import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// OpenNext appends environment exports when reusing its output directory.
// Clear Next's cached output as well: incomplete legacy manifests must never
// make it into a production Worker or the standalone Node server.
rmSync(".next", { recursive: true, force: true });
rmSync(".open-next", { recursive: true, force: true });
const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "opennextjs-cloudflare", "build"],
  { stdio: "inherit", shell: process.platform === "win32" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
if (result.status === 0) {
  // Some adapter build paths append each mode twice. Keep identical exports
  // once, and fail rather than silently choose conflicting configuration.
  const envFile = ".open-next/cloudflare/next-env.mjs";
  if (existsSync(envFile)) {
    const exports = new Map();
    const lines = readFileSync(envFile, "utf8").split("\n").filter(Boolean);
    const normalized = lines.filter((line) => {
      const match = line.match(
        /^export const (production|development|test) = (.*);$/,
      );
      if (!match) return true;
      JSON.parse(match[2]);
      const previous = exports.get(match[1]);
      if (previous && previous !== line)
        throw new Error(
          "Conflicting generated environment exports. Review the build configuration.",
        );
      exports.set(match[1], line);
      return !previous;
    });
    writeFileSync(envFile, normalized.join("\n") + "\n");
  }
}
