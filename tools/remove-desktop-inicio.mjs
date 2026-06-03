import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const esDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "es");
const re =
  /(<nav class="site-header-nav[^"]*">)\s*<a[^>]+href="\/es\/index\.html">Inicio<\/a>\s*/;

let n = 0;
for (const f of fs.readdirSync(esDir)) {
  if (!f.endsWith(".html")) continue;
  const p = path.join(esDir, f);
  let h = fs.readFileSync(p, "utf8");
  if (!re.test(h)) continue;
  h = h.replace(re, "$1\n      ");
  fs.writeFileSync(p, h);
  console.log(f);
  n++;
}
console.log("removed desktop Inicio from", n, "files");
