/* =========================================================================
 * كتالوج الخدمات — الطبقة التفاعلية: التحرير، الإعدادات، القفل، التهيئة
 * ========================================================================= */
(function () {
  "use strict";
  var I = window.__catInternal;
  var S = I.S, C = I.C, ICON = I.ICON, Box = I.Box, esc = I.esc, attr = I.attr, uniq = I.uniq;
  var $ = I.$, $all = I.$all, render = I.render, reRenderView = I.reRenderView, toast = I.toast;
  var openModal = I.openModal, closeModal = I.closeModal, confirmDialog = I.confirmDialog, closeDrawer = I.closeDrawer;
  var persist = I.persist, fetchEnvelope = I.fetchEnvelope, refreshSha = I.refreshSha;
  var services = I.services, refs = I.refs, allValues = I.allValues, usageCount = I.usageCount, uniqueSectors = I.uniqueSectors;
  var allServices = I.allServices, users = I.users, pendingEdits = I.pendingEdits, isAdmin = I.isAdmin;

  var envelope = null;
  var manageTab = "department";
  var manageSearch = "";
  var manageEditing = null;
  var authView = "login"; /* "login" | "register" | "pending-notice" — bootstrap is auto-detected */
  var authNotice = "";
  var reviewTab = "edits"; /* admin review modal: "edits" | "users" */

  /* ---------------- Theme ---------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("cat_theme", t);
  }
  function toggleTheme() { applyTheme(I.isDark() ? "light" : "dark"); if (S.catalog) render(); }

  /* =====================================================================
   * EVENT DELEGATION
   * ===================================================================== */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]");
    if (!t) return;
    var act = t.getAttribute("data-act");
    var field = t.getAttribute("data-field");
    var value = t.getAttribute("data-value");
    var id = t.getAttribute("data-id");

    switch (act) {
      case "open": I.openService(+id); break;
      case "close-drawer": closeDrawer(); break;
      case "theme": toggleTheme(); break;
      case "settings": openSettings(); break;
      case "toggle-filters": S.showFilters = !S.showFilters; reRenderView(); break;
      case "filter": toggleFilter(field, value); break;
      case "unfilter": removeFilter(field, value); break;
      case "clear-filters": clearFilters(); break;
      case "goto-filter": closeModal(); gotoFilter(field, value); break;
      case "stat-click": statClick(t.getAttribute("data-stat")); break;
      case "add-service": openServiceForm(null); break;
      case "edit-service": closeDrawer(); openServiceForm(+id); break;
      case "delete-service": deleteService(+id); break;
      case "manage": openManage(); break;
      case "chk-toggle": t.classList.toggle("on"); break;
      case "manage-tab": manageTab = t.getAttribute("data-tab"); manageSearch = ""; manageEditing = null; renderManage(); break;
      case "manage-add": manageAdd(); break;
      case "manage-edit-start": manageEditing = t.getAttribute("data-value"); renderManageList(); break;
      case "manage-edit-save": manageEditSave(); break;
      case "manage-edit-cancel": manageEditing = null; renderManageList(); break;
      case "manage-delete": manageDelete(t.getAttribute("data-value")); break;
      case "review": openReview(); break;
      /* renderReview() not renderReviewList() — the tab strip itself carries the
       * active highlight and the counts, so both must repaint on a tab switch */
      case "review-tab": reviewTab = t.getAttribute("data-tab"); renderReview(); break;
      case "review-approve": reviewApprove(+value); break;
      case "review-reject": reviewReject(+value); break;
      case "analysis-approve": analysisApprove(+value); break;
      case "analysis-reject": analysisReject(+value); break;
      case "analysis-open": closeModal(); I.openService(+value); break;
      case "rv-toggle": t.nextElementSibling.classList.toggle("hidden"); break;
      case "user-approve": userApprove(+value); break;
      case "user-reject": userReject(+value); break;
      case "user-deactivate": userDeactivate(+value); break;
      case "user-reactivate": userReactivate(+value); break;
      case "user-assign": openAssign(+value); break;
      case "user-reset-pw": userResetPassword(+value); break;
      case "user-delete": userDelete(+value); break;
      case "user-create": openUserCreate(); break;
      case "users-manage": accountsView = null; closeModal(); openUsers(); break;
      case "um-filter": umFilter = t.getAttribute("data-tab"); renderUsersPanel(); break;
      case "assign-toggle": toggleAssign(+t.getAttribute("data-svc"), +t.getAttribute("data-user"), t.getAttribute("data-field")); break;
      case "settings-theme": applyTheme(t.getAttribute("data-theme")); render(); openSettings(); break;
      case "export": exportData(); break;
      case "import": $("#import-file").click(); break;
      case "reload-data": reloadData(); break;
      case "lock-app": lockApp(); break;
      case "sector-new": revealSectorInput(); break;
    }
  });

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.id === "top-q" || el.id === "svc-q") { S.search = el.value; reRenderView(); }
    else if (el.id === "mng-search") { manageSearch = el.value; renderManageList(); }
  });

  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.id === "svc-sort") { S.sort = el.value; reRenderView(); }
    else if (el.id === "import-file") handleImportFile(el.files[0]);
    else if (el.getAttribute && el.getAttribute("data-act") === "user-role") userSetRole(+el.getAttribute("data-value"), el.value);
    else if (el.getAttribute && el.getAttribute("data-act") === "user-sector") userSetSector(+el.getAttribute("data-value"), el.value);
    else if (el.getAttribute && el.getAttribute("data-act") === "user-department") userSetDepartment(+el.getAttribute("data-value"), el.value);
  });

  /* ---------------- Filters ---------------- */
  function toggleFilter(field, value) {
    var arr = S.filters[field]; if (!arr) return;
    var i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1); else arr.push(value);
    reRenderView();
  }
  function removeFilter(field, value) { var arr = S.filters[field]; var i = arr.indexOf(value); if (i >= 0) arr.splice(i, 1); reRenderView(); }
  function clearFilters() { for (var k in S.filters) S.filters[k] = []; reRenderView(); }
  function gotoFilter(field, value) {
    for (var k in S.filters) S.filters[k] = [];
    if (S.filters[field]) S.filters[field] = [value];
    /* لا تُفتح اللوحة هنا: شريط الفلاتر النشطة أعلى البطاقات يوضّح ما طُبِّق
     * ويسمح بإزالته، فتبقى اللوحة مطويّة كما هو الوضع الافتراضي. */
    S.selected = null; closeDrawer();
    render();
    scrollToAnchor("svc-anchor");
  }
  function scrollToAnchor(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* Stat tiles are entry points, not just numbers: sectors/services jump to
   * their existing on-page section; departments/owners/representatives have
   * no dedicated section, so they open a browsable list instead. */
  var STAT_META = {
    department: { label: "الإدارات العامة", icon: "building" },
    owner: { label: "ملاك الخدمات", icon: "user" },
    representative: { label: "ممثلو الخدمات", icon: "users" }
  };
  function statClick(stat) {
    if (stat === "sectors") { scrollToAnchor("sectors-anchor"); return; }
    if (stat === "services") { clearFilters(); scrollToAnchor("svc-anchor"); return; }
    var m = STAT_META[stat]; if (!m) return;
    statListModal(stat, m.label, m.icon);
  }
  function statListModal(field, title, icon) {
    var values = allValues(field).filter(Boolean).sort(function (a, b) {
      var d = usageCount(field, b) - usageCount(field, a);
      return d !== 0 ? d : a.localeCompare(b, "ar");
    });
    var rows = values.map(function (v) {
      return '<button type="button" class="mrow link" data-act="goto-filter" data-field="' + field + '" data-value="' + attr(v) + '">' +
        '<div class="mtxt"><b>' + esc(v) + '</b></div>' +
        '<span class="usage">' + usageCount(field, v) + ' خدمة</span>' + ICON("arrowLeft") + '</button>';
    }).join("");
    var m = openModal(
      '<div class="modal-head"><div class="mi">' + ICON(icon) + '</div><h2>' + esc(title) + '</h2>' +
      '<button class="icon-btn" id="statlist-close" style="margin-inline-start:auto">' + ICON("close") + '</button></div>' +
      '<div class="modal-body"><div class="mlist">' + (rows || '<div class="empty" style="padding:30px"><p>لا توجد بيانات بعد.</p></div>') + '</div></div>'
    );
    $("#statlist-close", m).addEventListener("click", closeModal);
  }

  /* =====================================================================
   * SERVICE FORM (add / edit)
   * ===================================================================== */
  function openServiceForm(id) {
    var s = id ? services().filter(function (x) { return x.id === id; })[0] : null;
    var isEdit = !!s;
    s = s || {};
    var sectors = uniqueSectors();
    var cats = uniq(C.taxonomy.categories.concat(allValues("category"))).filter(Boolean);
    /* حساب مقيّد بإدارة (غير مدير النظام) — قطاعه وإدارته مفروضان من حسابه */
    var scoped = !isAdmin() && S.currentUser && S.currentUser.department;

    function dl(idn, values) { return '<datalist id="' + idn + '">' + uniq(values).filter(Boolean).map(function (v) { return '<option value="' + attr(v) + '">'; }).join("") + '</datalist>'; }
    function inp(name, label, val, list, req) {
      return '<div class="form-row"><label>' + esc(label) + (req ? ' <span class="req">*</span>' : '') + '</label>' +
        '<input type="text" name="' + name + '" value="' + attr(val || "") + '"' + (list ? ' list="' + list + '" autocomplete="off"' : '') + '></div>';
    }
    /* حقل مقفل: صاحب الإدارة لا يغيّر قطاعه أو إدارته — القيمة تُفرض من حسابه */
    function lockedInp(name, label, val, hint) {
      return '<div class="form-row"><label>' + esc(label) + '</label>' +
        '<input type="text" name="' + name + '" value="' + attr(val || "") + '" readonly class="locked">' +
        '<span class="row-hint">' + ICON("lock") + esc(hint || "") + '</span></div>';
    }
    function ta(name, label, val, full, tall) {
      return '<div class="form-row ' + (full ? "full" : "") + '"><label>' + esc(label) + '</label><textarea name="' + name + '" class="' + (tall ? "tall" : "") + '">' + esc(val || "") + '</textarea></div>';
    }
    function sel(name, label, options, cur, allowEmpty) {
      return '<div class="form-row"><label>' + esc(label) + '</label><select name="' + name + '">' +
        (allowEmpty ? '<option value="">—</option>' : '') +
        options.map(function (o) { return '<option value="' + attr(o) + '"' + (cur === o ? " selected" : "") + '>' + esc(o) + '</option>'; }).join("") + '</select></div>';
    }
    function chkGroup(group, label, options, selected) {
      selected = selected || [];
      return '<div class="form-row full"><label>' + esc(label) + '</label><div class="chk-grid">' + options.map(function (o) {
        var on = selected.indexOf(o) >= 0;
        return '<button type="button" class="chk' + (on ? " on" : "") + '" data-act="chk-toggle" data-group="' + group + '" data-value="' + attr(o) + '">' +
          (on ? ICON("check") : "") + esc(o) + '</button>';
      }).join("") + '</div></div>';
    }
    function formSection(title, icon, inner) {
      return '<div class="filter-group"><div class="fg-head"><div class="fi">' + ICON(icon) + '</div><b>' + esc(title) + '</b></div>' +
        '<div class="form-grid">' + inner + '</div></div>';
    }
    var objOptions = uniq(C.taxonomy.objectives.concat(services().reduce(function (a, x) { return a.concat(x.objectives || []); }, [])));
    var benOptions = uniq(C.taxonomy.beneficiaries.concat(services().reduce(function (a, x) { return a.concat(x.beneficiaries || []); }, [])));

    var body =
      dl("dl-sector", sectors) + dl("dl-department", allValues("department")) + dl("dl-unit", allValues("unit")) + dl("dl-owner", uniq(services().map(function (x) { return x.owner; }))) + dl("dl-rep", uniq(services().map(function (x) { return x.representative; }))) +
      formSection("المعلومات الأساسية", "doc",
        inp("title", "عنوان الخدمة", s.title, null, true) +
        (scoped
          ? lockedInp("sector", "القطاع", S.currentUser.sector, "محدَّد من حسابك") +
            lockedInp("department", "الإدارة العامة", S.currentUser.department, "خدماتك تُسجَّل تحت إدارتك")
          : inp("sector", "القطاع", s.sector, "dl-sector", true) +
            inp("department", "الإدارة العامة", s.department, "dl-department")) +
        inp("unit", "الإدارة", s.unit, "dl-unit")
      ) +
      formSection("الفريق المسؤول", "users",
        inp("owner", "مالك الخدمة", s.owner, "dl-owner") +
        inp("representative", "ممثل الخدمة", s.representative, "dl-rep")
      ) +
      formSection("التصنيف", "tag",
        sel("stage", "مرحلة التحول الرقمي", C.stages.map(function (x) { return x.key; }), s.stage, true) +
        sel("category", "الفئة", cats, s.category, true) +
        inp("sla", "الخط الزمني (SLA)", s.sla)
      ) +
      (scoped && !isEdit
        ? formSection("حالة الإتاحة", "power",
            '<div class="form-row full"><div class="status-notice" style="--c:' + I.statusColor(C.newServiceStatus) + ';margin:0">' +
              ICON("analysis") + '<div><b>ستُسجَّل بحالة «' + esc(C.newServiceStatus) + '»</b>' +
              '<span>تدخل الخدمة الكتالوج فورًا موسومة بأنها قيد التحليل، ويعتمدها مدير النظام لاحقًا بعد مراجعتها.</span></div></div></div>'
          )
        : formSection("حالة الإتاحة", "power",
            sel("status", "الحالة", C.serviceStatuses.map(function (x) { return x.key; }), C.normalizeStatus(s.status), false) +
            inp("statusNote", "سبب الإيقاف / ملاحظة على الحالة", s.statusNote) +
            '<div class="form-row full"><span class="muted" style="font-size:11.5px;line-height:1.7">' +
              C.serviceStatuses.map(function (x) { return '<b style="color:' + (I.isDark() ? x.colorDark : x.color) + '">' + esc(x.label) + '</b>: ' + esc(x.desc); }).join(" · ") +
            '</span></div>'
          )) +
      formSection("الارتباط الاستراتيجي", "target",
        chkGroup("objectives", "الأهداف الاستراتيجية", objOptions, s.objectives) +
        chkGroup("beneficiaries", "المستفيدون", benOptions, s.beneficiaries)
      ) +
      formSection("تفاصيل الخدمة", "briefcase",
        ta("description", "وصف الخدمة", s.description, true, true) +
        ta("goals", "الأهداف المرجوّة", s.goals, true, true) +
        ta("prerequisites", "المتطلبات الأولية", s.prerequisites) +
        ta("outputs", "المخرجات المتوقّعة", s.outputs) +
        ta("stageRationale", "مبرر تصنيف المرحلة", s.stageRationale, true)
      );

    var m = openModal(
      '<div class="modal-head"><div class="mi">' + ICON(isEdit ? "edit" : "plus") + '</div><h2>' + (isEdit ? "تعديل خدمة" : "إضافة خدمة جديدة") + '</h2>' +
        '<button class="icon-btn" data-act="close-modal-x" style="margin-inline-start:auto">' + ICON("close") + '</button></div>' +
      '<form id="svc-form"><div class="modal-body">' + body + '</div>' +
      '<div class="modal-foot"><button type="submit" class="btn primary">' + ICON("check") + (isEdit ? "حفظ التعديلات" : "إضافة الخدمة") + '</button>' +
      '<button type="button" class="btn ghost" id="cancel-form">إلغاء</button>' +
      (S.token ? '' : '<span class="muted" style="font-size:11.5px;align-self:center">تعذّر العثور على صلاحية الكتابة — سيُحفظ محليًا فقط في هذا المتصفح</span>') + '</div></form>');

    $("#cancel-form", m).addEventListener("click", closeModal);
    $("[data-act='close-modal-x']", m).addEventListener("click", closeModal);
    $("#svc-form", m).addEventListener("submit", function (e) { e.preventDefault(); saveServiceForm(id, m); });

    /* Department suggestions follow the typed sector — same fix as the
     * browse-side filter panel: don't show all 18 departments regardless
     * of sector, scope to the ones that actually belong to it. */
    var sectorInput = $('[name="sector"]', m);
    var deptDatalist = $("#dl-department", m);
    var allDeptOptions = allValues("department").filter(Boolean);
    function refreshDeptOptions() {
      var sv = sectorInput.value.trim();
      var scoped = sv ? uniq(services().filter(function (x) { return x.sector === sv; }).map(function (x) { return x.department; })).filter(Boolean) : [];
      var list = scoped.length ? scoped : allDeptOptions;
      deptDatalist.innerHTML = list.map(function (v) { return '<option value="' + attr(v) + '">'; }).join("");
    }
    sectorInput.addEventListener("input", refreshDeptOptions);
    refreshDeptOptions();

    /* Same idea one level down: "الإدارة" suggestions follow the typed
     * الإدارة العامة, once services start recording units under it. */
    var deptInput = $('[name="department"]', m);
    var unitDatalist = $("#dl-unit", m);
    var allUnitOptions = allValues("unit").filter(Boolean);
    function refreshUnitOptions() {
      var dv = deptInput.value.trim();
      var scoped = dv ? uniq(services().filter(function (x) { return x.department === dv; }).map(function (x) { return x.unit; })).filter(Boolean) : [];
      var list = scoped.length ? scoped : allUnitOptions;
      unitDatalist.innerHTML = list.map(function (v) { return '<option value="' + attr(v) + '">'; }).join("");
    }
    deptInput.addEventListener("input", refreshUnitOptions);
    refreshUnitOptions();
  }

  function saveServiceForm(id, m) {
    var form = $("#svc-form", m);
    function val(n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ""; }
    var title = val("title"), sector = val("sector");
    if (!title) { toast("عنوان الخدمة مطلوب", "err"); return; }
    if (!sector) { toast("القطاع مطلوب", "err"); return; }
    function chks(group) { return $all('.chk.on[data-group="' + group + '"]', m).map(function (c) { return c.getAttribute("data-value"); }); }

    var rec = {
      title: title, sector: sector,
      department: val("department"), unit: val("unit"), owner: val("owner"), representative: val("representative"),
      stage: val("stage"), category: val("category"), sla: val("sla"),
      status: C.normalizeStatus(val("status")), statusNote: val("statusNote"),
      objectives: chks("objectives"), beneficiaries: chks("beneficiaries"),
      description: val("description"), goals: val("goals"), prerequisites: val("prerequisites"),
      outputs: val("outputs"), stageRationale: val("stageRationale"),
      updatedAt: I.todayISO()
    };
    /* an owner/representative can only ever act inside their own إدارة —
     * override whatever the free-text fields say, don't trust them */
    if (!isAdmin() && S.currentUser) {
      if (S.currentUser.sector) rec.sector = S.currentUser.sector;
      if (S.currentUser.department) rec.department = S.currentUser.department;
    }

    var list = S.catalog.services;
    function nextId() { return list.reduce(function (mx, x) { return Math.max(mx, x.id || 0); }, 0) + 1; }

    if (isAdmin()) {
      if (id) {
        for (var i = 0; i < list.length; i++) if (list[i].id === id) { rec.id = id; list[i] = Object.assign({}, list[i], rec); break; }
      } else {
        rec.id = nextId();
        list.unshift(rec);
      }
      closeModal();
      commitChange(id ? "تعديل خدمة: " + title : "إضافة خدمة: " + title, render, id ? "تم حفظ التعديلات" : "تمت إضافة الخدمة");
    } else if (!id) {
      /* خدمة جديدة يقترحها صاحب إدارة: تدخل الكتالوج فورًا لكن بحالة
       * «جاري التحليل» — يراها صاحبها ومدير النظام، ولا تُعدّ خدمة معتمدة حتى
       * يحللها المدير ويغيّر حالتها. هذا هو طابور اعتماد الخدمات الجديدة،
       * بخلاف التعديل/الحذف على خدمة قائمة الذي يبقى عبر طلبات المراجعة. */
      rec.status = C.newServiceStatus;
      rec.statusNote = rec.statusNote || ("مقترحة من " + S.currentUser.name + " — بانتظار التحليل والاعتماد");
      rec.submittedByName = S.currentUser.name;
      rec.submittedAt = I.todayISO();
      rec.id = nextId();
      list.unshift(rec);
      closeModal();
      commitChange("إضافة خدمة (جاري التحليل): " + title, render,
        "تمت إضافة الخدمة بحالة «جاري التحليل» — سيراجعها مدير النظام ويعتمدها");
    } else {
      var before = list.filter(function (x) { return x.id === id; })[0];
      submitPendingEdit("edit", id, before || null, rec, title);
      closeModal();
    }
  }

  function deleteService(id) {
    var s = services().filter(function (x) { return x.id === id; })[0]; if (!s) return;
    confirmDialog({ title: "حذف الخدمة", message: 'سيتم حذف الخدمة: «' + s.title + '». لا يمكن التراجع.', confirm: "حذف", danger: true }).then(function (ok) {
      if (!ok) return;
      if (isAdmin()) {
        S.catalog.services = S.catalog.services.filter(function (x) { return x.id !== id; });
        closeDrawer();
        commitChange("حذف خدمة: " + s.title, render, "تم حذف الخدمة");
      } else {
        submitPendingEdit("delete", id, s, null, s.title);
        closeDrawer();
      }
    });
  }

  /* Owner/representative changes never apply directly — they're queued for
   * مدير النظام to approve, per the (deliberately UI-enforced, not
   * cryptographically enforced) role model this catalog uses. */
  function submitPendingEdit(action, serviceId, before, after, titleForMsg) {
    var u = S.currentUser;
    var rec = {
      id: pendingEdits().reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1,
      action: action, serviceId: serviceId, before: before, after: after,
      titleSnapshot: titleForMsg, sector: u.sector, department: u.department || null,
      submittedBy: u.id, submittedByName: u.name,
      submittedAt: I.todayISO(), status: "pending", reviewNote: null, reviewedBy: null, reviewedAt: null
    };
    pendingEdits().push(rec);
    var verb = action === "add" ? "إضافة" : action === "delete" ? "حذف" : "تعديل";
    commitChange(verb + " خدمة (بانتظار الموافقة): " + titleForMsg, render, "تم إرسال طلبك لمدير النظام للموافقة");
  }

  /* Persist wrapper. onRender refreshes UI (runs in every branch — local state
   * already mutated). okText is the success message, shown ONLY on real success. */
  function commitChange(commitMsg, onRender, okText) {
    persist(commitMsg).then(function (r) {
      if (onRender) onRender();
      if (r && r.ok) toast(okText || "تم الحفظ", "ok", "تم الحفظ في GitHub");
      else if (r && r.local) toast(okText || "تم الحفظ محليًا", "ok", "محفوظ في هذا المتصفح — أضِف رمز GitHub للحفظ المشترك");
    }).catch(function (err) {
      if (err && err.conflict) { if (onRender) onRender(); handleConflict(commitMsg, onRender, okText); return; }
      if (onRender) onRender();
      toast("لم يُحفظ في GitHub", "err", "تغييرك محلي فقط — " + String(err.message || err));
    });
  }

  /* Concurrent-edit conflict: let the editor choose, never clobber silently */
  function handleConflict(commitMsg, onRender, okText) {
    var m = openModal(
      '<div class="modal-head"><div class="mi" style="background:var(--danger-soft);color:var(--danger)">' + ICON("refresh") + '</div><h2>تعارض في التعديلات</h2></div>' +
      '<div class="modal-body"><p style="font-size:13.5px;color:var(--ink-2);line-height:1.7">تم تعديل الكتالوج من مستخدم آخر منذ آخر مزامنة. اختر كيف تريد المتابعة — حتى لا تُفقد تعديلات أحدكما دون قصد:</p></div>' +
      '<div class="modal-foot"><button class="btn primary" data-rep>' + ICON("check") + 'استبدال بنسختي</button>' +
      '<button class="btn" data-rel>' + ICON("download") + 'تحميل النسخة الأحدث</button>' +
      '<button class="btn ghost" data-cancel>إلغاء</button></div>', { sm: true });
    $("[data-rep]", m).addEventListener("click", function () {
      closeModal();
      persist(commitMsg, { force: true }).then(function () { if (onRender) onRender(); toast(okText || "تم الحفظ", "ok", "تم الاستبدال في GitHub"); })
        .catch(function (e) { toast("تعذّر الحفظ", "err", String(e.message || e)); });
    });
    $("[data-rel]", m).addEventListener("click", function () { closeModal(); reloadData(); });
    $("[data-cancel]", m).addEventListener("click", closeModal);
  }

  /* =====================================================================
   * REVIEW — مدير النظام approves/rejects submitted edits and new accounts.
   * Nothing an owner/representative submits ever touches the live catalog
   * until it passes through here.
   * ===================================================================== */
  var FIELD_LABELS = {
    title: "عنوان الخدمة", sector: "القطاع", department: "الإدارة العامة", unit: "الإدارة",
    owner: "مالك الخدمة", representative: "ممثل الخدمة", stage: "المرحلة", category: "الفئة",
    status: "حالة الإتاحة", statusNote: "سبب الإيقاف", sla: "SLA", description: "الوصف", goals: "الأهداف المرجوّة",
    prerequisites: "المتطلبات", outputs: "المخرجات", stageRationale: "مبرر المرحلة",
    objectives: "الأهداف الاستراتيجية", beneficiaries: "المستفيدون"
  };
  function fieldStr(v) { return Array.isArray(v) ? v.join("، ") : (v == null ? "" : String(v)); }
  function diffRows(before, after) {
    var keys = Object.keys(FIELD_LABELS);
    var rows = [];
    keys.forEach(function (k) {
      var b = before ? fieldStr(before[k]) : "";
      var a = after ? fieldStr(after[k]) : "";
      if (before && after && b === a) return; /* edit: only show changed fields */
      if (!a && !b) return;
      rows.push({ label: FIELD_LABELS[k], before: b, after: a });
    });
    return rows;
  }

  function openReview() {
    accountsView = "review";
    reviewTab = "edits";
    var m = openModal(
      '<div class="modal-head"><div class="mi">' + ICON("list") + '</div><h2>طلبات المراجعة</h2>' +
      '<button class="icon-btn" id="rev-close" style="margin-inline-start:auto">' + ICON("close") + '</button></div>' +
      '<div class="modal-body manage-body"><div id="review-shell"></div></div>');
    $("#rev-close", m).addEventListener("click", function () { accountsView = null; closeModal(); });
    renderReview();
  }
  function renderReview() {
    var shell = $("#review-shell"); if (!shell) return;
    var editCount = pendingEdits().filter(function (p) { return p.status === "pending"; }).length;
    var userCount = users().filter(function (u) { return u.status === "pending"; }).length;
    shell.innerHTML =
      '<div class="seg-row">' +
        '<button class="seg' + (reviewTab === "edits" ? " on" : "") + '" data-act="review-tab" data-tab="edits">' + ICON("edit") + '<span>طلبات التعديل</span><b>' + editCount + '</b></button>' +
        '<button class="seg' + (reviewTab === "analysis" ? " on" : "") + '" data-act="review-tab" data-tab="analysis">' + ICON("analysis") + '<span>خدمات للتحليل</span><b>' + I.analysisServices().length + '</b></button>' +
        '<button class="seg' + (reviewTab === "users" ? " on" : "") + '" data-act="review-tab" data-tab="users">' + ICON("users") + '<span>طلبات الحسابات</span><b>' + userCount + '</b></button>' +
      '</div><div id="review-list"></div>';
    renderReviewList();
  }
  function reviewEmpty(msg) { return '<div class="empty" style="padding:30px"><p>' + esc(msg) + '</p></div>'; }
  function statusBadge(status) {
    var map = { pending: ["قيد المراجعة", "warn"], approved: ["مقبول", "ok"], rejected: ["مرفوض", "err"] };
    var v = map[status] || [status, ""];
    return '<span class="rv-status ' + v[1] + '">' + v[0] + '</span>';
  }
  function renderReviewList() {
    var list = $("#review-list"); if (!list) return;
    if (reviewTab === "edits") {
      var items = pendingEdits().slice().sort(function (a, b) { return b.id - a.id; });
      list.innerHTML = items.length ? items.map(editRowHTML).join("") : reviewEmpty("لا توجد طلبات تعديل بعد.");
    } else if (reviewTab === "analysis") {
      var pend = I.analysisServices().slice().sort(function (a, b) { return b.id - a.id; });
      list.innerHTML = pend.length ? pend.map(analysisRowHTML).join("")
        : reviewEmpty("لا توجد خدمات جديدة بانتظار التحليل.");
    } else {
      /* هذا طابور مراجعة: الحسابات المعلّقة فقط. الإدارة الكاملة لها لوحتها. */
      var us = users().filter(function (u) { return u.status === "pending"; }).sort(function (a, b) { return b.id - a.id; });
      list.innerHTML =
        '<button class="btn block" data-act="users-manage" style="margin-bottom:12px">' + ICON("users") + 'فتح لوحة إدارة المستخدمين</button>' +
        (us.length ? us.map(userRowHTML).join("") : reviewEmpty("لا توجد طلبات حسابات جديدة."));
    }
  }
  var actionLabel = { add: "إضافة", edit: "تعديل", delete: "حذف" };
  function editRowHTML(e) {
    var rows = e.action === "delete" ? diffRows(e.before, null) : diffRows(e.action === "edit" ? e.before : null, e.after);
    var detail = rows.map(function (r) {
      return '<div class="diff-row"><b>' + esc(r.label) + '</b>' +
        (e.action !== "add" ? '<span class="diff-before">' + esc(r.before || "—") + '</span>' : "") +
        (e.action !== "delete" ? '<span class="diff-after">' + esc(r.after || "—") + '</span>' : "") +
        '</div>';
    }).join("");
    return '<div class="rv-card">' +
      '<div class="rv-head"><span class="badge plain">' + esc(actionLabel[e.action]) + '</span>' +
      '<b class="rv-title">' + esc(e.titleSnapshot) + '</b>' + statusBadge(e.status) + '</div>' +
      '<div class="rv-meta">' + ICON("user") + esc(e.submittedByName) + ' · ' + ICON("building") + esc(e.department || e.sector || "—") + ' · ' + esc(I.fmtDate(e.submittedAt)) + '</div>' +
      (detail ? '<button type="button" class="rv-toggle" data-act="rv-toggle">' + ICON("chevronDown") + 'عرض التفاصيل</button><div class="rv-detail hidden">' + detail + '</div>' : "") +
      (e.status === "pending" ? '<div class="rv-acts"><button class="btn primary sm" data-act="review-approve" data-value="' + e.id + '">' + ICON("check") + 'قبول وتطبيق</button>' +
        '<button class="btn danger sm" data-act="review-reject" data-value="' + e.id + '">' + ICON("close") + 'رفض</button></div>' :
        '<div class="rv-meta">' + ICON("check") + 'راجعه ' + esc(e.reviewedBy || "") + ' · ' + esc(I.fmtDate(e.reviewedAt)) + '</div>') +
      '</div>';
  }
  /* ---- خدمات جديدة أضافها أصحاب الإدارات وتنتظر تحليل مدير النظام ----
   * هذه ليست طلبات معلّقة: الخدمة موجودة فعلًا في الكتالوج بحالة «جاري
   * التحليل»، والاعتماد هنا يعني نقلها إلى «مفعلة». */
  function analysisRowHTML(s) {
    var rows = [
      ["القطاع", s.sector], ["الإدارة العامة", s.department], ["الإدارة", s.unit],
      ["مالك الخدمة", s.owner], ["ممثل الخدمة", s.representative],
      ["المرحلة", s.stage], ["الفئة", s.category], ["الخط الزمني (SLA)", s.sla],
      ["وصف الخدمة", s.description], ["الأهداف المرجوّة", s.goals],
      ["المتطلبات الأولية", s.prerequisites], ["المخرجات المتوقّعة", s.outputs],
      ["الأهداف الاستراتيجية", (s.objectives || []).join("، ")],
      ["المستفيدون", (s.beneficiaries || []).join("، ")]
    ].filter(function (r) { return r[1]; });
    var detail = rows.map(function (r) {
      return '<div class="diff-row"><b>' + esc(r[0]) + '</b><span class="diff-after">' + esc(r[1]) + '</span></div>';
    }).join("");
    return '<div class="rv-card">' +
      '<div class="rv-head">' + I.statusBadgeHTML(C.newServiceStatus) +
        '<b class="rv-title">' + esc(s.title) + '</b></div>' +
      '<div class="rv-meta">' + ICON("user") + esc(s.submittedByName || s.owner || "—") + ' · ' +
        ICON("building") + esc(s.department || s.sector || "—") + ' · ' + esc(I.fmtDate(s.submittedAt || s.updatedAt)) + '</div>' +
      (detail ? '<button type="button" class="rv-toggle" data-act="rv-toggle">' + ICON("chevronDown") + 'عرض تفاصيل الخدمة</button><div class="rv-detail hidden">' + detail + '</div>' : "") +
      '<div class="rv-acts">' +
        '<button class="btn primary sm" data-act="analysis-approve" data-value="' + s.id + '">' + ICON("check") + 'اعتماد وتفعيل</button>' +
        '<button class="btn sm" data-act="analysis-open" data-value="' + s.id + '">' + ICON("edit") + 'فتح وتعديل</button>' +
        '<button class="btn danger sm" data-act="analysis-reject" data-value="' + s.id + '">' + ICON("close") + 'رفض</button>' +
      '</div></div>';
  }
  function analysisApprove(sid) {
    var s = allServices().filter(function (x) { return x.id === sid; })[0]; if (!s) return;
    s.status = "مفعلة";
    /* الملاحظة كانت آلية («مقترحة من فلان…») فلا معنى لبقائها بعد الاعتماد */
    s.statusNote = "";
    s.updatedAt = I.todayISO();
    commitChange("اعتماد خدمة جديدة: " + s.title, function () { renderReview(); render(); }, "تم اعتماد الخدمة وتفعيلها");
  }
  function analysisReject(sid) {
    var s = allServices().filter(function (x) { return x.id === sid; })[0]; if (!s) return;
    confirmDialog({
      title: "رفض الخدمة المقترحة",
      message: 'رفض «' + s.title + '»؟ ستُنقل إلى حالة «متوقفة» ولن تُحذف — يمكنك حذفها نهائيًا لاحقًا من بطاقتها.',
      confirm: "رفض", danger: true
    }).then(function (ok) {
      if (!ok) return;
      s.status = "متوقفة";
      s.statusNote = "رُفضت بعد التحليل من " + S.currentUser.name;
      s.updatedAt = I.todayISO();
      commitChange("رفض خدمة مقترحة: " + s.title, function () { renderReview(); render(); }, "تم رفض الخدمة");
    });
  }

  function reviewApprove(editId) {
    var e = pendingEdits().filter(function (x) { return x.id === editId; })[0]; if (!e || e.status !== "pending") return;
    var list = S.catalog.services;
    if (e.action === "add") {
      var rec = Object.assign({}, e.after);
      rec.id = list.reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
      list.unshift(rec);
    } else if (e.action === "edit") {
      for (var i = 0; i < list.length; i++) if (list[i].id === e.serviceId) { list[i] = Object.assign({}, list[i], e.after); break; }
    } else if (e.action === "delete") {
      S.catalog.services = list.filter(function (x) { return x.id !== e.serviceId; });
    }
    e.status = "approved"; e.reviewedBy = S.currentUser.name; e.reviewedAt = I.todayISO();
    commitChange("قبول طلب: " + e.titleSnapshot, function () { renderReviewList(); render(); }, "تم القبول والتطبيق");
  }
  function reviewReject(editId) {
    var e = pendingEdits().filter(function (x) { return x.id === editId; })[0]; if (!e || e.status !== "pending") return;
    e.status = "rejected"; e.reviewedBy = S.currentUser.name; e.reviewedAt = I.todayISO();
    commitChange("رفض طلب: " + e.titleSnapshot, renderReviewList, "تم الرفض");
  }

  /* =====================================================================
   * ACCOUNTS — عرض موحّد لبطاقة المستخدم، تستخدمه لوحة المراجعة (المعلّقة فقط)
   * ولوحة «إدارة المستخدمين» الكاملة على حد سواء.
   * ===================================================================== */
  var ROLE_LABEL = { admin: "مدير النظام", owner_rep: "مالك/ممثل خدمات" };
  var ROLE_ICON = { admin: "key", owner_rep: "user" };

  function roleBadge(role) {
    return '<span class="role-badge ' + (role === "admin" ? "admin" : "owner") + '">' +
      ICON(ROLE_ICON[role] || "user") + esc(ROLE_LABEL[role] || role) + '</span>';
  }

  /* آخر مدير نظام نشط لا يجوز تعطيله أو تنزيل دوره أو حذفه — وإلا أُغلق النظام
   * على الجميع بلا أي حساب قادر على الاعتماد. */
  function otherActiveAdmins(uid) {
    return users().filter(function (x) {
      return x.role === "admin" && x.status === "approved" && x.id !== uid;
    }).length;
  }
  function guardLastAdmin(u, what) {
    if (u.role === "admin" && u.status === "approved" && otherActiveAdmins(u.id) === 0) {
      toast("تعذّر " + what, "err", "هذا آخر حساب مدير نظام نشط — عيّن مديرًا آخر أولًا");
      return false;
    }
    return true;
  }

  function userRowHTML(u) {
    var isSelf = S.currentUser && S.currentUser.id === u.id;
    var cls = u.status === "pending" ? " is-pending" : (u.status === "rejected" ? " is-off" : "");

    var ctl = "";
    if (!isSelf) {
      ctl += '<select class="mini-select" data-act="user-role" data-value="' + u.id + '">' +
        '<option value="owner_rep"' + (u.role === "owner_rep" ? " selected" : "") + '>مالك/ممثل خدمات</option>' +
        '<option value="admin"' + (u.role === "admin" ? " selected" : "") + '>مدير النظام</option>' +
        '</select>';
    }
    if (u.role !== "admin") {
      ctl += '<select class="mini-select" data-act="user-sector" data-value="' + u.id + '">' +
        '<option value="">اختر القطاع…</option>' +
        uniqueSectors().map(function (x) { return '<option value="' + attr(x) + '"' + (u.sector === x ? " selected" : "") + '>' + esc(x) + '</option>'; }).join("") +
        '</select>';
      var deps = departmentsOfSector(u.sector);
      ctl += '<select class="mini-select" data-act="user-department" data-value="' + u.id + '"' + (u.sector ? "" : " disabled") + '>' +
        '<option value="">' + (u.sector ? "اختر الإدارة العامة…" : "اختر القطاع أولًا…") + '</option>' +
        deps.map(function (d) { return '<option value="' + attr(d) + '"' + (u.department === d ? " selected" : "") + '>' + esc(d) + '</option>'; }).join("") +
        '</select>';
    }

    var acts = "";
    if (u.status === "pending") {
      acts += '<button class="btn primary sm" data-act="user-approve" data-value="' + u.id + '">' + ICON("check") + 'قبول الحساب</button>' +
              '<button class="btn danger sm" data-act="user-reject" data-value="' + u.id + '">' + ICON("close") + 'رفض</button>';
    } else if (u.status === "approved") {
      if (u.role === "owner_rep" && (u.department || u.sector)) {
        acts += '<button class="btn sm" data-act="user-assign" data-value="' + u.id + '">' + ICON("briefcase") + 'تعيين لخدمات</button>';
      }
      acts += '<button class="btn sm" data-act="user-reset-pw" data-value="' + u.id + '">' + ICON("key") + 'كلمة مرور جديدة</button>';
      if (!isSelf) acts += '<button class="btn danger sm" data-act="user-deactivate" data-value="' + u.id + '">' + ICON("lock") + 'تعطيل</button>';
    } else {
      acts += '<button class="btn primary sm" data-act="user-reactivate" data-value="' + u.id + '">' + ICON("check") + 'إعادة تفعيل</button>';
    }
    if (!isSelf) acts += '<button class="btn danger sm" data-act="user-delete" data-value="' + u.id + '">' + ICON("trash") + 'حذف نهائي</button>';

    var scope = u.role === "admin"
      ? ICON("layers") + '<span>وصول كامل لجميع القطاعات والإدارات</span>'
      : (u.department
          ? ICON("building") + '<span>' + esc(u.department) + '</span>' + ICON("layers") + '<span class="muted">' + esc(u.sector || "—") + '</span>'
          : ICON("info") + '<span class="muted">لم يُحدَّد نطاق بعد — لن يرى أي خدمة</span>');

    return '<div class="um-card' + cls + '">' +
      '<div class="um-top">' +
        '<span class="avatar" style="width:34px;height:34px;font-size:12px;flex:none;background:' + I.avatarColor(u.name) + '">' + esc(I.initials(u.name)) + '</span>' +
        '<div class="um-id"><b>' + esc(u.name) + (isSelf ? ' <span class="muted" style="font-weight:500">(أنت)</span>' : '') + '</b>' +
          '<span>@' + esc(u.username) + ' · انضم ' + esc(I.fmtDate(u.createdAt)) + '</span></div>' +
        roleBadge(u.role) + statusBadge(u.status) +
      '</div>' +
      '<div class="um-scope">' + scope + '</div>' +
      (ctl ? '<div class="um-ctl">' + ctl + '</div>' : '') +
      '<div class="um-acts">' + acts + '</div>' +
    '</div>';
  }

  /* ---- لوحة إدارة المستخدمين (مدير النظام فقط) ---- */
  var umFilter = "all";   /* all | pending | approved | rejected */
  var umSearch = "";

  function openUsers(restore) {
    if (!isAdmin()) { toast("هذه اللوحة لمدير النظام فقط", "err"); return; }
    if (!restore) { umFilter = "all"; umSearch = ""; }
    accountsView = "users";
    var m = openModal(
      '<div class="modal-head"><div class="mi">' + ICON("users") + '</div><h2>إدارة المستخدمين</h2>' +
      '<button class="icon-btn" id="um-close" style="margin-inline-start:auto">' + ICON("close") + '</button></div>' +
      '<div class="modal-body manage-body"><div id="um-shell"></div></div>');
    $("#um-close", m).addEventListener("click", function () { accountsView = null; closeModal(); });
    renderUsersPanel();
  }

  function renderUsersPanel() {
    var shell = $("#um-shell"); if (!shell) return;
    var all = users();
    var counts = {
      all: all.length,
      pending: all.filter(function (u) { return u.status === "pending"; }).length,
      admins: all.filter(function (u) { return u.role === "admin" && u.status === "approved"; }).length,
      owners: all.filter(function (u) { return u.role === "owner_rep" && u.status === "approved"; }).length
    };
    var tabs = [
      { k: "all", t: "الكل", n: counts.all },
      { k: "pending", t: "بانتظار الموافقة", n: counts.pending },
      { k: "approved", t: "نشط", n: all.filter(function (u) { return u.status === "approved"; }).length },
      { k: "rejected", t: "معطّل/مرفوض", n: all.filter(function (u) { return u.status === "rejected"; }).length }
    ];
    shell.innerHTML =
      '<div class="um-stats">' +
        '<div class="um-stat"><b>' + counts.all + '</b><span>إجمالي الحسابات</span></div>' +
        '<div class="um-stat' + (counts.pending ? " warn" : "") + '"><b>' + counts.pending + '</b><span>بانتظار الموافقة</span></div>' +
        '<div class="um-stat"><b>' + counts.admins + '</b><span>مدراء النظام</span></div>' +
        '<div class="um-stat"><b>' + counts.owners + '</b><span>ملاك وممثلون</span></div>' +
      '</div>' +
      '<div class="um-toolbar">' +
        '<div class="um-search">' + ICON("search") +
          '<input type="search" id="um-q" placeholder="ابحث بالاسم أو اسم المستخدم أو الإدارة…" value="' + attr(umSearch) + '"></div>' +
        '<button class="btn primary sm" data-act="user-create">' + ICON("plus") + 'إضافة مستخدم</button>' +
      '</div>' +
      '<div class="seg-row">' + tabs.map(function (t) {
        return '<button class="seg' + (umFilter === t.k ? " on" : "") + '" data-act="um-filter" data-tab="' + t.k + '">' +
          '<span>' + esc(t.t) + '</span><b>' + t.n + '</b></button>';
      }).join("") + '</div>' +
      '<div id="um-list"></div>' +
      permissionsReference();
    var q = $("#um-q");
    if (q) q.addEventListener("input", function () { umSearch = q.value; renderUsersList(); });
    renderUsersList();
  }

  function renderUsersList() {
    var list = $("#um-list"); if (!list) return;
    var q = umSearch.trim().toLowerCase();
    var rows = users().filter(function (u) {
      if (umFilter !== "all" && u.status !== umFilter) return false;
      if (!q) return true;
      return [u.name, u.username, u.sector, u.department].join(" ").toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) {
      var order = { pending: 0, approved: 1, rejected: 2 };
      return (order[a.status] - order[b.status]) || (a.name || "").localeCompare(b.name || "", "ar");
    });
    list.innerHTML = rows.length ? rows.map(userRowHTML).join("")
      : reviewEmpty(q ? "لا يوجد مستخدم مطابق للبحث." : "لا يوجد مستخدمون في هذه الحالة.");
  }

  /* مرجع الصلاحيات — يوضّح للمدير ما الذي يملكه كل دور فعليًا */
  function permissionsReference() {
    function li(ok, txt) { return '<li class="' + (ok ? "yes" : "no") + '">' + ICON(ok ? "check" : "close") + '<span>' + esc(txt) + '</span></li>'; }
    return '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border)">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:11px">' + ICON("lock") +
        '<b style="font-size:13px">الصلاحيات حسب الدور</b></div>' +
      '<div class="perm-grid">' +
        '<div class="perm-card"><h4>' + ICON("key") + 'مدير النظام</h4><ul>' +
          li(true, "يستعرض ويعدّل جميع الخدمات في كل القطاعات") +
          li(true, "يقبل الحسابات الجديدة ويحدّد أدوارها ونطاقها") +
          li(true, "يعتمد الخدمات الجديدة ويوافق على طلبات التعديل") +
          li(true, "يدير القوائم وكلمة مرور الكتالوج والنسخ الاحتياطي") +
        '</ul></div>' +
        '<div class="perm-card"><h4>' + ICON("user") + 'مالك/ممثل خدمات</h4><ul>' +
          li(true, "يستعرض خدمات إدارته العامة فقط") +
          li(true, "يضيف خدمة جديدة تدخل بحالة «" + C.newServiceStatus + "»") +
          li(true, "يقترح تعديل أو حذف خدمة — بعد موافقة المدير") +
          li(false, "لا يرى خدمات الإدارات الأخرى ولا يدير المستخدمين") +
        '</ul></div>' +
      '</div></div>';
  }

  /* ---- إنشاء حساب مباشرةً من المدير (يُعتمد فورًا بلا طابور انتظار) ---- */
  function openUserCreate() {
    var sectors = uniqueSectors();
    var m = openModal(
      '<div class="modal-head"><div class="mi">' + ICON("plus") + '</div><h2>إضافة مستخدم</h2>' +
      '<button class="icon-btn" data-act="close-modal-x" style="margin-inline-start:auto">' + ICON("close") + '</button></div>' +
      '<form id="uc-form"><div class="modal-body">' +
        '<div class="auth-note">' + ICON("info") + '<p>الحساب المُنشأ من هنا <b>معتمد مباشرة</b> ولا يحتاج موافقة إضافية.</p></div>' +
        '<div class="form-grid">' +
          '<div class="form-row"><label>الاسم الكامل <span class="req">*</span></label><input type="text" name="name"></div>' +
          '<div class="form-row"><label>اسم المستخدم <span class="req">*</span></label><input type="text" name="username" autocomplete="off"></div>' +
          '<div class="form-row"><label>كلمة المرور <span class="req">*</span></label><input type="text" name="pw" placeholder="6 أحرف فأكثر"></div>' +
          '<div class="form-row"><label>الدور</label><select name="role">' +
            '<option value="owner_rep">مالك/ممثل خدمات</option><option value="admin">مدير النظام</option></select></div>' +
          '<div class="form-row"><label>القطاع</label><select name="sector"><option value="">—</option>' +
            sectors.map(function (x) { return '<option value="' + attr(x) + '">' + esc(x) + '</option>'; }).join("") + '</select></div>' +
          '<div class="form-row"><label>الإدارة العامة</label><select name="department" disabled><option value="">اختر القطاع أولًا…</option></select></div>' +
        '</div>' +
        '<p class="form-hint" id="uc-err" style="color:var(--danger);font-weight:600"></p>' +
      '</div>' +
      '<div class="modal-foot"><button type="submit" class="btn primary">' + ICON("check") + 'إنشاء الحساب</button>' +
      '<button type="button" class="btn ghost" id="uc-cancel">إلغاء</button></div></form>');
    $("#uc-cancel", m).addEventListener("click", function () { closeModal(); refreshAccounts(); });

    var secSel = $('[name="sector"]', m), depSel = $('[name="department"]', m), roleSel = $('[name="role"]', m);
    secSel.addEventListener("change", function () {
      var deps = departmentsOfSector(secSel.value);
      depSel.disabled = !deps.length;
      depSel.innerHTML = '<option value="">' + (secSel.value ? "اختر الإدارة العامة…" : "اختر القطاع أولًا…") + '</option>' +
        deps.map(function (d) { return '<option value="' + attr(d) + '">' + esc(d) + '</option>'; }).join("");
    });
    roleSel.addEventListener("change", function () {
      var admin = roleSel.value === "admin";
      secSel.disabled = admin; depSel.disabled = admin || !secSel.value;
    });
    $("#uc-form", m).addEventListener("submit", function (e) { e.preventDefault(); createUserSubmit(m); });
  }

  function createUserSubmit(m) {
    function v(n) { var el = m.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ""; }
    var err = $("#uc-err", m);
    var name = v("name"), username = v("username"), pw = v("pw"), role = v("role");
    var sector = role === "admin" ? "" : v("sector"), department = role === "admin" ? "" : v("department");
    if (!name || !username) { err.textContent = "الاسم واسم المستخدم مطلوبان"; return; }
    if (pw.length < 6) { err.textContent = "كلمة المرور 6 أحرف على الأقل"; return; }
    if (users().some(function (x) { return (x.usernameLower || x.username.toLowerCase()) === username.toLowerCase(); })) {
      err.textContent = "اسم المستخدم مستخدَم بالفعل"; return;
    }
    if (role === "owner_rep" && !department) { err.textContent = "حدّد القطاع والإدارة العامة لحساب مالك/ممثل"; return; }
    Box.hashPassword(pw).then(function (h) {
      var u = {
        id: users().reduce(function (mx, x) { return Math.max(mx, x.id || 0); }, 0) + 1,
        name: name, username: username, usernameLower: username.toLowerCase(),
        salt: h.salt, hash: h.hash, role: role,
        sector: sector || null, department: department || null,
        status: "approved", createdAt: I.todayISO()
      };
      users().push(u);
      closeModal();
      commitChange("إنشاء حساب: " + name, refreshAccounts, "تم إنشاء الحساب");
    }).catch(function () { err.textContent = "تعذّر إنشاء الحساب"; });
  }

  /* ---- تعيين كلمة مرور جديدة لمستخدم ---- */
  function userResetPassword(uid) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    var m = openModal(
      '<div class="modal-head"><div class="mi">' + ICON("key") + '</div><h2>كلمة مرور جديدة</h2></div>' +
      '<div class="modal-body"><p style="font-size:13px;color:var(--ink-2);line-height:1.7;margin-bottom:12px">' +
        'تعيين كلمة مرور جديدة لحساب <b>' + esc(u.name) + '</b> (@' + esc(u.username) + '). أبلغه بها بنفسك — لا تُعرض مرة أخرى.</p>' +
        '<input type="text" id="rp-pw" placeholder="كلمة المرور الجديدة (6 أحرف فأكثر)" ' +
          'style="width:100%;height:44px;border-radius:11px;border:1px solid var(--border);background:var(--surface-2);padding-inline:13px;font-size:13.5px">' +
        '<p class="form-hint" id="rp-err" style="color:var(--danger);font-weight:600;margin-top:8px"></p></div>' +
      '<div class="modal-foot"><button class="btn primary" id="rp-ok">' + ICON("check") + 'تعيين</button>' +
      '<button class="btn ghost" id="rp-cancel">إلغاء</button></div>', { sm: true });
    $("#rp-cancel", m).addEventListener("click", function () { closeModal(); refreshAccounts(); });
    $("#rp-ok", m).addEventListener("click", function () {
      var pw = $("#rp-pw", m).value;
      if (pw.length < 6) { $("#rp-err", m).textContent = "كلمة المرور 6 أحرف على الأقل"; return; }
      Box.hashPassword(pw).then(function (h) {
        u.salt = h.salt; u.hash = h.hash;
        closeModal();
        commitChange("تغيير كلمة مرور حساب: " + u.name, refreshAccounts, "تم تعيين كلمة المرور");
      });
    });
  }

  /* ---- حذف نهائي (لا يمس الخدمات، فقط الحساب) ---- */
  function userDelete(uid) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    if (!guardLastAdmin(u, "الحذف")) return;
    confirmDialog({
      title: "حذف الحساب نهائيًا",
      message: 'حذف حساب «' + u.name + '» نهائيًا؟ لا يمكن التراجع. الخدمات المرتبطة به لن تُحذف.',
      confirm: "حذف نهائي", danger: true
    }).then(function (ok) {
      if (!ok) { refreshAccounts(); return; }
      S.catalog.users = users().filter(function (x) { return x.id !== uid; });
      commitChange("حذف حساب: " + u.name, refreshAccounts, "تم حذف الحساب");
    });
  }

  /* بطاقات المستخدم تظهر في لوحتين (المراجعة + إدارة المستخدمين) — هذه الدالة
   * تُحدّث المفتوحة منهما، فلا يحتاج كل إجراء أن يعرف من أين نُودي عليه. */
  var accountsView = null;   /* "users" | "review" — panel to return to after a sub-dialog */
  function refreshAccounts() {
    /* closeModal() only drops the .show class and removes the node 200ms later,
     * so a plain element lookup can still match a modal on its way out —
     * repaint only a modal that is genuinely still open. */
    var m = $("#modal"), live = !!(m && m.classList.contains("show"));
    if (live && $("#um-shell")) renderUsersPanel();
    else if (live && $("#review-list")) renderReview();
    else if (accountsView === "users") openUsers(true);
    else if (accountsView === "review") openReview();
    if (S.currentUser) render();
  }

  function userApprove(uid) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    if (u.role === "owner_rep" && !u.sector) { toast("حدّد القطاع أولًا", "err"); return; }
    if (u.role === "owner_rep" && !u.department) { toast("حدّد الإدارة العامة أولًا", "err", "نطاق الحساب يُحدَّد بالإدارة — بدونها لن يرى أي خدمة"); return; }
    u.status = "approved";
    commitChange("قبول حساب: " + u.name, refreshAccounts, "تم القبول");
  }
  function userReject(uid) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    confirmDialog({ title: "رفض الحساب", message: 'رفض حساب «' + u.name + '»؟', confirm: "رفض", danger: true }).then(function (ok) {
      if (!ok) { refreshAccounts(); return; }
      u.status = "rejected";
      commitChange("رفض حساب: " + u.name, refreshAccounts, "تم الرفض");
    });
  }
  function userDeactivate(uid) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    if (!guardLastAdmin(u, "التعطيل")) return;
    confirmDialog({ title: "تعطيل الحساب", message: 'تعطيل حساب «' + u.name + '»؟ لن يستطيع تسجيل الدخول بعد الآن.', confirm: "تعطيل", danger: true }).then(function (ok) {
      if (!ok) { refreshAccounts(); return; }
      u.status = "rejected";
      commitChange("تعطيل حساب: " + u.name, refreshAccounts, "تم التعطيل");
    });
  }
  function userReactivate(uid) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    u.status = "approved";
    commitChange("إعادة تفعيل حساب: " + u.name, refreshAccounts, "تمت إعادة التفعيل");
  }
  function userSetRole(uid, role) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    if (u.role === "admin" && role !== "admin" && !guardLastAdmin(u, "تغيير الدور")) { refreshAccounts(); return; }
    u.role = role; if (role === "admin") { u.sector = null; u.department = null; }
    commitChange("تغيير دور مستخدم: " + u.name, refreshAccounts, "تم التحديث");
  }
  function userSetSector(uid, sector) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    u.sector = sector || null;
    /* الإدارة تابعة للقطاع — تغيير القطاع يُبطل إدارة لم تعد تنتمي إليه */
    if (!u.sector || departmentsOfSector(u.sector).indexOf(u.department) < 0) u.department = null;
    commitChange("تغيير قطاع مستخدم: " + u.name, refreshAccounts, "تم التحديث");
  }
  function userSetDepartment(uid, department) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    u.department = department || null;
    commitChange("تغيير إدارة مستخدم: " + u.name, refreshAccounts, "تم التحديث");
  }

  /* ---- Link an approved user to specific services as owner/representative
   * (writes straight into the service record's owner/representative field —
   * an admin action, applied immediately, no approval queue involved). ---- */
  function assignRowsHTML(uid) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return "";
    var svcs = allServices().filter(function (s) {
      return u.department ? s.department === u.department : s.sector === u.sector;
    });
    if (!svcs.length) return reviewEmpty("لا توجد خدمات في هذه الإدارة بعد.");
    return svcs.map(function (s) {
      var isOwner = s.owner === u.name, isRep = s.representative === u.name;
      return '<div class="mrow"><div class="mtxt"><b>' + esc(s.title) + '</b></div>' +
        '<button class="chk' + (isOwner ? " on" : "") + '" data-act="assign-toggle" data-field="owner" data-svc="' + s.id + '" data-user="' + uid + '">' + (isOwner ? ICON("check") : "") + 'مالك</button>' +
        '<button class="chk' + (isRep ? " on" : "") + '" data-act="assign-toggle" data-field="representative" data-svc="' + s.id + '" data-user="' + uid + '">' + (isRep ? ICON("check") : "") + 'ممثل</button>' +
        '</div>';
    }).join("");
  }
  function openAssign(uid) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    var m = openModal(
      '<div class="modal-head"><div class="mi">' + ICON("briefcase") + '</div><h2>تعيين ' + esc(u.name) + ' لخدمات ' + esc(u.sector) + '</h2>' +
      '<button class="icon-btn" id="assign-close" style="margin-inline-start:auto">' + ICON("close") + '</button></div>' +
      '<div class="modal-body"><div class="mlist" id="assign-list">' + assignRowsHTML(uid) + '</div></div>');
    $("#assign-close", m).addEventListener("click", function () { closeModal(); refreshAccounts(); });
  }
  function toggleAssign(svcId, uid, field) {
    var u = users().filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    var s = allServices().filter(function (x) { return x.id === svcId; })[0]; if (!s) return;
    var wasSet = s[field] === u.name;
    s[field] = wasSet ? "" : u.name;
    var verb = wasSet ? "إزالة" : "تعيين", role = field === "owner" ? "كمالك" : "كممثل";
    commitChange(verb + " " + u.name + " " + role + " لخدمة: " + s.title, function () {
      var list = $("#assign-list"); if (list) list.innerHTML = assignRowsHTML(uid);
      render();
    }, "تم التحديث");
  }

  /* =====================================================================
   * MANAGE LISTS (departments / owners / representatives)
   * ===================================================================== */
  var MANAGE_META = {
    department: { label: "الإدارات العامة", icon: "building", refKey: "departments" },
    owner: { label: "ملاك الخدمات", icon: "user", refKey: "owners" },
    representative: { label: "ممثلو الخدمات", icon: "users", refKey: "representatives" }
  };
  function openManage() {
    manageSearch = ""; manageEditing = null;
    openModal(
      '<div class="modal-head"><div class="mi">' + ICON("list") + '</div><h2>إدارة القوائم</h2>' +
      '<button class="icon-btn" id="mng-close" style="margin-inline-start:auto">' + ICON("close") + '</button></div>' +
      '<div class="modal-body manage-body"><div id="manage-shell"></div></div>');
    $("#mng-close").addEventListener("click", closeModal);
    renderManage();
  }

  /* Full modal shell — rebuilt only on tab change / add. The list itself
   * updates independently (renderManageList) so live search & inline rename
   * don't blow away the search box focus. */
  function renderManage() {
    var shell = $("#manage-shell"); if (!shell) return;
    var tabs = Object.keys(MANAGE_META).map(function (k) {
      var cnt = allValues(k).filter(Boolean).length;
      return '<button class="seg' + (manageTab === k ? " on" : "") + '" data-act="manage-tab" data-tab="' + k + '">' +
        ICON(MANAGE_META[k].icon) + '<span>' + esc(MANAGE_META[k].label) + '</span><b>' + cnt + '</b></button>';
    }).join("");
    var lbl = MANAGE_META[manageTab].label;

    shell.innerHTML =
      '<div class="seg-row">' + tabs + '</div>' +
      '<div class="mng-add"><input type="text" id="mng-add-in" placeholder="أضِف ' + esc(lbl) + ' جديدًا…" autocomplete="off">' +
        '<button class="btn primary sm" data-act="manage-add">' + ICON("plus") + 'إضافة</button></div>' +
      '<div class="mng-search">' + ICON("search") + '<input type="text" id="mng-search" placeholder="ابحث في ' + esc(lbl) + '…" value="' + attr(manageSearch) + '" autocomplete="off"></div>' +
      '<div class="mlist" id="manage-list"></div>' +
      (S.token ? '' : '<p class="form-hint" style="margin-top:12px">' + ICON("info") + ' تعذّر العثور على صلاحية الكتابة — التغييرات محلية فقط في هذا المتصفح.</p>');

    renderManageList();
    var addIn = $("#mng-add-in"); if (addIn) addIn.addEventListener("keydown", function (e) { if (e.key === "Enter") manageAdd(); });
  }

  function renderManageList() {
    var list = $("#manage-list"); if (!list) return;
    var q = manageSearch.trim().toLowerCase();
    var vals = allValues(manageTab).filter(Boolean)
      .filter(function (v) { return !q || v.toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) {
        var d = usageCount(manageTab, b) - usageCount(manageTab, a);
        return d !== 0 ? d : a.localeCompare(b, "ar");
      });
    if (!vals.length) {
      list.innerHTML = '<div class="empty" style="padding:26px"><p>' + (manageSearch ? "لا نتائج مطابقة." : "لا توجد عناصر بعد.") + '</p></div>';
      return;
    }
    list.innerHTML = vals.map(function (v) {
      var used = usageCount(manageTab, v);
      if (manageEditing === v) {
        return '<div class="mrow editing"><input type="text" id="mng-edit-in" class="mrow-input" value="' + attr(v) + '" autocomplete="off">' +
          '<button class="mini-btn ok" data-act="manage-edit-save" title="حفظ">' + ICON("check") + '</button>' +
          '<button class="mini-btn" data-act="manage-edit-cancel" title="إلغاء">' + ICON("close") + '</button></div>';
      }
      var delBtn = used > 0
        ? '<button class="mini-btn" disabled title="مستخدمة في ' + used + ' خدمة — أعد تعيينها أولًا">' + ICON("trash") + '</button>'
        : '<button class="mini-btn danger" data-act="manage-delete" data-value="' + attr(v) + '" title="حذف">' + ICON("trash") + '</button>';
      return '<div class="mrow"><div class="mtxt"><b>' + esc(v) + '</b></div>' +
        '<span class="usage' + (used ? "" : " zero") + '">' + used + ' خدمة</span>' +
        '<button class="mini-btn" data-act="manage-edit-start" data-value="' + attr(v) + '" title="إعادة تسمية">' + ICON("edit") + '</button>' +
        delBtn + '</div>';
    }).join("");
    var editIn = $("#mng-edit-in");
    if (editIn) {
      editIn.focus(); editIn.select();
      editIn.addEventListener("keydown", function (e) {
        if (e.key === "Enter") manageEditSave();
        else if (e.key === "Escape") { manageEditing = null; renderManageList(); }
      });
    }
  }

  function manageAdd() {
    var input = $("#mng-add-in"); if (!input) return;
    var v = input.value.trim(); if (!v) return;
    if (allValues(manageTab).indexOf(v) >= 0) { toast("موجود مسبقًا", "err"); return; }
    refs()[MANAGE_META[manageTab].refKey].push(v);
    manageSearch = ""; manageEditing = null;
    commitChange("إضافة " + MANAGE_META[manageTab].label + ": " + v, renderManage, "تمت الإضافة");
  }
  function manageEditSave() {
    var oldV = manageEditing; if (!oldV) return;
    var input = $("#mng-edit-in"); if (!input) return;
    var newV = input.value.trim();
    if (!newV || newV === oldV) { manageEditing = null; renderManageList(); return; }
    if (allValues(manageTab).indexOf(newV) >= 0 && newV !== oldV) {
      /* merging into an existing name is fine — just reassign, then dedupe */
    }
    var field = manageTab;
    services().forEach(function (s) { if (s[field] === oldV) s[field] = newV; });
    var rk = MANAGE_META[manageTab].refKey, arr = refs()[rk];
    var idx = arr.indexOf(oldV); if (idx >= 0) arr[idx] = newV;
    refs()[rk] = uniq(arr);
    manageEditing = null;
    commitChange("إعادة تسمية " + MANAGE_META[manageTab].label + ": " + oldV + " → " + newV, function () { renderManage(); render(); }, "تم التحديث");
  }
  function manageDelete(v) {
    var used = usageCount(manageTab, v);
    if (used > 0) { toast("لا يمكن الحذف", "err", "مستخدمة في " + used + " خدمة — أعد تعيينها أولًا"); return; }
    confirmDialog({ title: "حذف عنصر", message: 'حذف «' + v + '» من قائمة ' + MANAGE_META[manageTab].label + '؟', confirm: "حذف", danger: true }).then(function (ok) {
      if (!ok) return;
      var rk = MANAGE_META[manageTab].refKey;
      refs()[rk] = refs()[rk].filter(function (x) { return x !== v; });
      commitChange("حذف " + MANAGE_META[manageTab].label + ": " + v, renderManage, "تم الحذف");
    });
  }

  /* =====================================================================
   * SETTINGS
   * ===================================================================== */
  function openSettings() {
    var tokenSet = !!S.token;
    var u = S.currentUser;
    var m = openModal(
      '<div class="modal-head"><div class="mi">' + ICON("gear") + '</div><h2>الإعدادات</h2>' +
      '<button class="icon-btn" id="set-close" style="margin-inline-start:auto">' + ICON("close") + '</button></div>' +
      '<div class="modal-body">' +

      (u ? section("الحساب", "user",
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<span class="avatar" style="width:44px;height:44px;font-size:15px;background:' + I.avatarColor(u.name) + '">' + esc(I.initials(u.name)) + '</span>' +
          '<div><b style="font-size:14px;font-weight:700;display:block">' + esc(u.name) + '</b>' +
          '<span class="muted" style="font-size:12px">@' + esc(u.username) + ' · ' + esc(u.role === "admin" ? "مدير النظام" : "مالك/ممثل خدمات — " + I.scopeLabel(u)) + '</span></div>' +
        '</div>') : '') +

      section("المظهر", "moon",
        '<div style="display:flex;gap:10px">' +
          '<button class="btn ' + (!I.isDark() ? "primary" : "") + '" data-act="settings-theme" data-theme="light">' + ICON("sun") + 'فاتح</button>' +
          '<button class="btn ' + (I.isDark() ? "primary" : "") + '" data-act="settings-theme" data-theme="dark">' + ICON("moon") + 'داكن</button>' +
        '</div>') +

      (isAdmin() ? section("المستخدمون والصلاحيات", "users",
        '<p class="form-hint" style="margin-bottom:10px">اعتماد الحسابات الجديدة، تغيير الأدوار والنطاق، تعيين كلمات المرور، وحذف الحسابات.</p>' +
        '<button class="btn primary" data-act="users-manage">' + ICON("users") + 'إدارة المستخدمين</button>') : '') +

      section("النسخ الاحتياطي والمزامنة", "download",
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn" data-act="export">' + ICON("download") + 'تصدير نسخة (JSON)</button>' +
          (isAdmin() ? '<button class="btn" data-act="import">' + ICON("upload") + 'استيراد نسخة</button>' : '') +
          '<button class="btn" data-act="reload-data">' + ICON("refresh") + 'تحديث من المستودع</button>' +
          '<input type="file" id="import-file" accept="application/json,.json" style="display:none">' +
        '</div>') +

      (isAdmin() ? section("مستوى الحماية", "unlock",
        '<div class="auth-note" style="margin:0">' + ICON("info") +
          '<p>كلمة مرور الكتالوج المشتركة <b>مُلغاة</b>: مفتاح فكّ التشفير مضمّن في صفحة الموقع، ' +
          'فأي شخص يصل إلى الرابط يستطيع قراءة كل بيانات الكتالوج <b>واستخراج رمز الكتابة في GitHub</b>. ' +
          'الحسابات والأدوار تنظيمية في الواجهة ولا تمنع ذلك تقنيًا. عامِل الرابط نفسه كسرّ.</p></div>') : '') +

      section("الجلسة", "logout",
        '<button class="btn danger" data-act="lock-app">' + ICON("lock") + 'قفل التطبيق (تسجيل الخروج)</button>') +

      '</div>');
    $("#set-close", m).addEventListener("click", closeModal);
  }
  function section(title, icon, inner) {
    return '<div style="padding:16px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<div style="width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">' + ICON(icon) + '</div>' +
      '<b style="font-size:13.5px">' + esc(title) + '</b></div>' + inner + '</div>';
  }

  /* ---------------- Export / Import ---------------- */
  function exportData() {
    /* the plaintext backup file is not encrypted at rest — never include the write token in it */
    var clean = Object.assign({}, S.catalog); delete clean.writeToken;
    var blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "catalog-backup-" + I.todayISO() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("تم تصدير نسخة احتياطية", "ok");
  }
  function handleImportFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.services)) throw new Error("صيغة غير صحيحة");
        confirmDialog({ title: "استيراد بيانات", message: "سيتم استبدال البيانات الحالية بـ " + data.services.length + " خدمة من الملف. متابعة؟", confirm: "استيراد", icon: "upload" }).then(function (ok) {
          if (!ok) return;
          S.catalog = normalizeCatalog(data);
          closeModal();
          commitChange("استيراد بيانات", render, "تم الاستيراد");
        });
      } catch (e) { toast("تعذّر قراءة الملف", "err", String(e.message || e)); }
    };
    reader.readAsText(file);
  }
  function reloadData() {
    toast("جارٍ التحديث…", "info");
    fetchEnvelope().then(function (env) { return Box.decryptEnvelope(env, S.password); })
      .then(function (cat) { S.catalog = normalizeCatalog(cat); closeModal(); render(); toast("تم التحديث من المستودع", "ok"); })
      .catch(function (err) { toast("تعذّر التحديث", "err", String(err.message || err)); });
  }
  function lockApp() {
    /* الخروج يُنهي الجلسة الشخصية فقط — البيانات تُفكّ تلقائيًا بمفتاح مضمّن،
     * فلا توجد طبقة كلمة مرور مشتركة يُعاد إليها. */
    sessionStorage.removeItem("cat_user"); localStorage.removeItem("cat_user");
    sessionStorage.removeItem("cat_pw"); localStorage.removeItem("cat_pw"); /* بقايا النسخ السابقة */
    S.currentUser = null; S.selected = null;
    authView = "login"; authNotice = "";
    closeModal(); closeDrawer();
    $("#app").innerHTML = "";
    showAuthGate();
  }

  /* =====================================================================
   * LOCK SCREEN + BOOT
   * ===================================================================== */
  function normalizeCatalog(cat) {
    cat = cat || {};
    cat.services = (cat.services || []).map(function (s, i) {
      /* ids are always numeric — never let an imported string id reach the DOM */
      s.id = (s.id != null && isFinite(+s.id)) ? +s.id : (i + 1);
      s.objectives = s.objectives || [];
      s.beneficiaries = s.beneficiaries || [];
      /* حالة الإتاحة تُردّ دائمًا إلى إحدى الحالات الثلاث المعتمدة. أي نص حر
       * قديم (مثل "إلغاء الخدمة بناء على طلب المالك") يصبح "متوقفة" مع حفظ
       * نصّه الأصلي كسبب، فلا تضيع المعلومة ولا تبقى حالة خارج التصنيف. */
      var norm = C.normalizeStatus(s.status);
      if (s.status && s.status !== norm && !C.statusLegacy[s.status] && !s.statusNote) s.statusNote = s.status;
      s.status = norm;
      return s;
    });
    cat.refs = cat.refs || { departments: [], owners: [], representatives: [] };
    cat.refs.departments = cat.refs.departments || [];
    cat.refs.owners = cat.refs.owners || [];
    cat.refs.representatives = cat.refs.representatives || [];
    cat.taxonomy = cat.taxonomy || C.taxonomy;
    cat.updatedAt = cat.updatedAt || I.todayISO();
    cat.users = cat.users || [];
    cat.pendingEdits = cat.pendingEdits || [];
    /* Write access is embedded in the encrypted data itself (never in plain JS),
     * so anyone who knows the catalog password can edit automatically — no
     * separate token entry. Carry it forward across saves/imports so a backup
     * that lacks it (e.g. an exported file, which strips it) doesn't strand
     * the team without write access after a re-import. */
    if (cat.writeToken) S.token = cat.writeToken;
    else if (S.token) cat.writeToken = S.token;
    return cat;
  }

  function showBoot() {
    if ($("#boot")) return;
    var b = document.createElement("div"); b.className = "boot"; b.id = "boot";
    b.innerHTML = '<div class="b-in"><div class="b-logo">' + ICON("briefcase") + '</div><div style="font-weight:700;color:var(--ink)">' + esc(C.brand.title) + '</div><div class="b-spin"></div></div>';
    document.body.appendChild(b);
  }
  function hideBoot() { var b = $("#boot"); if (b) { b.style.transition = ".3s"; b.style.opacity = "0"; setTimeout(function () { b.remove(); }, 300); } }

  /* شاشة عطل نهائي — تحلّ محل شاشة كلمة المرور السابقة: لم يعد هناك ما
   * يدخله المستخدم هنا، فالحالة الوحيدة الممكنة هي فشل التحميل أو فكّ التشفير. */
  function showFatal(title, detail) {
    hideBoot();
    if ($("#fatal")) return;
    var l = document.createElement("div"); l.className = "lock-screen"; l.id = "fatal";
    l.innerHTML =
      '<div class="lock-card">' +
        '<div class="lock-logo" style="background:var(--danger)">' + ICON("info") + '</div>' +
        '<h1>' + esc(title) + '</h1>' +
        '<div class="p">' + esc(detail) + '</div>' +
        '<button type="button" class="btn primary block" onclick="location.reload()">' + ICON("refresh") + 'إعادة المحاولة</button>' +
      '</div>';
    document.body.appendChild(l);
  }

  /* =====================================================================
   * AUTH GATE — personal account layer (bootstrap / login / register)
   * Sits between "catalog decrypted" and "app rendered". Lightweight,
   * UI-enforced roles: مدير النظام (admin, sees/edits everything, approves
   * accounts + edits) و مالك/ممثل خدمات (scoped to their own sector, every
   * change goes to a pending queue for the admin to approve).
   * ===================================================================== */
  function isBootstrap() { return users().length === 0; }

  function showAuthGate() {
    if ($("#authgate")) { renderAuthGate(); return; }
    var g = document.createElement("div"); g.className = "lock-screen"; g.id = "authgate";
    document.body.appendChild(g);
    renderAuthGate();
  }
  function hideAuthGate() { var g = $("#authgate"); if (g) { g.style.transition = ".3s"; g.style.opacity = "0"; setTimeout(function () { g.remove(); }, 300); } }

  function renderAuthGate() {
    var g = $("#authgate"); if (!g) return;
    if (isBootstrap()) { g.innerHTML = bootstrapMarkup(); bindBootstrap(); }
    else if (authView === "register") { g.innerHTML = registerMarkup(); bindRegister(); }
    else if (authView === "pending-notice") { g.innerHTML = noticeMarkup(); bindNotice(); }
    else { g.innerHTML = loginMarkup(); bindLogin(); }
    bindAuthTabs(); bindAuthCommon();
    var first = g.querySelector("input[autofocus]"); if (first) setTimeout(function () { first.focus(); }, 40);
  }

  function authShell(icon, title, sub, body, opts) {
    opts = opts || {};
    return '<div class="lock-card' + (opts.wide ? " wide" : "") + '">' +
      '<div class="lock-logo">' + ICON(icon) + '</div>' +
      '<h1>' + esc(title) + '</h1>' +
      '<div class="p">' + esc(sub) + '</div>' +
      (opts.tabs ? authTabs(opts.tabs) : "") +
      body +
      (opts.foot || "") +
      '</div>';
  }

  /* تبويبان واضحان بدل رابط نصي صغير أسفل البطاقة */
  function authTabs(active) {
    return '<div class="auth-tabs">' +
      '<button type="button" class="auth-tab' + (active === "login" ? " on" : "") + '" data-authtab="login">' +
        ICON("unlock") + 'تسجيل الدخول</button>' +
      '<button type="button" class="auth-tab' + (active === "register" ? " on" : "") + '" data-authtab="register">' +
        ICON("user") + 'حساب جديد</button>' +
    '</div>';
  }
  function bindAuthTabs() {
    $all("[data-authtab]").forEach(function (b) {
      b.addEventListener("click", function () {
        authView = b.getAttribute("data-authtab"); authNotice = ""; renderAuthGate();
      });
    });
  }

  /* حقل موسوم — التسمية مكتوبة فوق الحقل لا داخله فقط، فتبقى ظاهرة بعد
   * الكتابة ويقرأها قارئ الشاشة. */
  function authField(o) {
    var isPw = o.type === "password";
    return '<div class="lock-field has-label">' +
      '<label class="lf-label" for="' + o.id + '">' + esc(o.label) + (o.req ? ' <span class="req">*</span>' : '') + '</label>' +
      '<span class="li" style="top:calc(50% + 13px)">' + ICON(o.icon) + '</span>' +
      '<input type="' + (o.type || "text") + '" id="' + o.id + '"' +
        (isPw ? '' : ' class="plain"') +
        ' placeholder="' + attr(o.placeholder || "") + '"' +
        (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : '') +
        (o.autofocus ? ' autofocus' : '') + '>' +
      (isPw ? '<button type="button" class="reveal" data-reveal="' + o.id + '" aria-label="إظهار كلمة المرور" style="top:calc(50% + 13px)">' + ICON("eye") + '</button>' : '') +
      (o.meter ? '<div class="pw-meter" id="' + o.id + '-meter"><i></i><i></i><i></i><i></i></div>' : '') +
    '</div>';
  }
  function authSelect(o) {
    return '<div class="lock-field has-label">' +
      '<label class="lf-label" for="' + o.id + '">' + esc(o.label) + (o.req ? ' <span class="req">*</span>' : '') + '</label>' +
      '<span class="li" style="top:calc(50% + 13px)">' + ICON(o.icon) + '</span>' +
      '<select id="' + o.id + '"' + (o.disabled ? ' disabled' : '') + '>' + o.options + '</select>' +
    '</div>';
  }
  function authStep(label) { return '<div class="auth-step"><span>' + esc(label) + '</span><i></i></div>'; }
  function authErr() { return '<div class="lock-err" id="auth-err"></div>'; }
  function setAuthErr(msg) {
    var e = $("#auth-err"); if (!e) return;
    e.innerHTML = msg ? ICON("info") + '<span>' + esc(msg) + '</span>' : "";
  }

  /* إظهار/إخفاء كلمة المرور + مؤشر قوة بسيط (الطول وتنوّع المحارف) */
  function bindAuthCommon() {
    $all("[data-reveal]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = $("#" + b.getAttribute("data-reveal"));
        i.type = i.type === "password" ? "text" : "password"; i.focus();
      });
    });
    $all(".pw-meter").forEach(function (m) {
      var input = $("#" + m.id.replace(/-meter$/, ""));
      if (!input) return;
      input.addEventListener("input", function () { m.className = "pw-meter s" + pwScore(input.value); });
    });
  }
  function pwScore(v) {
    if (!v) return 0;
    var n = 0;
    if (v.length >= 6) n++;
    if (v.length >= 10) n++;
    if (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) n++;
    if (/[^A-Za-z0-9]/.test(v)) n++;
    return Math.min(n, 4);
  }

  function bootstrapMarkup() {
    return authShell("sparkles", "إنشاء حساب مدير النظام",
      "لا يوجد بعد أي مستخدم — أول حساب يُنشأ هنا يصبح مدير النظام بصلاحية كاملة.",
      '<form id="auth-form">' +
        '<div class="auth-note">' + ICON("key") + '<p>احتفظ ببيانات هذا الحساب: هو الحساب الوحيد القادر على اعتماد بقية الحسابات وإدارة الصلاحيات.</p></div>' +
        authField({ id: "af-name", label: "الاسم الكامل", icon: "user", placeholder: "الاسم كما يظهر للفريق", autocomplete: "name", req: true, autofocus: true }) +
        authField({ id: "af-username", label: "اسم المستخدم", icon: "key", placeholder: "يُستخدم للدخول", autocomplete: "username", req: true }) +
        '<div class="auth-grid">' +
          authField({ id: "af-pw", label: "كلمة المرور", type: "password", icon: "lock", placeholder: "6 أحرف فأكثر", autocomplete: "new-password", req: true, meter: true }) +
          authField({ id: "af-pw2", label: "تأكيد كلمة المرور", type: "password", icon: "lock", placeholder: "أعد كتابتها", autocomplete: "new-password", req: true }) +
        '</div>' +
        authErr() +
        '<button type="submit" class="btn primary block" id="auth-btn">' + ICON("check") + 'إنشاء الحساب والدخول</button>' +
      '</form>');
  }

  function loginMarkup() {
    return authShell("lock", "مرحبًا بعودتك", "سجّل الدخول بحسابك الشخصي للمتابعة إلى " + C.brand.title,
      '<form id="auth-form">' +
        authField({ id: "af-username", label: "اسم المستخدم", icon: "user", placeholder: "اسم المستخدم", autocomplete: "username", req: true, autofocus: true }) +
        authField({ id: "af-pw", label: "كلمة المرور", type: "password", icon: "lock", placeholder: "كلمة المرور", autocomplete: "current-password", req: true }) +
        '<label class="lock-remember"><input type="checkbox" id="af-remember"> إبقائي مسجّلًا على هذا الجهاز</label>' +
        authErr() +
        '<button type="submit" class="btn primary block" id="auth-btn">' + ICON("unlock") + 'دخول</button>' +
      '</form>',
      { tabs: "login" });
  }

  function registerMarkup() {
    var sectors = uniqueSectors();
    return authShell("users", "إنشاء حساب جديد",
      "اختر قطاعك ثم إدارتك العامة — سترى وتُدير خدمات إدارتك فقط.",
      '<form id="auth-form">' +
        authStep("بيانات الحساب") +
        authField({ id: "af-name", label: "الاسم الكامل", icon: "user", placeholder: "الاسم كما يظهر للفريق", autocomplete: "name", req: true, autofocus: true }) +
        authField({ id: "af-username", label: "اسم المستخدم", icon: "key", placeholder: "يُستخدم للدخول", autocomplete: "username", req: true }) +

        authStep("نطاق العمل") +
        authSelect({ id: "af-sector", label: "القطاع", icon: "layers", req: true,
          options: '<option value="">اختر القطاع…</option>' +
            sectors.map(function (x) { return '<option value="' + attr(x) + '">' + esc(x) + '</option>'; }).join("") }) +
        authSelect({ id: "af-department", label: "الإدارة العامة", icon: "building", req: true, disabled: true,
          options: '<option value="">اختر القطاع أولًا…</option>' }) +

        authStep("كلمة المرور") +
        '<div class="auth-grid">' +
          authField({ id: "af-pw", label: "كلمة المرور", type: "password", icon: "lock", placeholder: "6 أحرف فأكثر", autocomplete: "new-password", req: true, meter: true }) +
          authField({ id: "af-pw2", label: "تأكيد كلمة المرور", type: "password", icon: "lock", placeholder: "أعد كتابتها", autocomplete: "new-password", req: true }) +
        '</div>' +

        '<div class="auth-note">' + ICON("info") + '<p>ستُنشأ بصلاحية <b>مالك/ممثل خدمات</b>: تستعرض وتعدّل خدمات إدارتك فقط. الحساب <b>يحتاج موافقة مدير النظام</b> قبل أول دخول.</p></div>' +
        authErr() +
        '<button type="submit" class="btn primary block" id="auth-btn">' + ICON("check") + 'إرسال طلب الحساب</button>' +
      '</form>',
      { tabs: "register", wide: true });
  }

  function noticeMarkup() {
    return authShell("info", "بانتظار الموافقة", authNotice || "تم إرسال طلبك بنجاح — بانتظار موافقة مدير النظام.",
      '<div class="auth-note">' + ICON("users") + '<p>سيصل الطلب إلى <b>مدير النظام</b> في لوحة «إدارة المستخدمين». بعد الاعتماد ستتمكن من الدخول مباشرة بنفس بيانات حسابك.</p></div>' +
      '<button type="button" class="btn ghost block" id="auth-back">' + ICON("arrowRight") + 'رجوع لتسجيل الدخول</button>');
  }

  function bindBootstrap() {
    $("#auth-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#af-name").value.trim(), username = $("#af-username").value.trim();
      var pw = $("#af-pw").value, pw2 = $("#af-pw2").value;
      if (!name || !username) { setAuthErr("الاسم واسم المستخدم مطلوبان"); return; }
      if (pw.length < 6) { setAuthErr("كلمة المرور 6 أحرف على الأقل"); return; }
      if (pw !== pw2) { setAuthErr("كلمتا المرور غير متطابقتين"); return; }
      var btn = $("#auth-btn"); btn.disabled = true;
      Box.hashPassword(pw).then(function (h) {
        var u = { id: 1, name: name, username: username, usernameLower: username.toLowerCase(), salt: h.salt, hash: h.hash, role: "admin", sector: null, status: "approved", createdAt: I.todayISO() };
        users().push(u);
        S.currentUser = sessionUser(u);
        localStorage.setItem("cat_user", String(u.id));
        commitChange("إنشاء حساب مدير النظام: " + name, function () { hideAuthGate(); render(); }, "تم إنشاء حساب المدير");
      }).catch(function () { btn.disabled = false; setAuthErr("تعذّر إنشاء الحساب"); });
    });
  }

  function bindLogin() {
    $("#auth-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var username = $("#af-username").value.trim(), pw = $("#af-pw").value;
      var remember = $("#af-remember").checked;
      if (!username || !pw) { setAuthErr("أدخل اسم المستخدم وكلمة المرور"); return; }
      var u = users().filter(function (x) { return (x.usernameLower || x.username.toLowerCase()) === username.toLowerCase(); })[0];
      if (!u) { setAuthErr("اسم المستخدم أو كلمة المرور غير صحيحة"); return; }
      var btn = $("#auth-btn"); btn.disabled = true;
      Box.verifyPassword(pw, u.salt, u.hash).then(function (ok) {
        btn.disabled = false;
        if (!ok) { setAuthErr("اسم المستخدم أو كلمة المرور غير صحيحة"); return; }
        if (u.status === "pending") { authNotice = "حسابك لا يزال بانتظار موافقة مدير النظام."; authView = "pending-notice"; renderAuthGate(); return; }
        if (u.status === "rejected") { authNotice = "تم رفض هذا الحساب. تواصل مع مدير النظام."; authView = "pending-notice"; renderAuthGate(); return; }
        S.currentUser = sessionUser(u);
        if (remember) localStorage.setItem("cat_user", String(u.id)); else sessionStorage.setItem("cat_user", String(u.id));
        hideAuthGate(); render();
      });
    });
  }

  function bindRegister() {
    /* الإدارات تتبع القطاع المختار — لا تُسرد كل إدارات الهيئة دفعةً واحدة */
    var secSel = $("#af-sector"), depSel = $("#af-department");
    secSel.addEventListener("change", function () {
      var deps = departmentsOfSector(secSel.value);
      depSel.disabled = !deps.length;
      depSel.innerHTML = '<option value="">' + (secSel.value ? (deps.length ? "اختر الإدارة العامة…" : "لا توجد إدارات في هذا القطاع") : "اختر القطاع أولًا…") + '</option>' +
        deps.map(function (d) { return '<option value="' + attr(d) + '">' + esc(d) + '</option>'; }).join("");
    });

    $("#auth-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#af-name").value.trim(), username = $("#af-username").value.trim();
      var sector = secSel.value, department = depSel.value;
      var pw = $("#af-pw").value, pw2 = $("#af-pw2").value;
      if (!name || !username) { setAuthErr("الاسم واسم المستخدم مطلوبان"); return; }
      if (!sector) { setAuthErr("اختر القطاع"); return; }
      if (!department) { setAuthErr("اختر الإدارة العامة"); return; }
      if (pw.length < 6) { setAuthErr("كلمة المرور 6 أحرف على الأقل"); return; }
      if (pw !== pw2) { setAuthErr("كلمتا المرور غير متطابقتين"); return; }
      if (users().some(function (x) { return (x.usernameLower || x.username.toLowerCase()) === username.toLowerCase(); })) {
        setAuthErr("اسم المستخدم مستخدَم بالفعل"); return;
      }
      var btn = $("#auth-btn"); btn.disabled = true;
      Box.hashPassword(pw).then(function (h) {
        var nextId = users().reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
        var u = { id: nextId, name: name, username: username, usernameLower: username.toLowerCase(), salt: h.salt, hash: h.hash, role: "owner_rep", sector: sector, department: department, status: "pending", createdAt: I.todayISO() };
        users().push(u);
        commitChange("طلب حساب جديد: " + name + " — " + department, function () {
          authNotice = "تم إرسال طلبك بنجاح. سيتمكن مدير النظام من مراجعته والموافقة عليه، وبعدها يمكنك تسجيل الدخول ورؤية خدمات إدارتك.";
          authView = "pending-notice"; renderAuthGate();
        }, "تم إرسال الطلب");
      }).catch(function () { btn.disabled = false; setAuthErr("تعذّر إرسال الطلب"); });
    });
  }

  /* الإدارات العامة المسجَّلة تحت قطاع معيّن — تُقرأ من allServices() لأن شاشة
   * التسجيل تسبق تسجيل الدخول، فلا يوجد بعد مستخدم يحدّد النطاق. */
  function departmentsOfSector(sector) {
    if (!sector) return [];
    return uniq(allServices().filter(function (s) { return s.sector === sector; })
      .map(function (s) { return s.department; })).filter(Boolean)
      .sort(function (a, b) { return a.localeCompare(b, "ar"); });
  }

  function bindNotice() {
    $("#auth-back").addEventListener("click", function () { authView = "login"; renderAuthGate(); });
  }

  function boot() {
    var pref = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(localStorage.getItem("cat_theme") || pref);
    showBoot();
    fetchEnvelope().then(function (env) {
      envelope = env;
      /* لا تُطلب كلمة مرور مشتركة — المفتاح مضمّن في الإعدادات، والبوابة
       * الوحيدة أمام المستخدم هي حسابه الشخصي. */
      var pw = C.catalogKey;
      Box.decryptEnvelope(envelope, pw).then(function (cat) {
        S.catalog = normalizeCatalog(cat); S.password = pw;
        afterCatalogUnlocked();
      }).catch(function (err) {
        showFatal("تعذّر فكّ تشفير البيانات", "مفتاح فكّ التشفير في إعدادات التطبيق لا يطابق الملف المنشور. أعِد بناء البيانات بالمفتاح نفسه.");
        console.error(err);
      });
    }).catch(function (err) {
      showFatal("تعذّر تحميل البيانات", "تأكد من الاتصال بالإنترنت ثم أعِد تحميل الصفحة.");
      console.error(err);
    });
  }

  /* Catalog is decrypted — now resolve the PERSONAL account layer. A
   * remembered login restores instantly; otherwise the auth gate takes over
   * (bootstrap / login / register) before the main app is ever rendered. */
  /* الجلسة تحمل نطاق الحساب (القطاع + الإدارة العامة) — تُبنى من مكان واحد
   * حتى لا يسقط أحد الحقول في أحد مسارات الدخول الثلاثة. */
  function sessionUser(u) {
    return { id: u.id, name: u.name, username: u.username, role: u.role,
             sector: u.sector || null, department: u.department || null };
  }

  function afterCatalogUnlocked() {
    if (S.token) refreshSha();
    var remembered = localStorage.getItem("cat_user") || sessionStorage.getItem("cat_user");
    if (remembered) {
      var uid = +remembered;
      var u = users().filter(function (x) { return x.id === uid && x.status === "approved"; })[0];
      if (u) {
        S.currentUser = sessionUser(u);
        hideBoot(); hideAuthGate(); render();
        return;
      }
      localStorage.removeItem("cat_user"); sessionStorage.removeItem("cat_user");
    }
    hideBoot();
    showAuthGate();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
