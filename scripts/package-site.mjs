import { cpSync, copyFileSync, mkdirSync, rmSync } from "node:fs";

// Convert the bundled OpenNext output into the Sites Worker artifact layout.
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/server", { recursive: true });
mkdirSync("dist/.openai", { recursive: true });
copyFileSync(".open-next/bundle/worker.js", "dist/server/index.js");
cpSync(".open-next/assets", "dist/client", { recursive: true });
copyFileSync(".openai/hosting.json", "dist/.openai/hosting.json");
console.log("Sites Worker and static assets are ready.");
