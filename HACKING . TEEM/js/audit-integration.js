/* =====================================
   CYBERSHIELD AUDIT INTEGRATION
===================================== */

(() => {
  "use strict";

  const API_URL = "/api/audit";

  const ALLOWED_MODULES = new Set([
    "URL_ANALYSIS",
    "DOMAIN_MONITORING",
    "CERTIFICATE_VALIDATION",
    "URL_AWARENESS",
  ]);

  const ALLOWED_RESULTS = new Set(["COMPLETED", "WARNING", "REVIEW_REQUIRED"]);

  async function log(module, result) {
    if (!ALLOWED_MODULES.has(module)) {
      console.error("CyberShield Audit: Invalid module.");
      return false;
    }

    if (!ALLOWED_RESULTS.has(result)) {
      console.error("CyberShield Audit: Invalid result.");
      return false;
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          module,
          result,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error(
          "CyberShield Audit:",
          data.message || "Event recording failed.",
        );
        return false;
      }

      console.info("CyberShield Audit:", data.event);

      return true;
    } catch (error) {
      console.error("CyberShield Audit: Server connection failed.", error);

      return false;
    }
  }

  window.CyberShieldAudit = Object.freeze({
    log,
  });
})();
