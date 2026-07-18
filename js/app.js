/* =========================================================================
 * كتالوج الخدمات الاستشارية — التطبيق الرئيسي
 * State store · GitHub-backed encrypted DB · views · CRUD · router
 * ========================================================================= */
(function () {
  "use strict";

  var C = window.CONFIG, ICON = window.ICON, Charts = window.Charts, Box = window.CryptoBox;

  /* ---------------- State ---------------- */
  var S = {
    catalog: null,
    sha: null,
    password: null,
    token: null, /* extracted from the decrypted catalog itself — see normalizeCatalog() in app-ui.js */
    search: "",
    sort: "title",
    showFilters: true,
    filters: {
      sector: [], department: [], stage: [], objective: [],
      category: [], beneficiary: [], owner: [], representative: [], status: []
    },
    selected: null,
    dirty: false,
    sectorIndex: {}
  };

  /* ---------------- Small helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function attr(s) { return esc(s).replace(/`/g, "&#96;"); }
  function uniq(arr) { var out = [], seen = {}; arr.forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } }); return out; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }
  function fmtDate(iso) {
    if (!iso) return "—";
    var m = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    var p = String(iso).split("-"); if (p.length < 3) return iso;
    return (+p[2]) + " " + m[(+p[1]) - 1] + " " + p[0];
  }

  /* ---------------- Colors ---------------- */
  function palette() { return isDark() ? C.palette.dark : C.palette.light; }
  function sectorColor(sector) {
    var idx = S.sectorIndex[sector];
    if (idx == null) idx = Object.keys(S.sectorIndex).length;
    return palette()[idx % palette().length];
  }
  function stageColor(key) { var s = C.stageByKey(key); return s ? (isDark() ? s.colorDark : s.color) : "var(--muted)"; }
  function avatarColor(name) {
    var h = 0; name = name || "?";
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette()[h % palette().length];
  }
  function initials(name) {
    if (!name) return "؟";
    var parts = String(name).trim().replace(/^(د\.|أ\.|م\.)\s*/, "").split(/\s+/);
    return (parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "");
  }
  function buildSectorIndex() {
    S.sectorIndex = {};
    uniqueSectors().forEach(function (s, i) { S.sectorIndex[s] = i; });
  }

  /* ---------------- Derived data ---------------- */
  function services() { return (S.catalog && S.catalog.services) || []; }
  function refs() { S.catalog.refs = S.catalog.refs || { departments: [], owners: [], representatives: [] }; return S.catalog.refs; }
  function uniqueSectors() { return uniq(services().map(function (s) { return s.sector; })); }
  function allValues(field) {
    var derived = services().map(function (s) { return s[field]; });
    var r = refs();
    var extra = field === "department" ? r.departments : field === "owner" ? r.owners : field === "representative" ? r.representatives : [];
    return uniq(derived.concat(extra || []));
  }
  function usageCount(field, value) {
    return services().filter(function (s) { return s[field] === value; }).length;
  }
  function countBy(field, value) {
    return services().filter(function (s) {
      var v = s[field];
      return Array.isArray(v) ? v.indexOf(value) >= 0 : v === value;
    }).length;
  }

  /* ---------------- Filtering ---------------- */
  function matchFilter(svc) {
    var f = S.filters;
    if (f.sector.length && f.sector.indexOf(svc.sector) < 0) return false;
    if (f.department.length && f.department.indexOf(svc.department) < 0) return false;
    if (f.stage.length && f.stage.indexOf(svc.stage) < 0) return false;
    if (f.category.length && f.category.indexOf(svc.category) < 0) return false;
    if (f.status.length && f.status.indexOf(svc.status) < 0) return false;
    if (f.owner.length && f.owner.indexOf(svc.owner) < 0) return false;
    if (f.representative.length && f.representative.indexOf(svc.representative) < 0) return false;
    if (f.objective.length && !f.objective.every(function (o) { return (svc.objectives || []).indexOf(o) >= 0; })) return false;
    if (f.beneficiary.length && !f.beneficiary.some(function (b) { return (svc.beneficiaries || []).indexOf(b) >= 0; })) return false;
    if (S.search.trim()) {
      var q = S.search.trim().toLowerCase();
      var hay = [svc.title, svc.description, svc.goals, svc.department, svc.owner, svc.representative, svc.outputs, svc.sector, (svc.objectives || []).join(" ")].join(" ").toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  function filtered() {
    var list = services().filter(matchFilter);
    var sort = S.sort;
    list.sort(function (a, b) {
      if (sort === "sector") return (a.sector || "").localeCompare(b.sector || "", "ar") || (a.title || "").localeCompare(b.title || "", "ar");
      if (sort === "stage") { var so = ["التخطيط","التنفيذ","التوسع"]; return so.indexOf(a.stage) - so.indexOf(b.stage) || (a.title||"").localeCompare(b.title||"","ar"); }
      if (sort === "updated") return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      return (a.title || "").localeCompare(b.title || "", "ar");
    });
    return list;
  }
  function activeFilterCount() {
    var n = 0, f = S.filters;
    for (var k in f) if (f.hasOwnProperty(k)) n += f[k].length;
    return n;
  }

  /* =====================================================================
   * GITHUB ENCRYPTED DATA LAYER
   * ===================================================================== */
  function apiUrl() {
    var g = C.github;
    return "https://api.github.com/repos/" + g.owner + "/" + g.repo + "/contents/" + g.dataPath;
  }
  function authHeaders() {
    var h = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (S.token) h["Authorization"] = "Bearer " + S.token;
    return h;
  }
  function b64EncodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64DecodeUnicode(str) {
    return decodeURIComponent(escape(atob(str.replace(/\n/g, ""))));
  }

  /* Fetch the encrypted envelope (+ sha when possible) */
  function fetchEnvelope() {
    if (S.token) {
      return fetch(apiUrl() + "?ref=" + C.github.branch + "&t=" + Date.now(), { headers: authHeaders(), cache: "no-store" })
        .then(function (r) {
          if (r.ok) return r.json().then(function (j) { S.sha = j.sha; return JSON.parse(b64DecodeUnicode(j.content)); });
          return relativeEnvelope();
        }).catch(relativeEnvelope);
    }
    return relativeEnvelope();
  }
  function relativeEnvelope() {
    return fetch(C.localDataUrl + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("DATA_FETCH_FAILED"); return r.json(); });
  }

  /* Refresh sha via API (needed before first write in an editor session) */
  function refreshSha() {
    if (!S.token) return Promise.resolve(null);
    return fetch(apiUrl() + "?ref=" + C.github.branch + "&t=" + Date.now(), { headers: authHeaders(), cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) S.sha = j.sha; return j ? j.sha : null; })
      .catch(function () { return null; });
  }

  /* Persist current catalog: encrypt + commit to GitHub (if token), else local-dirty.
   * opts.force = overwrite even on a genuine concurrent-edit conflict (409). */
  function persist(message, opts) {
    opts = opts || {};
    S.catalog.updatedAt = todayISO();
    if (!S.token) { S.dirty = true; return Promise.resolve({ local: true }); }
    return Box.encryptJSON(S.catalog, S.password).then(function (env) {
      var content = b64EncodeUnicode(JSON.stringify(env, null, 0));
      function put(sha) {
        return fetch(apiUrl(), {
          method: "PUT", headers: authHeaders(),
          body: JSON.stringify({ message: message || "تحديث الكتالوج", content: content, sha: sha, branch: C.github.branch })
        });
      }
      function ok(r) { return r.json().then(function (j) { S.sha = j.content.sha; S.dirty = false; return { ok: true }; }); }
      function err(r) {
        return r.json().catch(function () { return {}; }).then(function (e) {
          throw new Error(e && e.message ? e.message : ("HTTP " + r.status));
        });
      }
      var ensure = S.sha ? Promise.resolve(S.sha) : refreshSha();
      return ensure.then(function (sha) {
        return put(sha).then(function (r) {
          if (r.ok) return ok(r);
          /* 422 = our sha was missing/invalid for THIS editor's session (not a concurrent
           * edit) — safe to refetch sha and retry once. */
          if (r.status === 422) {
            return refreshSha().then(function (fresh) {
              return put(fresh).then(function (r2) { return r2.ok ? ok(r2) : err(r2); });
            });
          }
          /* 409 = the file changed on the server since we synced → a genuine concurrent
           * edit. Do NOT clobber silently. Force-write only when explicitly requested. */
          if (r.status === 409) {
            if (opts.force) {
              return refreshSha().then(function (fresh) {
                return put(fresh).then(function (r2) { return r2.ok ? ok(r2) : err(r2); });
              });
            }
            var ce = new Error("CONFLICT"); ce.conflict = true; throw ce;
          }
          return err(r);
        });
      });
    });
  }

  /* =====================================================================
   * TOASTS / MODAL / DRAWER
   * ===================================================================== */
  function toast(msg, type, sub) {
    var wrap = $("#toasts"); if (!wrap) { wrap = document.createElement("div"); wrap.id = "toasts"; wrap.className = "toasts"; document.body.appendChild(wrap); }
    var el = document.createElement("div");
    el.className = "toast " + (type || "info");
    var ic = type === "ok" ? "check" : type === "err" ? "info" : "info";
    el.innerHTML = '<div class="ti">' + ICON(ic) + '</div><div class="tmsg">' + esc(msg) + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
    wrap.appendChild(el);
    setTimeout(function () { el.style.transition = ".3s"; el.style.opacity = "0"; el.style.transform = "translateY(6px)"; setTimeout(function () { el.remove(); }, 300); }, type === "err" ? 5200 : 3400);
  }

  function openModal(html, opts) {
    closeModal();
    var m = document.createElement("div");
    m.className = "modal"; m.id = "modal";
    m.innerHTML = '<div class="modal-box ' + ((opts && opts.sm) ? "sm" : "") + '">' + html + '</div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add("show"); });
    m.addEventListener("click", function (e) { if (e.target === m) closeModal(); });
    document.addEventListener("keydown", escClose);
    return m;
  }
  function closeModal() { var m = $("#modal"); if (m) { m.classList.remove("show"); setTimeout(function () { m.remove(); }, 200); } document.removeEventListener("keydown", escClose); }
  function escClose(e) { if (e.key === "Escape") { closeModal(); closeDrawer(); } }

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var m = openModal(
        '<div class="modal-head"><div class="mi" style="background:var(--danger-soft);color:var(--danger)">' + ICON(opts.icon || "trash") + '</div>' +
        '<h2>' + esc(opts.title) + '</h2></div>' +
        '<div class="modal-body"><p style="font-size:13.5px;color:var(--ink-2);line-height:1.7">' + esc(opts.message) + '</p></div>' +
        '<div class="modal-foot"><button class="btn ' + (opts.danger ? "danger" : "primary") + '" data-ok>' + esc(opts.confirm || "تأكيد") + '</button>' +
        '<button class="btn ghost" data-cancel>إلغاء</button></div>', { sm: true });
      $("[data-ok]", m).addEventListener("click", function () { closeModal(); resolve(true); });
      $("[data-cancel]", m).addEventListener("click", function () { closeModal(); resolve(false); });
    });
  }

  function closeDrawer() {
    var d = $("#drawer"), o = $("#drawer-ov");
    if (d) { d.classList.remove("show"); setTimeout(function () { d.remove(); }, 300); }
    if (o) { o.classList.remove("show"); setTimeout(function () { o.remove(); }, 300); }
    S.selected = null;
  }

  /* =====================================================================
   * RENDER — shell
   * ===================================================================== */
  function render() {
    if (!S.catalog) return;
    buildSectorIndex();
    var od = $("#drawer"), oo = $("#drawer-ov"); if (od) od.remove(); if (oo) oo.remove();
    var app = $("#app");
    app.innerHTML = topbar() + '<main><div class="wrap" id="view">' + pageView() + '</div></main>';
    if (S.selected) drawer(S.selected);
  }
  function reRenderView() {
    var v = $("#view"); if (!v) return render();
    var act = document.activeElement || {};
    var fId = act.id || null;
    var caret = null; try { caret = act.selectionStart; } catch (e) {}
    v.innerHTML = pageView();
    var back = fId ? document.getElementById(fId) : null;
    if (back) { back.focus(); if (caret != null) { try { back.setSelectionRange(caret, caret); } catch (e) {} } }
  }

  function topbar() {
    return '<header class="topbar"><div class="wrap topbar-inner">' +
      '<div class="brand"><div class="brand-logo">' + ICON("briefcase") + '</div>' +
      '<div class="brand-txt"><b>' + esc(C.brand.title) + '</b><span>' + esc(C.brand.program) + " · " + esc(C.brand.year) + '</span></div></div>' +
      '<div class="topsearch"><label class="sr-only" for="top-q">بحث</label>' + ICON("search") +
        '<input id="top-q" type="search" placeholder="ابحث في الخدمات…" value="' + attr(S.search) + '"></div>' +
      '<div class="topbar-spacer"></div>' +
      '<button class="icon-btn" data-act="theme" title="المظهر">' + ICON(isDark() ? "sun" : "moon") + '</button>' +
      '<button class="icon-btn" data-act="settings" title="الإعدادات">' + ICON("gear") + '</button>' +
      '</div></header>';
  }

  /* =====================================================================
   * PAGE — dashboard + services merged into a single scrollable page
   * ===================================================================== */
  function pageView() {
    var svc = services();
    var sectors = uniqueSectors();
    var deps = allValues("department");
    var owners = uniq(svc.map(function (s) { return s.owner; }));
    var reps = uniq(svc.map(function (s) { return s.representative; }));

    /* hero */
    var html = '<div class="hero">' +
      '<span class="hero-badge">' + ICON("sparkles") + 'برنامج الاستشارات الرقمية ' + esc(C.brand.year) + '</span>' +
      '<h1>' + esc(C.brand.title) + '</h1>' +
      '<p>منصة موحّدة لاستعراض بطاقات الخدمات الاستشارية وملاكها وممثليها عبر القطاعات والإدارات العامة، مصنّفة حسب الأهداف والفئات ومراحل التحول الرقمي.</p>' +
      '<div class="hero-meta">' +
        '<span class="hm">' + ICON("briefcase") + esc(svc.length) + ' خدمة استشارية</span>' +
        '<span class="hm">' + ICON("layers") + esc(sectors.length) + ' قطاعات</span>' +
        '<span class="hm">' + ICON("calendar") + 'آخر تحديث: ' + esc(fmtDate(S.catalog.updatedAt)) + '</span>' +
      '</div></div>';

    /* stat tiles — each is an entry point into what it's counting */
    var stats = [
      { icon: "briefcase", c: palette()[0], val: svc.length, lbl: "إجمالي الخدمات", stat: "services" },
      { icon: "layers", c: palette()[4], val: sectors.length, lbl: "القطاعات", stat: "sectors" },
      { icon: "building", c: palette()[1], val: deps.length, lbl: "الإدارات العامة", stat: "department" },
      { icon: "user", c: palette()[7], val: owners.length, lbl: "ملاك الخدمات", stat: "owner" },
      { icon: "users", c: palette()[2], val: reps.length, lbl: "ممثلو الخدمات", stat: "representative" }
    ];
    html += '<div class="section"><div class="stat-grid">' + stats.map(function (s) {
      return '<button class="stat" data-act="stat-click" data-stat="' + s.stat + '"><div class="si" style="background:' + hexA(s.c, .13) + ';color:' + s.c + '">' + ICON(s.icon) + '</div>' +
        '<div class="txt"><div class="val">' + esc(s.val) + '</div><div class="lbl">' + esc(s.lbl) + '</div></div></button>';
    }).join("") + '</div></div>';

    /* sectors cards */
    html += '<div class="section" id="sectors-anchor"><div class="section-head"><div class="ttl"><div class="si">' + ICON("layers") + '</div><h2>القطاعات والمراكز</h2></div><span class="sub">' + sectors.length + ' قطاعات</span></div>' +
      '<div class="cards grid-3">' + sectors.slice().sort(function (a, b) { return countBy("sector", b) - countBy("sector", a); }).map(function (s) {
        var col = sectorColor(s);
        return '<button class="sector-card" style="--c:' + col + '" data-act="goto-filter" data-field="sector" data-value="' + attr(s) + '">' +
          '<div class="ci">' + ICON("building2") + '</div>' +
          '<div class="meta"><b>' + esc(s) + '</b><span>' + depCountForSector(s) + ' إدارات · ' + countBy("sector", s) + ' خدمات</span></div>' +
          '<span class="cbadge">' + countBy("sector", s) + '</span></button>';
      }).join("") + '</div></div>';

    /* stages — same compact card style as sectors, for a unified look */
    var total = svc.length || 1;
    html += '<div class="section"><div class="section-head"><div class="ttl"><div class="si">' + ICON("flag") + '</div>' +
      '<h2>مراحل التحول الرقمي</h2></div><span class="sub">اضغط أي مرحلة لتصفية الخدمات</span></div>' +
      '<div class="cards grid-3">' + C.stages.map(function (st) {
        var cnt = countBy("stage", st.key);
        var pct = Math.round(cnt / total * 100);
        var col = isDark() ? st.colorDark : st.color;
        return '<button class="sector-card" style="--c:' + col + '" data-act="goto-filter" data-field="stage" data-value="' + attr(st.key) + '">' +
          '<div class="ci">' + ICON("flag") + '</div>' +
          '<div class="meta"><b>' + esc(st.label) + '</b><span>' + pct + '% من الخدمات</span></div>' +
          '<span class="cbadge">' + cnt + '</span></button>';
      }).join("") + '</div></div>';

    /* services — merged directly under the sectors section (single page) */
    var list = filtered();
    html += '<div class="section" id="svc-anchor"><div class="section-head"><div class="ttl"><div class="si">' + ICON("grid") + '</div><h2>بطاقات الخدمات</h2></div><span class="sub">تصفّح جميع الخدمات، أو صفِّها حسب القطاع والفريق والتصنيف</span></div>' +
      '<div class="svc-toolbar">' +
        '<div class="svc-search">' + ICON("search") + '<input id="svc-q" type="search" placeholder="ابحث بالاسم أو الوصف أو المالك…" value="' + attr(S.search) + '"></div>' +
        '<button class="btn ' + (S.showFilters ? "primary" : "") + ' sm" data-act="toggle-filters">' + ICON("filter") + 'الفلاتر' + (activeFilterCount() ? ' (' + activeFilterCount() + ')' : '') + '</button>' +
        '<select class="select" id="svc-sort">' +
          opt("title", "الاسم", S.sort) + opt("sector", "القطاع", S.sort) + opt("stage", "المرحلة", S.sort) + opt("updated", "آخر تحديث", S.sort) +
        '</select>' +
        '<span class="count-pill"><b>' + list.length + '</b> من ' + services().length + ' خدمة</span>' +
        '<div class="topbar-spacer"></div>' +
        (S.token ? '<button class="btn sm" data-act="manage">' + ICON("list") + 'إدارة القوائم</button>' +
                   '<button class="btn primary sm" data-act="add-service">' + ICON("plus") + 'إضافة خدمة</button>' : '') +
      '</div>';

    if (S.showFilters) html += filterPanel();
    html += activeFilterBar();

    if (!list.length) {
      html += '<div class="empty"><div class="ei">' + ICON("search") + '</div><h3>لا توجد خدمات مطابقة</h3><p>جرّب تعديل الفلاتر أو مسح البحث.</p></div>';
    } else {
      html += '<div class="cards grid-3">' + list.map(serviceCard).join("") + '</div>';
    }
    html += '</div>';

    return html;
  }
  function depCountForSector(sector) {
    return uniq(services().filter(function (s) { return s.sector === sector; }).map(function (s) { return s.department; })).length;
  }
  function hexA(hex, a) {
    var h = hex.replace("#", ""); if (h.length === 3) h = h.split("").map(function (x) { return x + x; }).join("");
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  function opt(v, label, cur) { return '<option value="' + v + '"' + (cur === v ? " selected" : "") + '>' + esc(label) + '</option>'; }

  function serviceCard(s) {
    var col = sectorColor(s.sector);
    var stc = stageColor(s.stage);
    return '<article class="svc-card" style="--c:' + col + '" data-act="open" data-id="' + attr(s.id) + '">' +
      '<div class="accent-line"></div><div class="body">' +
      '<div class="badges">' +
        '<span class="badge" style="--c:' + col + '"><span class="bdot"></span>' + esc(shortSector(s.sector)) + '</span>' +
        (s.stage ? '<span class="badge" style="--c:' + stc + '">' + esc(s.stage) + '</span>' : '') +
        (s.sla ? '<span class="badge plain">' + ICON("clock") + esc(s.sla) + '</span>' : '') +
      '</div>' +
      '<h3>' + esc(s.title) + '</h3>' +
      '<p class="desc">' + esc(s.description || "—") + '</p>' +
      '<div class="foot">' +
        person(s.owner, "مالك الخدمة") +
        (s.representative ? person(s.representative, "ممثل الخدمة") : "") +
      '</div></div></article>';
  }
  function person(name, role) {
    return '<div class="who"><span class="avatar" style="background:' + avatarColor(name) + '">' + esc(initials(name)) + '</span>' +
      '<div class="txt"><b>' + esc(name || "—") + '</b><span>' + esc(role) + '</span></div></div>';
  }
  function shortSector(s) { return String(s || "").replace(/^قطاع\s+/, "").replace(/^مركز\s+/, "مركز "); }

  /* ---------------- Filter panel ---------------- */
  function filterPanel() {
    var groups = "";
    groups += chipFilterGroup("sector", "layers", "القطاع", uniqueSectors(), true);
    if (!S.filters.sector.length) {
      groups += scopeHint();
    } else {
      var depts = scopedDepartments();
      if (depts.length) groups += chipFilterGroup("department", "building", "الإدارة العامة", depts);
      groups += teamGroup();
    }
    groups += chipFilterGroup("stage", "flag", "مرحلة التحول", C.stages.map(function (s) { return s.key; }), true);
    groups += chipFilterGroup("objective", "target", "الهدف الاستراتيجي", C.taxonomy.objectives);
    groups += chipFilterGroup("category", "tag", "الفئة", allValues("category").filter(Boolean));
    groups += chipFilterGroup("beneficiary", "users", "المستفيدون", C.taxonomy.beneficiaries.filter(function (b) { return countBy("beneficiaries", b) > 0; }));
    return '<div class="filter-panel">' + groups +
      (activeFilterCount() ? '<div style="padding-top:14px;margin-top:4px;border-top:1px solid var(--border)"><button class="btn ghost sm" data-act="clear-filters">' + ICON("refresh") + 'مسح كل الفلاتر</button></div>' : '') +
      '</div>';
  }
  function chipFilterGroup(field, icon, label, values, tone) {
    var sel = S.filters[field];
    var chips = values.filter(Boolean).map(function (v) {
      var on = sel.indexOf(v) >= 0;
      var col = field === "sector" ? sectorColor(v) : field === "stage" ? stageColor(v) : "";
      var toneCls = tone ? " tone" : "";
      var style = col ? ' style="--c:' + col + '"' : "";
      return '<button class="chip' + toneCls + (on ? " on" : "") + '"' + style + ' data-act="filter" data-field="' + field + '" data-value="' + attr(v) + '">' +
        esc(field === "sector" ? shortSector(v) : v) + '<span class="cnt">' + countBy(field === "objective" ? "objectives" : field === "beneficiary" ? "beneficiaries" : field, v) + '</span></button>';
    }).join("");
    return '<div class="filter-group"><div class="fg-head"><div class="fi">' + ICON(icon) + '</div><b>' + esc(label) + '</b>' +
      (sel.length ? '<span class="picked">' + sel.length + '</span>' : '') + '</div><div class="chip-row">' + chips + '</div></div>';
  }
  /* Departments/team scoped to the currently selected sector(s) (and department,
   * for the team) — never dump every org-wide name regardless of context. */
  function scopedBySectorDept() {
    var f = S.filters;
    return services().filter(function (s) {
      if (f.sector.length && f.sector.indexOf(s.sector) < 0) return false;
      if (f.department.length && f.department.indexOf(s.department) < 0) return false;
      return true;
    });
  }
  function scopedDepartments() {
    var f = S.filters;
    var pool = services().filter(function (s) { return !f.sector.length || f.sector.indexOf(s.sector) >= 0; });
    return uniq(pool.map(function (s) { return s.department; })).filter(Boolean).sort(function (a, b) { return a.localeCompare(b, "ar"); });
  }
  /* One row per owner, with their representative(s) nested underneath — a
   * representative always belongs to the owner they stand in for on a given
   * service, so they're never listed as an unrelated flat name. */
  function scopedTeam() {
    var byOwner = {};
    scopedBySectorDept().forEach(function (s) {
      if (!s.owner) return;
      if (!byOwner[s.owner]) byOwner[s.owner] = { owner: s.owner, count: 0, reps: {} };
      byOwner[s.owner].count++;
      if (s.representative) byOwner[s.owner].reps[s.representative] = 1;
    });
    return Object.keys(byOwner).sort(function (a, b) { return a.localeCompare(b, "ar"); }).map(function (k) {
      var o = byOwner[k];
      return { owner: k, count: o.count, reps: Object.keys(o.reps).sort(function (a, b) { return a.localeCompare(b, "ar"); }) };
    });
  }
  function scopeHint() {
    return '<div class="filter-group"><div class="scope-hint">' + ICON("layers") +
      '<div><b>اختر قطاعًا لعرض إداراته وفريقه المسؤول</b><span>الإدارات والأشخاص تُعرض حسب القطاع المختار بدل سردها كلها معًا</span></div></div></div>';
  }
  function teamGroup() {
    var team = scopedTeam();
    if (!team.length) return "";
    var selOwner = S.filters.owner, selRep = S.filters.representative;
    var rows = team.map(function (t) {
      var on = selOwner.indexOf(t.owner) >= 0;
      var reps = t.reps.map(function (r) {
        var ron = selRep.indexOf(r) >= 0;
        return '<button class="team-rep' + (ron ? " on" : "") + '" data-act="filter" data-field="representative" data-value="' + attr(r) + '">' + ICON("arrowLeft") + esc(r) + '</button>';
      }).join("");
      return '<div class="team-row">' +
        '<button class="team-owner' + (on ? " on" : "") + '" data-act="filter" data-field="owner" data-value="' + attr(t.owner) + '">' +
          '<span class="avatar" style="background:' + avatarColor(t.owner) + '">' + esc(initials(t.owner)) + '</span>' +
          '<span class="to-name">' + esc(t.owner) + '</span><span class="to-cnt">' + t.count + '</span></button>' +
        (reps ? '<div class="team-reps">' + reps + '</div>' : "") +
      '</div>';
    }).join("");
    var pickedCount = selOwner.length + selRep.length;
    return '<div class="filter-group"><div class="fg-head"><div class="fi">' + ICON("users") + '</div><b>الفريق المسؤول</b>' +
      (pickedCount ? '<span class="picked">' + pickedCount + '</span>' : '') + '</div>' +
      '<div class="team-list">' + rows + '</div></div>';
  }
  function activeFilterBar() {
    if (!activeFilterCount() && !S.search) return "";
    var labels = { sector: "القطاع", department: "الإدارة", stage: "المرحلة", objective: "الهدف", category: "الفئة", beneficiary: "المستفيد", owner: "المالك", representative: "الممثل", status: "الحالة" };
    var chips = "";
    for (var field in S.filters) {
      if (!S.filters.hasOwnProperty(field)) continue;
      S.filters[field].forEach(function (v) {
        chips += '<span class="af-chip"><span class="k">' + esc(labels[field]) + ':</span> ' + esc(field === "sector" ? shortSector(v) : v) +
          '<button data-act="unfilter" data-field="' + field + '" data-value="' + attr(v) + '" aria-label="إزالة">' + ICON("x") + '</button></span>';
      });
    }
    if (!chips) return "";
    return '<div class="active-filters">' + chips + '<button class="btn ghost sm" data-act="clear-filters">مسح الكل</button></div>';
  }

  /* =====================================================================
   * SERVICE DETAIL DRAWER
   * ===================================================================== */
  function drawer(id) {
    var s = services().filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var col = sectorColor(s.sector), stc = stageColor(s.stage);
    var ov = document.createElement("div"); ov.className = "overlay"; ov.id = "drawer-ov";
    var d = document.createElement("aside"); d.className = "drawer"; d.id = "drawer";

    function field(icon, label, value) {
      if (!value) return "";
      return '<div class="field"><div class="field-lbl">' + ICON(icon) + esc(label) + '</div><div class="field-val">' + esc(value) + '</div></div>';
    }
    var objs = (s.objectives || []).map(function (o) { return '<span class="badge" style="--c:' + palette()[0] + '">' + esc(o) + '</span>'; }).join("");
    var bens = (s.beneficiaries || []).map(function (b) { return '<span class="badge plain">' + ICON("users") + esc(b) + '</span>'; }).join("");

    d.innerHTML =
      '<div class="drawer-head" style="--c:' + col + '">' +
        '<button class="icon-btn drawer-close" data-act="close-drawer">' + ICON("close") + '</button>' +
        '<div class="badges">' +
          '<span class="badge" style="--c:' + col + '"><span class="bdot"></span>' + esc(s.sector) + '</span>' +
          (s.stage ? '<span class="badge" style="--c:' + stc + '">' + (C.stageByKey(s.stage) ? C.stageByKey(s.stage).emoji + ' ' : '') + esc(s.stage) + '</span>' : '') +
          (s.status ? '<span class="badge plain">' + esc(s.status) + '</span>' : '') +
        '</div><h2>' + esc(s.title) + '</h2></div>' +
      '<div class="drawer-body">' +
        '<div class="kv-grid" style="margin:14px 0">' +
          kv("building", "الإدارة العامة", s.department) +
          kv("building2", "الإدارة", s.unit) +
          kv("clock", "الخط الزمني (SLA)", s.sla) +
          kvPerson("مالك الخدمة", s.owner) +
          kvPerson("ممثل الخدمة", s.representative) +
          kv("tag", "الفئة", s.category) +
          kv("target", "عدد الأهداف", (s.objectives || []).length) +
        '</div>' +
        field("doc", "وصف الخدمة", s.description) +
        field("target", "الأهداف المرجوّة", s.goals) +
        field("check", "المتطلبات الأولية", s.prerequisites) +
        field("briefcase", "المخرجات المتوقّعة", s.outputs) +
        (objs ? '<div class="field"><div class="field-lbl">' + ICON("target") + 'الأهداف الاستراتيجية</div><div class="badges">' + objs + '</div></div>' : "") +
        (bens ? '<div class="field"><div class="field-lbl">' + ICON("users") + 'المستفيدون</div><div class="badges">' + bens + '</div></div>' : "") +
        (s.stageRationale ? '<div class="field"><div class="field-lbl">' + ICON("info") + 'مبرر تصنيف المرحلة</div><div class="rationale">' + esc(s.stageRationale) + '</div></div>' : "") +
        '<div class="field"><div class="field-lbl">' + ICON("calendar") + 'آخر تحديث</div><div class="field-val mono">' + esc(fmtDate(s.updatedAt)) + '</div></div>' +
      '</div>' +
      (S.token ? '<div class="drawer-foot"><button class="btn primary" data-act="edit-service" data-id="' + attr(s.id) + '">' + ICON("edit") + 'تعديل</button>' +
        '<button class="btn danger" data-act="delete-service" data-id="' + attr(s.id) + '">' + ICON("trash") + 'حذف</button>' +
        '<div class="topbar-spacer"></div><button class="btn ghost" data-act="close-drawer">إغلاق</button></div>' :
        '<div class="drawer-foot"><button class="btn ghost block" data-act="close-drawer">إغلاق</button></div>') ;

    document.body.appendChild(ov); document.body.appendChild(d);
    requestAnimationFrame(function () { ov.classList.add("show"); d.classList.add("show"); });
    ov.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", escClose);
  }
  function openService(id) { closeDrawer(); S.selected = id; drawer(id); }
  function kv(icon, k, v) { if (!v) return ""; return '<div class="kv"><div class="k">' + ICON(icon) + esc(k) + '</div><div class="v">' + esc(v) + '</div></div>'; }
  function kvPerson(k, v) {
    if (!v) return "";
    return '<div class="kv"><div class="k">' + ICON("user") + esc(k) + '</div><div class="v" style="display:flex;align-items:center;gap:8px">' +
      '<span class="avatar" style="width:26px;height:26px;font-size:10px;background:' + avatarColor(v) + '">' + esc(initials(v)) + '</span>' + esc(v) + '</div></div>';
  }

  window.__catalogApp = { render: render, reRenderView: reRenderView, toast: toast, S: S }; /* debug hook */

  /* Expose to second module file */
  window.__catInternal = {
    S: S, C: C, ICON: ICON, Box: Box, $: $, $all: $all, esc: esc, attr: attr, uniq: uniq, todayISO: todayISO,
    render: render, reRenderView: reRenderView, toast: toast, openModal: openModal, closeModal: closeModal,
    confirmDialog: confirmDialog, closeDrawer: closeDrawer, persist: persist, fetchEnvelope: fetchEnvelope,
    refreshSha: refreshSha, services: services, refs: refs, allValues: allValues, usageCount: usageCount,
    uniqueSectors: uniqueSectors, isDark: isDark, palette: palette, buildSectorIndex: buildSectorIndex,
    b64EncodeUnicode: b64EncodeUnicode, apiUrl: apiUrl, authHeaders: authHeaders,
    openService: openService, countBy: countBy, sectorColor: sectorColor, stageColor: stageColor,
    avatarColor: avatarColor, initials: initials, fmtDate: fmtDate
  };
})();
