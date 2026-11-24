document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "/api/audit";
  const HEALTH_URL = "/api/health";

  const elements = {
    tableBody: document.querySelector("#auditTableBody"),
    total: document.querySelector("#totalEvents"),
    info: document.querySelector("#infoEvents"),
    warning: document.querySelector("#warningEvents"),
    critical: document.querySelector("#criticalEvents"),
    search: document.querySelector("#searchInput"),
    severity: document.querySelector("#severityFilter"),
    eventType: document.querySelector("#eventTypeFilter"),
    counter: document.querySelector("#eventCounter"),
    refresh: document.querySelector("#refreshLogs"),
    export: document.querySelector("#exportLogs"),
    serverStatus: document.querySelector("#serverStatus"),
    menuToggle: document.querySelector(".menu-toggle"),
    navLinks: document.querySelector(".nav-links"),
  };

  let auditEvents = [];
  let serverOnline = false;

  // =====================================
  // UI HELPERS
  // =====================================

  function setText(element, value) {
    if (element) {
      element.textContent = String(value);
    }
  }

  function setServerStatus(online) {
    serverOnline = online;

    if (!elements.serverStatus) return;

    elements.serverStatus.textContent = online
      ? "SERVER ONLINE"
      : "SERVER OFFLINE";

    elements.serverStatus.dataset.status = online ? "online" : "offline";
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return "Unknown";

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleString();
  }

  // =====================================
  // SEVERITY HANDLING
  // =====================================

  function normalizeSeverity(severity) {
    const value = String(severity || "INFO").toUpperCase();

    if (value === "CRITICAL" || value === "ERROR") {
      return "critical";
    }

    if (value === "WARNING" || value === "WARN") {
      return "warning";
    }

    return "info";
  }

  // =====================================
  // EVENT DETAILS
  // =====================================

  function getEventDetails(details) {
    if (!details) {
      return "No additional details";
    }

    if (typeof details === "string") {
      return details;
    }

    try {
      return JSON.stringify(details);
    } catch {
      return "Details unavailable";
    }
  }

  // =====================================
  // STATISTICS
  // =====================================

  function updateStatistics(events) {
    const stats = {
      total: events.length,
      info: 0,
      warning: 0,
      critical: 0,
    };

    events.forEach((event) => {
      const severity = normalizeSeverity(event.severity);

      if (severity === "critical") {
        stats.critical++;
      } else if (severity === "warning") {
        stats.warning++;
      } else {
        stats.info++;
      }
    });

    setText(elements.total, stats.total);
    setText(elements.info, stats.info);
    setText(elements.warning, stats.warning);
    setText(elements.critical, stats.critical);
  }

  // =====================================
  // TABLE COMPONENTS
  // =====================================

  function createCell(value) {
    const cell = document.createElement("td");

    cell.textContent = String(value);

    return cell;
  }

  function createSeverityBadge(severity) {
    const badge = document.createElement("span");
    const normalized = normalizeSeverity(severity);

    badge.className = `severity-badge ${normalized}`;
    badge.textContent = normalized.toUpperCase();

    return badge;
  }

  // =====================================
  // RENDER EVENTS
  // =====================================

  function renderEvents(events) {
    const tableBody = elements.tableBody;

    if (!tableBody) {
      console.error("Audit table body not found.");
      return;
    }

    tableBody.replaceChildren();

    if (events.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 4;
      cell.className = "empty-message";
      cell.textContent = "No matching audit events found.";

      row.appendChild(cell);
      tableBody.appendChild(row);

      setText(elements.counter, "0 events");

      return;
    }

    events.forEach((event) => {
      const row = document.createElement("tr");

      const timeCell = createCell(formatTimestamp(event.timestamp));

      const eventCell = createCell(event.event || "UNKNOWN_EVENT");

      const severityCell = document.createElement("td");

      severityCell.appendChild(createSeverityBadge(event.severity));

      const detailsCell = createCell(getEventDetails(event.details));

      row.append(timeCell, eventCell, severityCell, detailsCell);

      tableBody.appendChild(row);
    });

    setText(elements.counter, `${events.length} events`);
  }

  // =====================================
  // FILTERING
  // =====================================

  function applyFilters() {
    const searchTerm = (elements.search?.value || "").trim().toLowerCase();

    const selectedSeverity = (elements.severity?.value || "all").toLowerCase();

    const selectedType = (elements.eventType?.value || "all").toLowerCase();

    const filteredEvents = auditEvents.filter((event) => {
      const eventName = String(event.event || "").toLowerCase();

      const details = getEventDetails(event.details).toLowerCase();

      const severity = normalizeSeverity(event.severity);

      const matchesSearch =
        eventName.includes(searchTerm) || details.includes(searchTerm);

      const matchesSeverity =
        selectedSeverity === "all" || severity === selectedSeverity;

      const matchesType =
        selectedType === "all" || eventName.includes(selectedType);

      return matchesSearch && matchesSeverity && matchesType;
    });

    renderEvents(filteredEvents);
  }

  // =====================================
  // SERVER HEALTH CHECK
  // =====================================

  async function checkServerHealth() {
    try {
      const response = await fetch(HEALTH_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Health API Error: ${response.status}`);
      }

      const health = await response.json();

      const isOnline = health.success === true || health.status === "running";

      setServerStatus(isOnline);

      console.log("CyberShield Server Health:", health);

      return isOnline;
    } catch (error) {
      console.error("Server health check failed:", error);

      setServerStatus(false);

      return false;
    }
  }

  // =====================================
  // LOAD AUDIT EVENTS
  // =====================================

  async function loadAuditEvents() {
    if (elements.refresh) {
      elements.refresh.disabled = true;
      elements.refresh.textContent = "Loading...";
    }

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Audit API Error: ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data.events)) {
        throw new Error("Invalid audit API response");
      }

      auditEvents = data.events;

      updateStatistics(auditEvents);
      applyFilters();

      console.log("Audit Events Loaded:", auditEvents.length);
    } catch (error) {
      console.error("Failed to load audit events:", error);

      if (elements.tableBody) {
        elements.tableBody.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.className = "empty-message";

        cell.textContent =
          "Unable to load audit logs. Check server connection.";

        row.appendChild(cell);
        elements.tableBody.appendChild(row);
      }

      setText(elements.counter, "Connection error");
    } finally {
      if (elements.refresh) {
        elements.refresh.disabled = false;
        elements.refresh.textContent = "Refresh Logs";
      }
    }
  }

  // =====================================
  // EXPORT JSON REPORT
  // =====================================

  function exportAuditEvents() {
    if (auditEvents.length === 0) {
      alert("No audit events available to export.");
      return;
    }

    const report = {
      system: "CyberShield",
      reportType: "Security Audit Report",
      generatedAt: new Date().toISOString(),
      totalEvents: auditEvents.length,
      events: auditEvents,
    };

    const content = JSON.stringify(report, null, 2);

    const blob = new Blob([content], { type: "application/json" });

    const downloadURL = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = "cybershield-audit-report.json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(downloadURL);
    }, 1000);
  }

  // =====================================
  // MOBILE NAVIGATION
  // =====================================

  function setupNavigation() {
    elements.menuToggle?.addEventListener("click", () => {
      elements.navLinks?.classList.toggle("active");
    });
  }

  // =====================================
  // EVENT LISTENERS
  // =====================================

  elements.search?.addEventListener("input", applyFilters);

  elements.severity?.addEventListener("change", applyFilters);

  elements.eventType?.addEventListener("change", applyFilters);

  elements.refresh?.addEventListener("click", async () => {
    await checkServerHealth();
    await loadAuditEvents();
  });

  elements.export?.addEventListener("click", exportAuditEvents);

  // =====================================
  // INITIALIZATION
  // =====================================

  async function initializeDashboard() {
    setupNavigation();

    await checkServerHealth();
    await loadAuditEvents();

    console.log("CyberShield Audit Dashboard Initialized");
  }

  initializeDashboard();
});
