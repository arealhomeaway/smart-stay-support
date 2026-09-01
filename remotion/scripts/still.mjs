import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
const b = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride: (c)=>c });
const browser = await openBrowser("chrome", { browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium", chromiumOptions:{args:["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]}, chromeMode:"chrome-for-testing" });
const composition = await selectComposition({ serveUrl: b, id: "opslaunch", puppeteerInstance: browser });
for (const f of process.argv.slice(2).map(Number)) {
  await renderStill({ composition, serveUrl: b, output: `/tmp/qa/f${f}.png`, frame: f, puppeteerInstance: browser });
  console.log("ok", f);
}
await browser.close({ silent: false });
