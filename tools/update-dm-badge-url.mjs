import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const oldHref = 'href="https://darkmatterwebdev.com/"';
const newHref = 'href="https://darkmatterwebdev.com/built-by"';

let count = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (!["node_modules", "all-site-images", ".git"].includes(name)) walk(full);
      continue;
    }
    if (!name.endsWith(".html")) continue;
    let html = fs.readFileSync(full, "utf8");
    if (!html.includes(oldHref)) continue;
    html = html.replaceAll(oldHref, newHref);
    fs.writeFileSync(full, html);
    console.log(path.relative(root, full));
    count++;
  }
}
walk(root);
console.log("updated", count, "html files");
