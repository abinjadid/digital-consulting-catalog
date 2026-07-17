/* =========================================================================
 * أداة بناء البيانات المشفّرة
 * Encrypts a plaintext catalog JSON into data/catalog.enc (AES-256-GCM).
 * The plaintext file is NEVER committed — only the encrypted envelope is.
 *
 * Usage:
 *   node tools/build-data.js <plaintext-catalog.json> <password> [out.enc]
 * ========================================================================= */
var fs = require("fs");
var path = require("path");
var box = require(path.join(__dirname, "..", "js", "crypto.js"));

var src = process.argv[2];
var password = process.argv[3];
var out = process.argv[4] || path.join(__dirname, "..", "data", "catalog.enc");

if (!src || !password) {
  console.error("Usage: node tools/build-data.js <catalog.json> <password> [out.enc]");
  process.exit(1);
}

var cat = JSON.parse(fs.readFileSync(src, "utf8"));
cat.refs = cat.refs || { departments: [], owners: [], representatives: [] };

(async function () {
  var env = await box.encryptJSON(cat, password);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(env));
  console.log("✓ Wrote " + out);
  console.log("  services: " + cat.services.length + " · updatedAt: " + cat.updatedAt);
  console.log("  envelope bytes: " + fs.statSync(out).size);
})();
