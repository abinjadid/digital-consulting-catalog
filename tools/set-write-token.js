/* =========================================================================
 * أداة تضمين/تحديث رمز الكتابة داخل الملف المشفّر
 * Embeds (or replaces) a GitHub write token inside the ALREADY-encrypted
 * data/catalog.enc, without ever touching a plaintext copy on disk.
 * Anyone who later enters the correct catalog password gets automatic
 * write access — no separate token entry in the app.
 *
 * Usage:
 *   node tools/set-write-token.js <catalog.enc> <password> <github-token>
 * ========================================================================= */
var fs = require("fs");
var path = require("path");
var box = require(path.join(__dirname, "..", "js", "crypto.js"));

var file = process.argv[2];
var password = process.argv[3];
var token = process.argv[4];

if (!file || !password || !token) {
  console.error("Usage: node tools/set-write-token.js <catalog.enc> <password> <github-token>");
  process.exit(1);
}

(async function () {
  var env = JSON.parse(fs.readFileSync(file, "utf8"));
  var cat = await box.decryptEnvelope(env, password);
  cat.writeToken = token;
  var newEnv = await box.encryptJSON(cat, password);
  fs.writeFileSync(file, JSON.stringify(newEnv));
  console.log("✓ Write token embedded in " + file);
  console.log("  services: " + cat.services.length + " · updatedAt: " + cat.updatedAt);
})().catch(function (e) {
  console.error("✗ Failed:", e.message);
  process.exit(1);
});
