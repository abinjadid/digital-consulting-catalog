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
      statuses: ["قائمة", "قيد الإعداد", "متوقفة"]
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

    /* ---- Categorical palette for sectors (validated CVD-safe order) ---- */
    palette: {
      light: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"],
      dark:  ["#3987e5", "#199e70", "#c98500", "#12b866", "#9085e9", "#e66767", "#d55181", "#d95926"]
    }
  };

  /* Stage lookup helpers */
  CONFIG.stageByKey = function (key) {
    for (var i = 0; i < CONFIG.stages.length; i++) {
      if (CONFIG.stages[i].key === key) return CONFIG.stages[i];
    }
    return null;
  };

  root.CONFIG = CONFIG;
  if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
