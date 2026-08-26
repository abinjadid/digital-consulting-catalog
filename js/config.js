/* =========================================================================
 * كتالوج الخدمات الاستشارية — الإعدادات والثوابت
 * Central configuration: GitHub-backed store, taxonomy, palette, sector colors
 * ========================================================================= */
(function (root) {
  "use strict";

  var CONFIG = {
    /* ---- GitHub "simple database" ---- */
    github: {
      owner: "abinjadid",
      repo: "digital-consulting-catalog",
      branch: "main",
      dataPath: "data/catalog.enc"
    },

    /* Relative fallback (served by GitHub Pages / local server) */
    localDataUrl: "./data/catalog.enc",

    /* ---- Encryption parameters (must match the build script) ---- */
    crypto: { iterations: 250000, hash: "SHA-256", keyLen: 256 },

    /* ---- Branding ---- */
    brand: {
      title: "كتالوج الخدمات الاستشارية",
      program: "برنامج الاستشارات الرقمية",
      year: "2026"
    },

    /* ---- Canonical taxonomies (from ورقة "القوائم") ---- */
    taxonomy: {
      objectives: [
        "رضا المستفيدين",
        "تمكين الأعمال",
        "حكومة فعّالة",
        "كفاءة الاستثمار",
        "البيئة التنظيمية",
        "تسريع التحول"
      ],
      categories: [
        "الاستراتيجيات الرقمية",
        "تخطيط وتمكين البنية التقنية",
        "الابتكار والتقنيات الناشئة",
        "التميز المؤسسي واستمرارية الأعمال",
        "الاستثمار والخدمات الرقمية",
        "البيانات والتكامل",
        "مؤشرات الأداء الرقمي",
        "أخرى"
      ],
      beneficiaries: [
        "جهات حكومية",
        "قطاع خاص/شركات",
        "منظمات دولية",
        "أفراد"
      ],
      /* الحالات الرسمية — المصدر الوحيد هو CONFIG.serviceStatuses أدناه،
       * وتُشتق هذه القائمة منه تلقائيًا كي لا تتفرّع نسختان من نفس التصنيف. */
      statuses: []
    },

    /* ---- Digital transformation stages (ثلاث مراحل) ---- */
    stages: [
      { key: "التخطيط", label: "التخطيط", emoji: "🟢",
        desc: "تخطيط الطموحات والإمكانيات لتبني استراتيجية تحول رقمي مرنة ومتكيفة",
        color: "#0f9d58", colorDark: "#0f9d58" },
      { key: "التنفيذ", label: "التنفيذ", emoji: "🔵",
        desc: "تمكين تنفيذ مبادرات ومشاريع الجهات الحكومية وفق السياسات والضوابط المتبعة",
        color: "#2a78d6", colorDark: "#3987e5" },
      { key: "التوسع", label: "التوسع", emoji: "🟠",
        desc: "تحقيق الأثر المستدام عبر ابتكار خدمات رقمية شاملة وسلسة",
        color: "#eb6834", colorDark: "#d95926" }
    ],

    /* ---- حالة إتاحة الخدمة (Service availability status) ----
     * تُخزَّن القيمة في الحقل `status` لكل خدمة، ويُحفظ سبب الإيقاف أو ملاحظة
     * الحالة (إن وُجدت) في الحقل `statusNote`. */
    serviceStatuses: [
      { key: "مفعلة", label: "مفعلة", short: "مفعلة", icon: "circleCheck",
        desc: "متاحة حاليًا ويمكن طلبها من الجهات",
        color: "#0f9d58", colorDark: "#12b866" },
      { key: "قيد التفعيل", label: "قيد التفعيل", short: "قيد التفعيل", icon: "circleDots",
        desc: "قيد الإعداد ولم تُفتح للطلب بعد",
        color: "#d97706", colorDark: "#f59e0b" },
      { key: "جاري التحليل", label: "جاري التحليل", short: "جاري التحليل", icon: "analysis",
        desc: "خدمة مقترحة من إدارتها بانتظار تحليل مدير النظام واعتمادها",
        color: "#7c3aed", colorDark: "#a78bfa" },
      { key: "متوقفة", label: "متوقفة (مؤرشفة)", short: "متوقفة", icon: "archive",
        desc: "أُوقفت أو أُرشفت ولا تُقدَّم حاليًا",
        color: "#64748b", colorDark: "#94a3b8" }
    ],

    /* الحالة الافتراضية لأي خدمة بلا قيمة (الغالبية العظمى خدمات قائمة فعلًا) */
    defaultStatus: "مفعلة",

    /* الحالة التي تُمنح تلقائيًا لأي خدمة جديدة يضيفها صاحب إدارة (غير مدير
     * النظام) — تدخل الكتالوج مباشرة لكن موسومة بأنها لم تُعتمد بعد. */
    newServiceStatus: "جاري التحليل",

    /* تسميات قديمة كانت مستخدمة قبل توحيد الحالات — تُترجم تلقائيًا عند التحميل
     * حتى لا تظهر خدمة بحالة غير معروفة بعد التحديث. */
    statusLegacy: {
      "قائمة": "مفعلة",
      "نشطة": "مفعلة",
      "مفعّلة": "مفعلة",
      "قيد الإعداد": "قيد التفعيل",
      "قيد التجهيز": "قيد التفعيل",
      "موقوفة": "متوقفة",
      "مؤرشفة": "متوقفة",
      "ملغاة": "متوقفة"
    },

    /* ---- Categorical palette for sectors (validated CVD-safe order) ---- */
    palette: {
      light: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"],
      dark:  ["#3987e5", "#199e70", "#c98500", "#12b866", "#9085e9", "#e66767", "#d55181", "#d95926"]
    },

    /* ---- Manual color overrides for specific sectors (takes priority over the palette) ---- */
    sectorColorOverrides: {
      "قطاع الاستراتيجية والشراكات": { light: "#0d9488", dark: "#2dd4bf" }
    }
  };

  /* Stage lookup helpers */
  CONFIG.stageByKey = function (key) {
    for (var i = 0; i < CONFIG.stages.length; i++) {
      if (CONFIG.stages[i].key === key) return CONFIG.stages[i];
    }
    return null;
  };

  /* Status lookup + normalization */
  CONFIG.statusByKey = function (key) {
    for (var i = 0; i < CONFIG.serviceStatuses.length; i++) {
      if (CONFIG.serviceStatuses[i].key === key) return CONFIG.serviceStatuses[i];
    }
    return null;
  };
  /* Maps any stored value onto one of the official statuses:
   *   فارغ            -> الحالة الافتراضية (مفعلة)
   *   حالة رسمية      -> كما هي
   *   تسمية قديمة     -> ما يقابلها
   *   نص حر غير معروف -> متوقفة (نصّه الأصلي يُحفظ في statusNote عند الترحيل)
   * أي نص حر سابق كان يعني دائمًا إيقاف/إلغاء الخدمة، ولذلك يُعامل كمتوقفة. */
  CONFIG.normalizeStatus = function (value) {
    var v = String(value == null ? "" : value).trim();
    if (!v) return CONFIG.defaultStatus;
    if (CONFIG.statusByKey(v)) return v;
    if (CONFIG.statusLegacy[v]) return CONFIG.statusLegacy[v];
    return "متوقفة";
  };
  /* واجهة موحّدة: taxonomy.statuses مشتقة دائمًا من serviceStatuses */
  CONFIG.taxonomy.statuses = CONFIG.serviceStatuses.map(function (s) { return s.key; });

  root.CONFIG = CONFIG;
  if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
