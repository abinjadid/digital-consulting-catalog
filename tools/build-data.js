/* =========================================================================
 * أداة بناء البيانات المشفّرة
 * Encrypts a plaintext catalog JSON into data/catalog.enc (AES-256-GCM).
 * The plaintext file is NEVER committed — only the encrypted envelope is.
 *
 * Usage:
 *   node tools/build-data.js <plaintext-catalog.json> <password> [out.enc] [--write-token=<github-token>]
 *
 * --write-token embeds a GitHub write token INSIDE the encrypted output, so
 * anyone who later enters the correct password gets automatic edit access
 * (see tools/set-write-token.js to add/rotate it without the plaintext source).
 * ========================================================================= */
var fs = require("fs");
var path = require("path");
var box = require(path.join(__dirname, "..", "js", "crypto.js"));

var args = process.argv.slice(2).filter(function (a) { return a.indexOf("--write-token=") !== 0; });
var tokenArg = process.argv.find(function (a) { return a.indexOf("--write-token=") === 0; });
var writeToken = tokenArg ? tokenArg.slice("--write-token=".length) : null;

var src = args[0];
var password = args[1];
var out = args[2] || path.join(__dirname, "..", "data", "catalog.enc");

if (!src || !password) {
  console.error("Usage: node tools/build-data.js <catalog.json> <password> [out.enc] [--write-token=<token>]");
  process.exit(1);
}

var cat = JSON.parse(fs.readFileSync(src, "utf8"));
cat.refs = cat.refs || { departments: [], owners: [], representatives: [] };
if (writeToken) cat.writeToken = writeToken;

(async function () {
  var env = await box.encryptJSON(cat, password);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(env));
  console.log("✓ Wrote " + out);
  console.log("  services: " + cat.services.length + " · updatedAt: " + cat.updatedAt);
  console.log("  envelope bytes: " + fs.statSync(out).size);
})();
