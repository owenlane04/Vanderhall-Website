import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public");

const files = ["404.html", "index.html", "robots.txt"];
const directories = [
  "404",
  "about",
  "assets",
  "brawley",
  "carmel",
  "concepts",
  "contact",
  "dealers",
  "faq",
  "santarosa",
  "styles",
  "vehicles",
  "venice",
];

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "scripts"), { recursive: true });

await Promise.all(files.map((file) => copyFile(resolve(root, file), resolve(output, file))));
await Promise.all(directories.map((directory) => cp(resolve(root, directory), resolve(output, directory), { recursive: true })));
await copyFile(resolve(root, "scripts/site.js"), resolve(output, "scripts/site.js"));

console.log("Prepared the static Vercel output in public/.");
