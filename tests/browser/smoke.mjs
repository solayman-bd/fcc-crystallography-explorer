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
  const panelsFilled = (tag) => {
    for (const tab of ["learn", "calculate", "verify", "layers"]) {
      api.setState({ tab });
      if (!document.querySelector("#content").textContent.trim())
        failures.push(`${tag}/${tab}: empty panel`);
    }
  };
  const checksPass = (tag) => {
    const failed = api.verify().filter((check) => !check.pass);
    if (failed.length) failures.push(`${tag}: ${failed.map((c) => c.name).join(", ")}`);
  };
  // Choose a structure the way a user does: the selector in Crystal & unit cells.
  const chooseStructure = (key) => {
    api.setState({ topic: "crystal", workspace: "crystal" });
    const select = document.querySelector('#controls select[data-key="structure"]');
    select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    if (api.getState().structure !== key) failures.push(`structure selector: ${key}`);
  };

  // Every preset for every structure that offers it: panels filled and every check passing.
  const presetKeys = new Set();
  for (const key of ["sc", "bcc", "fcc", "hcp"]) {
    chooseStructure(key);
    const presets = [...document.querySelectorAll("[data-preset]")].map((b) => b.dataset.preset);
    for (const preset of new Set(presets)) {
      presetKeys.add(preset);
      chooseStructure(key);
      api.preset(preset);
      const structure = api.getState().structure;
      if (!["animBcc", "animHcp"].includes(preset) && structure !== key)
        failures.push(`${key} ${preset}: structure became ${structure}`);
      panelsFilled(`${key} ${preset}`);
      checksPass(`${key} ${preset}`);
    }

    // Every workspace and topic draws without errors, with the structure in the heading.
    chooseStructure(key);
    for (const [topic, workspace] of [
      ["crystal", "crystal"],
      ["geometry", "crystal"],
      ["surface", "surface"],
      ["surface", "animation"],
      ["stacking", "stacking"],
      ["environment", "crystal"],
      ["slip", "crystal"],
      ["reciprocal", "reciprocal"],
    ]) {
      api.setState({
        topic,
        workspace,
        plane: true,
        direction: true,
        neighbors: true,
        holes: "both",
        slip: true,
        allSlip: true,
        partials: true,
        ws: true,
        primitive: true,
        surface: true,
        clip: true,
      });
      panelsFilled(`${key} ${topic}/${workspace}`);
      if (!document.querySelector("#eyebrow").textContent.startsWith(key.toUpperCase()))
        failures.push(`${key} ${topic}: heading does not name the structure`);
    }

    // Exports: the unique atoms of the unit-cell supercell.
    api.setState({ N: [2, 1, 1], hexPrism: false });
    const perCell = { sc: 1, bcc: 2, fcc: 4, hcp: 2 }[key];
    const xyz = api.structure("xyz").trim().split("\n");
    if (Number(xyz[0]) !== 2 * perCell) failures.push(`${key} XYZ atom count ${xyz[0]}`);
    if (!api.structure("cif").includes("_cell_angle_gamma")) failures.push(`${key} CIF`);
    if (!api.report().includes("## Verification")) failures.push(`${key} report`);
    api.setState({ N: [1, 1, 1] });
  }

  // The HCP crystal view: the hexagonal prism (17 sites) or the unit cell (9 sites).
  chooseStructure("hcp");
  api.setState({ topic: "crystal", workspace: "crystal", hexPrism: true, mode: "closed" });
  if (api.viewer && api.viewer.count !== 17)
    failures.push(`HCP prism draws ${api.viewer.count} sites`);
  api.setState({ hexPrism: false });
  if (api.viewer && api.viewer.count !== 9)
    failures.push(`HCP unit cell draws ${api.viewer.count} sites`);

  // The five Cell ⇄ Net animations load for every structure and several planes, and the
  // Build stack fills one cell with 8 / 9 / 14 / 17 balls.
  const balls = { sc: 8, bcc: 9, fcc: 14, hcp: 17 };
  for (const structure of Object.keys(balls)) {
    for (const mode of ["deconstruct", "build", "primitive", "primToNet", "netToPrim"]) {
      for (const hkl of [
        [0, 0, 1],
        [1, 1, 1],
        [2, 1, 0],
        [1, 0, 1],
      ]) {
        api.setState({ topic: "surface", workspace: "animation", structure, animMode: mode, hkl });
        const info = api.animation();
        const tag = `${structure} ${mode} ${hkl}`;
        if (!info || info.mode !== mode || info.structure !== structure || info.total < 4)
          failures.push(`animation ${tag}`);
        if (mode === "build" && info?.ballsInCell !== balls[structure])
          failures.push(`build ${tag}: ${info?.ballsInCell} balls`);
        if (!document.querySelector("#anim-caption")?.textContent.trim())
          failures.push(`caption ${tag}`);
      }
    }
  }

  chooseStructure("fcc");
  document.querySelector("#tour").click();
  const lessons = document.querySelector("#lessons progress").max;
  for (let i = 1; i < lessons; i++) document.querySelector(`#lessons [data-lesson="${i}"]`).click();
  if (api.getState().lesson !== lessons - 1)
    failures.push(`guided tour did not reach lesson ${lessons}`);
  const xyz = api.structure("xyz").trim().split("\n");
  if (Number(xyz[0]) !== 4 * api.getState().N.reduce((a, b) => a * b))
    failures.push("XYZ atom count");
  if (!api.report().includes("## Verification")) failures.push("report");
  chooseStructure("bcc");
  const config = api.exportConfig();
  api.preset("basic");
  chooseStructure("fcc");
  api.loadConfig(JSON.parse(JSON.stringify(config)));
  if (JSON.stringify(api.getState()) !== JSON.stringify(config.state))
    failures.push("save/load round trip");
  return { presets: presetKeys.size, failures, webgl: Boolean(api.viewer) };
});
await browser.close();

console.log(`Presets checked: ${result.presets}; 3D renderer: ${result.webgl ? "yes" : "no"}`);
for (const failure of [...result.failures, ...errors]) console.error("FAIL", failure);
if (result.failures.length || errors.length) process.exit(1);
console.log("Browser smoke test passed.");
