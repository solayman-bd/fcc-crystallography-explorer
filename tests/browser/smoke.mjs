// Browser smoke test for the built single-file app.
//
//   npm run build
//   npm run test:browser            (uses installed Chrome or Edge)
//
// If neither browser is installed: npx playwright install chromium
import { chromium } from "playwright";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const file = resolve(process.argv[2] ?? "dist/FCC-Explorer.html");

async function launch() {
  for (const channel of ["chrome", "msedge", undefined]) {
    try {
      return await chromium.launch({
        channel,
        args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
      });
    } catch {
      // try the next browser
    }
  }
  throw new Error("No browser available. Run: npx playwright install chromium");
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => window.FCC_EXPLORER);

const result = await page.evaluate(async () => {
  const api = window.FCC_EXPLORER;
  const failures = [];
  const presets = [...document.querySelectorAll("[data-preset]")].map((b) => b.dataset.preset);
  for (const key of new Set(presets)) {
    api.preset(key);
    for (const tab of ["learn", "calculate", "verify", "layers"]) {
      api.setState({ tab });
      if (!document.querySelector("#content").textContent.trim())
        failures.push(`${key}/${tab}: empty panel`);
    }
    const failed = api.verify().filter((check) => !check.pass);
    if (failed.length) failures.push(`${key}: ${failed.map((c) => c.name).join(", ")}`);
  }
  document.querySelector("#tour").click();
  for (let i = 1; i < 12; i++) document.querySelector(`#lessons [data-lesson="${i}"]`).click();
  if (api.getState().lesson !== 11) failures.push("guided tour did not reach lesson 12");
  const xyz = api.structure("xyz").trim().split("\n");
  if (Number(xyz[0]) !== 4 * api.getState().N.reduce((a, b) => a * b))
    failures.push("XYZ atom count");
  if (!api.report().includes("## Verification")) failures.push("report");
  const config = api.exportConfig();
  api.preset("basic");
  api.loadConfig(JSON.parse(JSON.stringify(config)));
  if (JSON.stringify(api.getState()) !== JSON.stringify(config.state))
    failures.push("save/load round trip");
  return { presets: new Set(presets).size, failures, webgl: Boolean(api.viewer) };
});
await browser.close();

console.log(`Presets checked: ${result.presets}; 3D renderer: ${result.webgl ? "yes" : "no"}`);
for (const failure of [...result.failures, ...errors]) console.error("FAIL", failure);
if (result.failures.length || errors.length) process.exit(1);
console.log("Browser smoke test passed.");
