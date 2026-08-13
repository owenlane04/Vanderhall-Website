import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public");

const files = ["404.html", "index.html", "robots.txt", "site.webmanifest", "sitemap.xml"];
// Every built route directory, alphabetical. V13 adds blog, careers, contact, experience and safety;
// santarosa already appears and now also carries the nested launch-edition route beneath it.
const directories = [
  "404",
  "assets",
  "blog",
  "brawley",
  "careers",
  "carmel",
  "concepts",
  "contact",
  "dealer-inquiry",
  "dealers",
  "experience",
  "owners",
  "privacy",
  "recommend-dealer",
  // V21-A. A new TOP-LEVEL route directory, so it has to be named here; the two reservation status
  // pages added at the same time nest under brawley/ and santarosa/ and are copied with them.
  "reservation-status",
  "safety",
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
