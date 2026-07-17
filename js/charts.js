/* =========================================================================
 * المخططات — SVG donut (hand-drawn, no libraries)
 * ========================================================================= */
(function (root) {
  "use strict";

  function polar(cx, cy, r, ang) {
    var a = (ang - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function arcPath(cx, cy, rOuter, rInner, start, end) {
    var large = (end - start) % 360 > 180 ? 1 : 0;
    var p1 = polar(cx, cy, rOuter, end);
    var p2 = polar(cx, cy, rOuter, start);
    var p3 = polar(cx, cy, rInner, start);
    var p4 = polar(cx, cy, rInner, end);
    return [
      "M", p1[0], p1[1],
      "A", rOuter, rOuter, 0, large, 0, p2[0], p2[1],
      "L", p3[0], p3[1],
      "A", rInner, rInner, 0, large, 1, p4[0], p4[1],
      "Z"
    ].join(" ");
  }

  /* data: [{label, value, color}] ; opts: {size, thickness, centerTop, centerBottom} */
  function donut(data, opts) {
    opts = opts || {};
    var size = opts.size || 190;
    var cx = size / 2, cy = size / 2;
    var rO = size / 2 - 4;
    var th = opts.thickness || 30;
    var rI = rO - th;
    var total = data.reduce(function (s, d) { return s + d.value; }, 0) || 1;
    var gap = data.filter(function (d) { return d.value > 0; }).length > 1 ? 3 : 0; /* degrees surface gap */
    var svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img">';
    /* track */
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (rO - th / 2) + '" fill="none" stroke="var(--surface-3)" stroke-width="' + th + '"/>';
    var cursor = 0;
    data.forEach(function (d, i) {
      if (d.value <= 0) return;
      var sweep = d.value / total * 360;
      var start = cursor + gap / 2;
      var end = cursor + sweep - gap / 2;
      if (end > start) {
        svg += '<path d="' + arcPath(cx, cy, rO, rI, start, end) + '" fill="' + d.color +
               '" data-idx="' + i + '"><title>' + escXml(d.label) + ': ' + d.value + '</title></path>';
      }
      cursor += sweep;
    });
    var ct = opts.centerTop != null ? opts.centerTop : total;
    var cb = opts.centerBottom != null ? opts.centerBottom : "";
    svg += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="' + (size * 0.2) +
           '" font-weight="700" fill="var(--ink)" dominant-baseline="middle" style="font-variant-numeric:tabular-nums">' + escXml(String(ct)) + '</text>';
    if (cb) svg += '<text x="' + cx + '" y="' + (cy + size * 0.135) + '" text-anchor="middle" font-size="' + (size * 0.072) +
           '" font-weight="600" fill="var(--muted)">' + escXml(cb) + '</text>';
    svg += '</svg>';
    return svg;
  }

  function escXml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  root.Charts = { donut: donut };
})(typeof window !== "undefined" ? window : globalThis);
