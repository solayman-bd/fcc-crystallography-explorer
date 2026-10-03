// Build the single-file offline app.
// esbuild bundles src/app.js (with Three.js) into one minified script, which is then
// inlined, together with the stylesheet and the license notices, into src/index.html.
//
//   node build.mjs                      -> dist/FCC-Explorer.html
//   node build.mjs path/to/output.html  -> custom output path
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");
const output = resolve(root, process.argv[2] ?? "dist/FCC-Explorer.html");

const result = await build({
  entryPoints: [resolve(root, "src/app.js")],
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2022",
  legalComments: "inline",
  write: false,
});

const parts = {
  LICENSE: read("LICENSE") + "\n\n" + read("THIRD_PARTY_NOTICES.md"),
  CSS: read("src/styles.css"),
  JS: result.outputFiles[0].text,
};
const html = read("src/index.html").replace(/\{\{(\w+)\}\}/g, (_, key) => parts[key]);

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(`Wrote ${output} (${Math.round(html.length / 1024)} kB)`);
