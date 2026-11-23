#!/usr/bin/env node
/* Copy the web desk into www/ for the Android wrapper. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dest = path.join(root, "www");

const entries = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "css",
  "js",
  "icons",
  "vendor",
];

function rm(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copy(src, out) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(out, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === "." || name === "..") continue;
      copy(path.join(src, name), path.join(out, name));
    }
  } else {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(src, out);
  }
}

rm(dest);
fs.mkdirSync(dest, { recursive: true });
for (const rel of entries) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) continue;
  copy(src, path.join(dest, rel));
}
console.log("Synced web assets into www/");
