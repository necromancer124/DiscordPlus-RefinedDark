// Turns the DiscordPlus plugin on in a Vencord settings.json, so Discord opens with Discord+ enabled.
// Usage: node enable-plugin.cjs <path-to-settings.json>
// Run only while Discord is closed: Vencord rewrites this file when Discord exits.
// Writes the file the way Vencord does (JSON, 4-space indent, no BOM) and keeps a backup next to it.
"use strict";
const fs = require("fs");

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
    console.log("missing");
    process.exit(0);
}

let settings;
try {
    settings = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
} catch (e) {
    console.log("unreadable"); // never overwrite a file we can't parse
    process.exit(0);
}

settings.plugins ??= {};
settings.plugins.DiscordPlus ??= {};
if (settings.plugins.DiscordPlus.enabled === true) {
    console.log("already-enabled");
    process.exit(0);
}

fs.copyFileSync(file, file + ".discordplus-backup");
settings.plugins.DiscordPlus.enabled = true;
fs.writeFileSync(file, JSON.stringify(settings, null, 4));
console.log("enabled");
