import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { build } from "esbuild";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const SOURCE_HTML = path.join(ROOT_DIR, "index.html");
const ENTRY_FILE = path.join(ROOT_DIR, "src", "app.js");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const DIST_HTML = path.join(DIST_DIR, "confluence-embed.html");

const SCRIPT_TAG = '<script type="module" src="./src/app.js"></script>';

function assertNoExternalReferences(html) {
  const violations = [];

  const externalAssetPattern =
    /<(?:script|link|img|iframe|audio|video|source|object|embed)\b[^>]*(?:src|href)\s*=\s*["']\s*(https?:\/\/|\/\/)/gi;
  const cssUrlPattern = /url\(\s*["']?\s*(https?:\/\/|\/\/)/gi;
  const jsImportPattern = /\bimport\s*\(\s*["']\s*(https?:\/\/|\/\/)/gi;
  const genericSrcTagPattern = /<script\b[^>]*\bsrc\s*=/gi;

  for (const pattern of [externalAssetPattern, cssUrlPattern, jsImportPattern]) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const snippet = html.slice(Math.max(0, match.index - 40), Math.min(html.length, match.index + 140));
      violations.push(snippet.replace(/\s+/g, " ").trim());
      if (violations.length > 20) {
        break;
      }
    }
  }

  let srcMatch;
  while ((srcMatch = genericSrcTagPattern.exec(html)) !== null) {
    const snippet = html.slice(Math.max(0, srcMatch.index - 40), Math.min(html.length, srcMatch.index + 120));
    violations.push(snippet.replace(/\s+/g, " ").trim());
    if (violations.length > 20) {
      break;
    }
  }

  if (violations.length) {
    const details = violations.map((item, index) => `${index + 1}. ${item}`).join("\n");
    throw new Error(
      `Externe Referenzen gefunden. Build wurde abgebrochen.\n${details}`
    );
  }
}

async function bundleAppScript() {
  const result = await build({
    entryPoints: [ENTRY_FILE],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    target: ["es2019"],
    minify: true,
    legalComments: "none"
  });

  if (!result.outputFiles?.length) {
    throw new Error("Esbuild hat keine Ausgabe erzeugt.");
  }

  return result.outputFiles[0].text;
}

async function createSingleFileHtml() {
  const [template, bundle] = await Promise.all([
    readFile(SOURCE_HTML, "utf8"),
    bundleAppScript()
  ]);

  if (!template.includes(SCRIPT_TAG)) {
    throw new Error(`Erwarteter Script-Tag nicht gefunden: ${SCRIPT_TAG}`);
  }

  const inlineScriptTag = `<script>\n${bundle}\n</script>`;
  const output = template.replace(SCRIPT_TAG, inlineScriptTag);

  assertNoExternalReferences(output);

  await mkdir(DIST_DIR, { recursive: true });
  await writeFile(DIST_HTML, output, "utf8");

  return {
    outputPath: DIST_HTML,
    bytes: Buffer.byteLength(output, "utf8")
  };
}

createSingleFileHtml()
  .then((info) => {
    console.log(`Single-file Build erfolgreich: ${info.outputPath}`);
    console.log(`Dateigroesse: ${info.bytes} bytes`);
  })
  .catch((error) => {
    console.error(`Build fehlgeschlagen: ${error.message}`);
    process.exitCode = 1;
  });
