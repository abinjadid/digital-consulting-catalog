/* =========================================================================
 * دليل الخدمات الاستشارية الرقمية — صفحة المستفيد
 *
 * مصدر البيانات: نفس ملف الكتالوج المشفّر الذي يديره فريق العمل، فأي تحديث
 * يظهر هنا فور حفظه. لكن هذه الصفحة:
 *   1) لا تقرأ من الملف إلا قائمة الخدمات (لا حسابات ولا رمز كتابة ولا طلبات)،
 *   2) تُبقي الخدمات «المفعلة» فقط — المتوقفة وقيد التفعيل وجاري التحليل تُخفى،
 *   3) تنسخ حقولًا معتمدة للمستفيد فقط (لا مالك ولا ممثل ولا إدارة داخلية).
 * ========================================================================= */
(function () {
  "use strict";

  var C = window.CONFIG, ICON = window.ICON, Box = window.CryptoBox;
  var PUBLIC_STATUSES = C.publicStatuses || ["مفعلة"];
  var REQUEST_URL = C.requestUrl || "https://digitalconsultation.dga.gov.sa/ords/r/cons/consultation_external/login-page";

  var STAGE_ORDINAL = { "التخطيط": "المرحلة الأولى", "التنفيذ": "المرحلة الثانية", "التوسع": "المرحلة الثالثة" };
  var CAT_ICON = {
    "الاستراتيجيات الرقمية": "flag",
    "تخطيط وتمكين البنية التقنية": "layers",
    "الابتكار والتقنيات الناشئة": "sparkles",
    "التميز المؤسسي واستمرارية الأعمال": "building2",
    "الاستثمار والخدمات الرقمية": "briefcase",
    "البيانات والتكامل": "grid",
    "مؤشرات الأداء الرقمي": "target",
    "أخرى": "tag"
  };
  var CAT_ORDER = C.taxonomy.categories.slice();

  var ALL = [];                 /* الخدمات المتاحة للمستفيد فقط */
  var UPDATED = "";
  var S = { stage: "", category: "", q: "" };
  var QTOKENS = [];

  /* ---------------- helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function one(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }
  function multi(v) { return String(v == null ? "" : v).replace(/\r/g, "").trim(); }
  function list(v) { return (Array.isArray(v) ? v : []).map(one).filter(Boolean); }
  /* تطبيع عربي للبحث: يتجاهل التشكيل واختلاف الهمزات والتاء المربوطة والألف المقصورة */
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  }
  function fmtDate(iso) {
    var m = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    var p = String(iso || "").split("-");
    if (p.length < 3 || !m[+p[1] - 1]) return "";
    return (+p[2]) + " " + m[+p[1] - 1] + " " + p[0];
  }
  function stageOf(key) {
    for (var i = 0; i < C.stages.length; i++) if (C.stages[i].key === key) return C.stages[i];
    return null;
  }
  /* كل عنصر ملوّن يحمل زوجًا فاتحًا/داكنًا (--cl / --cdk) ويختار CSS منه حسب المظهر،
   * فلا حاجة لإعادة رسم أي شيء عند التبديل بين الوضعين. */
  function cv(l, d) { return "--cl:" + l + ";--cdk:" + (d || l); }
  function stageCV(key) { var s = stageOf(key); return s ? cv(s.color, s.colorDark) : cv("#667085", "#98a2b3"); }
  function catCV(cat) {
    var i = CAT_ORDER.indexOf(cat);
    if (i < 0) { CAT_ORDER.push(cat); i = CAT_ORDER.length - 1; }
    var L = C.palette.light, D = C.palette.dark;
    return cv(L[i % L.length], D[i % D.length]);
  }
  function catIcon(cat) { return CAT_ICON[cat] || "tag"; }
  function byId(id) { for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i]; return null; }

  /* ---------------- data layer ---------------- */
  function b64Utf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  /* GitHub Contents API أولًا: نسخة GitHub Pages متأخرة (تُحدَّث بعد إعادة بناء ثم
   * تبقى خلف ذاكرة مؤقتة 10 دقائق)، بينما الـAPI حيّ. نسخة Pages احتياطٌ فقط
   * لحالة انقطاع الـAPI أو بلوغ حدّ الطلبات بلا مصادقة. */
  function loadEnvelope() {
    var g = C.github;
    var api = "https://api.github.com/repos/" + g.owner + "/" + g.repo + "/contents/" + g.dataPath +
      "?ref=" + g.branch + "&t=" + Date.now();
    return fetch(api, { headers: { "Accept": "application/vnd.github+json" }, cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("API_" + r.status); return r.json(); })
      .then(function (j) { if (!j.content) throw new Error("API_EMPTY"); return JSON.parse(b64Utf8(j.content)); })
      .catch(function () {
        return fetch("../data/catalog.enc?t=" + Date.now(), { cache: "no-store" })
          .then(function (r) { if (!r.ok) throw new Error("DATA_FETCH_FAILED"); return r.json(); });
      });
  }

  function isPublic(s) {
    return !!one(s.title) && PUBLIC_STATUSES.indexOf(C.normalizeStatus(s.status)) >= 0;
  }
  /* قائمة بيضاء: هذه هي الحقول الوحيدة التي تغادر طبقة البيانات */
  function toPublic(s) {
    var raw = one(s.title);
    var isNew = /^\(\s*جديد\s*\)/.test(raw);
    var title = raw.replace(/^\(\s*جديد\s*\)\s*/, "");
    var o = {
      id: +s.id,
      title: title,
      isNew: isNew,
      category: one(s.category) || "أخرى",
      stage: one(s.stage),
      sla: one(s.sla),
      beneficiaries: list(s.beneficiaries),
      objectives: list(s.objectives),
      description: multi(s.description),
      goals: multi(s.goals),
      prerequisites: multi(s.prerequisites),
      outputs: multi(s.outputs)
    };
    /* اسم مختصر للبطاقة (الاسم الكامل يظهر في النافذة) */
    o.short = title.replace(/^خدمة الدعم الاستشاري\s*(في|لـ|ل)?\s*/, "").trim() || title;
    o.hay = norm([o.title, o.category, o.description, o.goals, o.outputs, o.beneficiaries.join(" "), o.objectives.join(" ")].join(" "));
    return o;
  }

  function load() {
    return loadEnvelope()
      .then(function (env) { return Box.decryptEnvelope(env, C.catalogKey); })
      .then(function (cat) {
        var services = Array.isArray(cat.services) ? cat.services : [];
        UPDATED = one(cat.updatedAt);
        var order = C.stages.map(function (s) { return s.key; });
        ALL = services.filter(isPublic).map(toPublic).sort(function (a, b) {
          var d = order.indexOf(a.stage) - order.indexOf(b.stage);
          return d || a.short.localeCompare(b.short, "ar");
        });
        /* لا نُبقي أي مرجع للكتالوج الكامل (حسابات/رمز كتابة/طلبات) */
        cat = null; services = null;
      });
  }

  /* ---------------- filtering ---------------- */
  function match(s, skip) {
    if (skip !== "stage" && S.stage && s.stage !== S.stage) return false;
    if (skip !== "category" && S.category && s.category !== S.category) return false;
    if (skip !== "q") for (var i = 0; i < QTOKENS.length; i++) if (s.hay.indexOf(QTOKENS[i]) < 0) return false;
    return true;
  }
  function matching(skip) { return ALL.filter(function (s) { return match(s, skip); }); }
  function countBy(field, value, skip) {
    return ALL.filter(function (s) { return match(s, skip) && s[field] === value; }).length;
  }

  /* ---------------- render: static parts ---------------- */
  function renderShell() {
    $("#brand-mark").innerHTML = ICON("briefcase");
    $("#search-ic").innerHTML = ICON("search");
    $("#gov-ext").innerHTML = ICON("external");
    $("#login-btn").insertAdjacentHTML("afterbegin", ICON("user"));
    $("#foot-ic").innerHTML = ICON("unlock");
    $("#ic-stages").innerHTML = ICON("flag");
    $("#ic-cats").innerHTML = ICON("layers");
    $("#ic-grid").innerHTML = ICON("grid");
    $all(".crumbs .sep").forEach(function (e) { e.setAttribute("aria-hidden", "true"); });
  }

  function categories() {
    var seen = {}, out = [];
    ALL.forEach(function (s) { if (!seen[s.category]) { seen[s.category] = 1; out.push(s.category); } });
    out.sort(function (a, b) {
      var ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    return out;
  }

  function renderStats() {
    var cats = categories().length;
    var stages = C.stages.filter(function (st) { return ALL.some(function (s) { return s.stage === st.key; }); }).length;
    $("#hero-stats").innerHTML =
      '<div class="stat"><b>' + ALL.length + '</b><span>خدمة استشارية</span></div>' +
      '<div class="stat"><b>' + cats + '</b><span>فئات تخصصية</span></div>' +
      '<div class="stat"><b>' + stages + '</b><span>مراحل تحول</span></div>';
    var hc = $("#h-count"), hk = $("#h-cats");
    hc.textContent = ALL.length + " خدمة"; hc.hidden = false;
    hk.textContent = cats + " فئات"; hk.hidden = false;
  }

  function renderStages() {
    var total = ALL.length;
    $("#stage-grid").innerHTML = C.stages.map(function (st) {
      var n = ALL.filter(function (s) { return s.stage === st.key; }).length;
      var pct = total ? Math.round(n / total * 100) : 0;
      return '<article class="stage cv" style="' + cv(st.color, st.colorDark) + '">' +
        '<span class="stage-badge">' + esc(STAGE_ORDINAL[st.key] || "") + '</span>' +
        '<div class="stage-num">' + n + '</div>' +
        '<div class="stage-pct">' + pct + '% من إجمالي الخدمات</div>' +
        '<h3>' + esc(st.label) + '</h3>' +
        '<p>' + esc(st.desc) + '</p>' +
        '<button type="button" class="btn btn-outline" data-stage="' + esc(st.key) + '"' + (n ? "" : " disabled") + '>' +
          ICON("list") + (n ? "استعراض خدمات " + esc(st.label) : "لا توجد خدمات متاحة") + '</button>' +
      '</article>';
    }).join("");
  }

  function renderChipsOnce() {
    $("#cat-chips").innerHTML = categories().map(function (c) {
      return '<button type="button" class="chip cv" style="' + catCV(c) + '" data-cat="' + esc(c) + '" aria-pressed="false">' +
        '<i></i><span>' + esc(c) + '</span><em>0</em></button>';
    }).join("");
  }

  function renderSegOnce() {
    var btns = [{ key: "", label: "الكل" }].concat(C.stages.map(function (s) { return { key: s.key, label: s.label }; }));
    $("#seg").innerHTML = btns.map(function (b) {
      return '<button type="button" data-seg="' + esc(b.key) + '" aria-pressed="false">' + esc(b.label) + '<em>0</em></button>';
    }).join("");
  }

  /* ---------------- render: dynamic parts ---------------- */
  /* الأهداف الاستراتيجية: شارات صغيرة؛ عند تجاوز الحدّ يظهر «+N» وتفاصيلها في العنوان */
  function objChips(items, max) {
    if (!items.length) return "";
    var shown = max ? items.slice(0, max) : items;
    var rest = items.length - shown.length;
    return shown.map(function (o) { return '<span class="obj">' + esc(o) + '</span>'; }).join("") +
      (rest > 0 ? '<span class="obj more" title="' + esc(items.slice(max).join("، ")) + '">+' + rest + '</span>' : "");
  }

  function card(s) {
    return '<a class="svc cv" href="#service/' + s.id + '" style="' + catCV(s.category) + '" aria-label="' + esc(s.short) + '">' +
      '<span class="svc-bar"></span><div class="svc-body">' +
        '<div class="svc-cat">' + ICON(catIcon(s.category)) + '<span>' + esc(s.category) + '</span></div>' +
        '<h3>' + esc(s.short) + (s.isNew ? ' <span class="new">جديد</span>' : '') + '</h3>' +
        '<p class="svc-desc">' + esc(s.description || "") + '</p>' +
        (s.objectives.length ? '<div class="objs" role="group" aria-label="الأهداف الاستراتيجية" title="الأهداف الاستراتيجية">' + ICON("target") + objChips(s.objectives, 3) + '</div>' : '') +
        '<div class="svc-foot"><div class="svc-meta">' +
          (s.stage ? '<span class="tag"><i class="dot cv" style="' + stageCV(s.stage) + '"></i>' + esc(s.stage) + '</span>' : '') +
          (s.sla ? '<span class="tag">' + ICON("clock") + esc(s.sla) + '</span>' : '') +
        '</div><span class="svc-more">التفاصيل ' + ICON("arrowLeft") + '</span></div>' +
      '</div></a>';
  }

  function refresh() {
    var res = matching();
    $("#grid").innerHTML = res.map(card).join("");
    $("#grid").hidden = !res.length;

    var filtering = !!(S.stage || S.category || QTOKENS.length);
    var empty = $("#empty");
    if (!res.length) {
      empty.hidden = false;
      empty.innerHTML = '<div class="ei">' + ICON("search") + '</div>' +
        '<h3>' + (filtering ? "لا توجد خدمات مطابقة" : "لا توجد خدمات متاحة حاليًا") + '</h3>' +
        '<p>' + (filtering ? "جرّب تعديل البحث أو إزالة التصفية." : "ستظهر الخدمات هنا فور إتاحتها.") + '</p>' +
        (filtering ? '<button type="button" class="btn btn-primary" data-clear>' + ICON("refresh") + 'مسح التصفية</button>' : '');
    } else { empty.hidden = true; empty.innerHTML = ""; }

    $("#svc-sub").textContent = res.length + (res.length === ALL.length ? " خدمة متاحة" : " من " + ALL.length + " خدمة متاحة");

    /* المرحلة */
    $all("#seg button").forEach(function (b) {
      var key = b.getAttribute("data-seg");
      var n = key ? countBy("stage", key, "stage") : matching("stage").length;
      b.querySelector("em").textContent = n;
      var on = (S.stage || "") === key;
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    /* الفئات */
    $all("#cat-chips .chip").forEach(function (b) {
      var c = b.getAttribute("data-cat");
      var n = countBy("category", c, "category");
      b.querySelector("em").textContent = n;
      var on = S.category === c;
      b.classList.toggle("on", on); b.classList.toggle("zero", n === 0 && !on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    renderActive();
  }

  function renderActive() {
    var out = [];
    function chip(kind, label) {
      return '<span class="af">' + esc(label) + '<button type="button" data-remove="' + kind + '" aria-label="إزالة ' + esc(label) + '">' + ICON("close") + '</button></span>';
    }
    if (S.stage) out.push(chip("stage", "المرحلة: " + S.stage));
    if (S.category) out.push(chip("category", "الفئة: " + S.category));
    if (QTOKENS.length) out.push(chip("q", "بحث: " + S.q.trim()));
    if (out.length > 1) out.push('<button type="button" class="clear" data-clear>مسح الكل</button>');
    $("#active").innerHTML = out.join("");
  }

  /* ---------------- modal ---------------- */
  var lastFocus = null;
  function section(icon, title, bodyHtml) {
    return '<section class="m-sec"><h3><span class="m-ic">' + ICON(icon) + '</span>' + esc(title) + '</h3>' + bodyHtml + '</section>';
  }
  function para(t, fallback) {
    return t ? '<p class="m-txt">' + esc(t) + '</p>' : '<p class="m-txt none">' + esc(fallback) + '</p>';
  }

  function showModal(s) {
    var m = $("#modal");
    lastFocus = document.activeElement;
    m.innerHTML =
      '<div class="m-box cv" style="' + catCV(s.category) + '">' +
        '<div class="m-top"></div>' +
        '<div class="m-head">' +
          '<button type="button" class="m-back" data-close>' + ICON("chevron") + 'العودة لجميع الخدمات</button>' +
          '<div class="m-cat">' + ICON(catIcon(s.category)) + '<span>' + esc(s.category) + '</span></div>' +
          '<h2 id="m-title">' + esc(s.title) + (s.isNew ? ' <span class="new">جديد</span>' : '') + '</h2>' +
          '<div class="m-tags">' +
            (s.stage ? '<span class="tag"><i class="dot cv" style="' + stageCV(s.stage) + '"></i>' + esc(s.stage) + '</span>' : '') +
            (s.sla ? '<span class="tag">' + ICON("clock") + esc(s.sla) + '</span>' : '') +
            s.beneficiaries.map(function (b) { return '<span class="tag">' + ICON("users") + esc(b) + '</span>'; }).join("") +
          '</div>' +
        '</div>' +
        '<div class="m-body">' +
          section("doc", "وصف الخدمة", para(s.description, "لا يوجد وصف.")) +
          section("target", "الأهداف المرجوّة", para(s.goals, "لم تُحدَّد أهداف بعد.")) +
          section("check", "المتطلبات المسبقة", para(s.prerequisites, "لا توجد متطلبات مسبقة")) +
          section("briefcase", "المخرجات المتوقّعة", para(s.outputs, "لم تُحدَّد مخرجات بعد.")) +
          '<div class="m-facts">' +
            (s.objectives.length ? '<div class="fact wide"><small>الأهداف الاستراتيجية</small><div class="objs">' + objChips(s.objectives) + '</div></div>' : '') +
            '<div class="fact"><small>الفئة المستفيدة</small><div class="bens">' +
              (s.beneficiaries.length ? s.beneficiaries.map(function (b) { return '<span class="tag">' + esc(b) + '</span>'; }).join("") : '<b>—</b>') +
            '</div></div>' +
            '<div class="fact"><small>الخط الزمني (SLA)</small><b>' + esc(s.sla || "—") + '</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="m-foot">' +
          '<a class="btn btn-primary" href="' + esc(REQUEST_URL) + '" target="_blank" rel="noopener noreferrer">طلب الخدمة الآن ' + ICON("external") + '</a>' +
          '<button type="button" class="btn btn-ghost" data-copy="' + s.id + '">' + ICON("link") + 'نسخ رابط الخدمة</button>' +
        '</div>' +
      '</div>';
    /* السهم في RTL: «العودة» يشير لليمين */
    m.hidden = false;
    document.body.classList.add("lock");
    var close = $(".m-back", m); if (close) close.focus();
  }

  function hideModal() {
    var m = $("#modal");
    if (m.hidden) return;
    m.hidden = true; m.innerHTML = "";
    document.body.classList.remove("lock");
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    lastFocus = null;
  }
  /* إغلاق بإجراء المستخدم: نزيل #service/.. من الرابط دون إضافة سجل جديد */
  function closeByUser() {
    if (/^#service\//.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
    hideModal();
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function copyLink(id) {
    var url = location.origin + location.pathname + "#service/" + id;
    function ok() { toast("تم نسخ رابط الخدمة"); }
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = url; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? ok() : toast(url); } catch (e) { toast(url); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, fallback);
    else fallback();
  }

  /* ---------------- routing: #service/<id> ---------------- */
  function route() {
    var m = /^#service\/(\d+)$/.exec(location.hash);
    if (!m) { hideModal(); return; }
    var s = byId(+m[1]);
    if (s) { showModal(s); return; }
    /* غير موجودة أو غير متاحة (متوقفة/قيد التفعيل/محذوفة): لا تُعرض إطلاقًا */
    history.replaceState(null, "", location.pathname + location.search);
    hideModal();
    toast("هذه الخدمة غير متاحة حاليًا");
  }

  /* ---------------- events ---------------- */
  function scrollToServices() {
    var el = $("#services");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function setQuery(v) {
    S.q = v; QTOKENS = norm(v).split(/\s+/).filter(Boolean);
  }
  function clearAll() {
    S.stage = ""; S.category = ""; setQuery(""); $("#q").value = ""; refresh();
  }

  function bind() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-stage],[data-cat],[data-seg],[data-remove],[data-clear],[data-close],[data-copy]");
      if (!t) {
        if (e.target.id === "modal") closeByUser();
        return;
      }
      if (t.hasAttribute("data-stage")) { S.stage = t.getAttribute("data-stage"); refresh(); scrollToServices(); }
      else if (t.hasAttribute("data-seg")) { S.stage = t.getAttribute("data-seg"); refresh(); }
      else if (t.hasAttribute("data-cat")) {
        var c = t.getAttribute("data-cat"); S.category = S.category === c ? "" : c; refresh();
        if (S.category) scrollToServices();
      }
      else if (t.hasAttribute("data-remove")) {
        var k = t.getAttribute("data-remove");
        if (k === "q") { setQuery(""); $("#q").value = ""; } else S[k] = "";
        refresh();
      }
      else if (t.hasAttribute("data-clear")) clearAll();
      else if (t.hasAttribute("data-close")) closeByUser();
      else if (t.hasAttribute("data-copy")) copyLink(t.getAttribute("data-copy"));
    });

    var timer = null, input = $("#q");
    input.addEventListener("input", function () {
      var had = QTOKENS.length > 0;
      clearTimeout(timer);
      timer = setTimeout(function () {
        setQuery(input.value); refresh();
        /* أول حرف يُكتب: نُظهر النتائج إن كانت خارج مجال الرؤية */
        if (!had && QTOKENS.length) {
          var r = $("#services").getBoundingClientRect();
          if (r.top > window.innerHeight * 0.6) scrollToServices();
        }
      }, 120);
    });

    document.addEventListener("keydown", function (e) {
      var m = $("#modal");
      if (m.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeByUser(); return; }
      if (e.key === "Tab") {            /* حبس التركيز داخل النافذة */
        var f = $all("a[href],button:not([disabled])", m);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener("hashchange", route);
  }

  /* ---------------- theme ---------------- */
  var META = null;
  function theme() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
  function paintThemeBtn() {
    var dark = theme() === "dark", b = $("#theme-btn");
    b.innerHTML = ICON(dark ? "sun" : "moon");
    var label = dark ? "التبديل إلى المظهر الفاتح" : "التبديل إلى المظهر الداكن";
    b.setAttribute("aria-label", label); b.title = label;
    if (META) META.setAttribute("content", dark ? "#0a110e" : "#0b6b3e");
  }
  function setTheme(t, save) {
    var root = document.documentElement;
    root.classList.add("theming");
    root.setAttribute("data-theme", t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove("theming"); }); });
    if (save) { try { localStorage.setItem("cat_theme", t); } catch (e) {} }
    paintThemeBtn();
  }
  function bindTheme() {
    META = $("#meta-theme");
    $("#theme-btn").addEventListener("click", function () { setTheme(theme() === "dark" ? "light" : "dark", true); });
    /* بلا تفضيل محفوظ: اتبع مظهر النظام لحظيًا */
    var mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (mq && mq.addEventListener) mq.addEventListener("change", function (e) {
      var saved = null; try { saved = localStorage.getItem("cat_theme"); } catch (x) {}
      if (saved !== "dark" && saved !== "light") setTheme(e.matches ? "dark" : "light", false);
    });
    /* تغيير المظهر من النظام الداخلي في تبويب آخر ينعكس هنا */
    window.addEventListener("storage", function (e) {
      if (e.key === "cat_theme" && (e.newValue === "dark" || e.newValue === "light")) setTheme(e.newValue, false);
    });
    paintThemeBtn();
  }

  /* ---------------- boot ---------------- */
  function showError(err) {
    console.error(err);
    $("#state").innerHTML =
      '<div class="empty"><div class="ei">' + ICON("info") + '</div>' +
      '<h3>تعذّر تحميل الخدمات</h3><p>تحقق من اتصالك بالإنترنت ثم أعد المحاولة.</p>' +
      '<button type="button" class="btn btn-primary" onclick="location.reload()">' + ICON("refresh") + 'إعادة المحاولة</button></div>';
  }

  function start() {
    renderShell();
    bindTheme();
    $("#state").innerHTML = '<div class="skeleton" aria-hidden="true"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>';
    bind();
    load().then(function () {
      $("#state").innerHTML = "";
      $("#content").hidden = false;
      renderStats(); renderStages(); renderChipsOnce(); renderSegOnce(); refresh();
      var q = $("#q"); q.disabled = false;
      var d = fmtDate(UPDATED);
      $("#updated").textContent = d ? "آخر تحديث للدليل: " + d : "";
      route();
    }).catch(showError);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
