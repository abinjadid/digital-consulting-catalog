/* =========================================================================
 * التشفير — AES-256-GCM مع اشتقاق المفتاح PBKDF2-SHA256
 * Works identically in the browser (SubtleCrypto) and Node 20+ (global crypto),
 * so the seed encrypted at build time decrypts client-side with the same code.
 * ========================================================================= */
(function (root) {
  "use strict";

  var ITER = 250000;
  var HASH = "SHA-256";

  var subtle = (root.crypto && root.crypto.subtle) ? root.crypto.subtle : null;
  var getRandom = function (arr) { return root.crypto.getRandomValues(arr); };

  var enc = new TextEncoder();
  var dec = new TextDecoder();

  /* ---- base64 <-> bytes (works in browser + Node) ---- */
  function bytesToB64(bytes) {
    var bin = "";
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return root.btoa(bin);
  }
  function b64ToBytes(b64) {
    var bin = root.atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(password, salt, iter, hash) {
    var baseKey = await subtle.importKey(
      "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: iter || ITER, hash: hash || HASH },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /* Encrypt a JS object -> envelope object (JSON-serialisable) */
  async function encryptJSON(obj, password) {
    var salt = getRandom(new Uint8Array(16));
    var iv = getRandom(new Uint8Array(12));
    var key = await deriveKey(password, salt, ITER, HASH);
    var plaintext = enc.encode(JSON.stringify(obj));
    var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plaintext);
    return {
      v: 1,
      kdf: "PBKDF2",
      hash: HASH,
      iter: ITER,
      salt: bytesToB64(salt),
      iv: bytesToB64(iv),
      ct: bytesToB64(new Uint8Array(ct))
    };
  }

  /* Decrypt an envelope object -> JS object. Throws on wrong password. */
  async function decryptEnvelope(env, password) {
    var salt = b64ToBytes(env.salt);
    var iv = b64ToBytes(env.iv);
    var ct = b64ToBytes(env.ct);
    var key = await deriveKey(password, salt, env.iter || ITER, env.hash || HASH);
    var plain;
    try {
      plain = await subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
    } catch (e) {
      throw new Error("BAD_PASSWORD");
    }
    return JSON.parse(dec.decode(plain));
  }

  /* ---- Password hashing for personal user-account logins (not encryption —
   * a salted one-way digest to check "did they type the right password"
   * against a value already sitting inside the encrypted catalog). ---- */
  var PW_ITER = 100000;
  async function hashPassword(password, saltB64) {
    var salt = saltB64 ? b64ToBytes(saltB64) : getRandom(new Uint8Array(16));
    var baseKey = await subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
    var bits = await subtle.deriveBits({ name: "PBKDF2", salt: salt, iterations: PW_ITER, hash: HASH }, baseKey, 256);
    return { salt: bytesToB64(salt), hash: bytesToB64(new Uint8Array(bits)) };
  }
  async function verifyPassword(password, saltB64, hashB64) {
    var r = await hashPassword(password, saltB64);
    return r.hash === hashB64;
  }

  var api = {
    encryptJSON: encryptJSON, decryptEnvelope: decryptEnvelope, bytesToB64: bytesToB64, b64ToBytes: b64ToBytes,
    hashPassword: hashPassword, verifyPassword: verifyPassword
  };
  root.CryptoBox = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
