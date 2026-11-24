(() => {
  "use strict";

  // ==================================
  // CYBERSHIELD RED TEAM / BLUE TEAM
  // ==================================

  const API = "http://127.0.0.1:5001/api/lab";

  // ==================================
  // DOM ELEMENTS
  // ==================================

  const serverStatus = document.getElementById("serverStatus");
  const serverDot = document.getElementById("serverDot");

  const createAccountForm = document.getElementById("createAccountForm");
  const createUsername = document.getElementById("createUsername");
  const createPassword = document.getElementById("createPassword");
  const createAccountButton = document.getElementById("createAccountButton");
  const accountResult = document.getElementById("accountResult");
  const accountStatus = document.getElementById("accountStatus");

  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginButton = document.getElementById("loginButton");
  const loginResult = document.getElementById("loginResult");

  const blueAccountStatus = document.getElementById("blueAccountStatus");
  const detectionStatus = document.getElementById("detectionStatus");
  const failedAttempts = document.getElementById("failedAttempts");
  const remainingAttempts = document.getElementById("remainingAttempts");
  const defenseAction = document.getElementById("defenseAction");
  const lockoutStatus = document.getElementById("lockoutStatus");

  const eventsTable = document.getElementById("eventsTable");
  const eventCount = document.getElementById("eventCount");

  const refreshButton = document.getElementById("refreshEvents");
  const resetButton = document.getElementById("resetLab");
  const deleteButton = document.getElementById("deleteAccount");
  const resetResult = document.getElementById("resetResult");

  // ==================================
  // APPLICATION STATE
  // ==================================

  let serverOnline = false;
  let hasAccount = false;
  let isBlocked = false;
  let requestInProgress = false;

  // ==================================
  // API REQUEST
  // ==================================

  async function apiRequest(endpoint, options = {}) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 6000);

    try {
      const headers = {
        ...(options.headers || {}),
      };

      if (options.body) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(`${API}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid server response.");
      }

      return {
        status: response.status,
        ok: response.ok,
        data,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ==================================
  // UI HELPERS
  // ==================================

  function showMessage(element, message, type = "") {
    if (!element) return;

    element.textContent = message;
    element.className = "result";

    if (type) {
      element.classList.add(type);
    }
  }

  function setServerStatus(online) {
    serverOnline = online;

    if (serverStatus) {
      serverStatus.textContent = online ? "SERVER ONLINE" : "SERVER OFFLINE";
    }

    if (serverDot) {
      serverDot.className = online ? "online" : "offline";
    }

    updateButtons();
  }

  function updateButtons() {
    if (createAccountButton) {
      createAccountButton.disabled =
        !serverOnline || hasAccount || requestInProgress;
    }

    if (loginButton) {
      loginButton.disabled =
        !serverOnline || !hasAccount || isBlocked || requestInProgress;
    }

    if (resetButton) {
      resetButton.disabled = !serverOnline || !hasAccount || requestInProgress;
    }

    if (deleteButton) {
      deleteButton.disabled = !serverOnline || !hasAccount || requestInProgress;
    }
  }

  function setAccountStatus(status) {
    if (accountStatus) {
      accountStatus.textContent = status;
      accountStatus.className = "";

      if (status === "NORMAL") {
        accountStatus.classList.add("status-normal");
      } else if (status === "LOCKED") {
        accountStatus.classList.add("status-danger");
      } else {
        accountStatus.classList.add("status-warning");
      }
    }

    if (blueAccountStatus) {
      blueAccountStatus.textContent = status;
    }
  }

  // ==================================
  // HEALTH CHECK
  // ==================================

  async function checkServer() {
    try {
      const response = await apiRequest("/health");

      if (!response.ok || !response.data.success) {
        throw new Error("Server unavailable.");
      }

      setServerStatus(true);

      await loadLabState();
    } catch (error) {
      setServerStatus(false);

      showMessage(
        loginResult,
        "Cannot connect to Red Team server. Start red_team_lab.py.",
        "error",
      );
    }
  }

  // ==================================
  // LOAD ACCOUNT AND BLUE TEAM STATE
  // ==================================

  async function loadLabState() {
    try {
      const response = await apiRequest("/state");

      if (!response.ok || !response.data.success) {
        throw new Error("Could not load lab state.");
      }

      const data = response.data;

      hasAccount = Boolean(data.account_exists);
      isBlocked = Boolean(data.blocked);

      if (hasAccount && data.username) {
        usernameInput.value = data.username;
        usernameInput.readOnly = true;
      } else {
        usernameInput.readOnly = false;
      }

      setAccountStatus(data.account_status);

      failedAttempts.textContent = data.attempts;
      remainingAttempts.textContent = data.remaining_attempts;

      if (isBlocked) {
        detectionStatus.textContent = "THREAT DETECTED";

        defenseAction.textContent =
          "Blue Team temporarily locked the demo account.";

        lockoutStatus.textContent = `Account locked. Retry after ${data.retry_after} seconds.`;
      } else if (!hasAccount) {
        detectionStatus.textContent = "WAITING";

        defenseAction.textContent =
          "Create a demo account to start security monitoring.";

        lockoutStatus.textContent = "No account created.";
      } else {
        detectionStatus.textContent = "MONITORING";

        defenseAction.textContent =
          "Monitoring authentication activity. No active lock.";

        lockoutStatus.textContent = "No active lock.";
      }

      updateButtons();
    } catch (error) {
      console.error("State error:", error);
    }
  }

  // ==================================
  // CREATE DEMO ACCOUNT
  // ==================================

  async function createDemoAccount(event) {
    event.preventDefault();

    if (!serverOnline || requestInProgress) return;

    const username = createUsername.value.trim();
    const password = createPassword.value;

    if (!username || !password) {
      showMessage(accountResult, "Enter a username and password.", "error");
      return;
    }

    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      showMessage(
        accountResult,
        "Username must be 3-24 characters using letters, numbers or underscore.",
        "error",
      );
      return;
    }

    if (password.length < 8 || password.length > 128) {
      showMessage(
        accountResult,
        "Password must be between 8 and 128 characters.",
        "error",
      );
      return;
    }

    requestInProgress = true;
    updateButtons();

    createAccountButton.textContent = "CREATING ACCOUNT...";

    try {
      const response = await apiRequest("/account/create", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = response.data;

      if (!response.ok || !data.success) {
        showMessage(
          accountResult,
          data.message || "Account creation failed.",
          "error",
        );
        return;
      }

      hasAccount = true;
      isBlocked = false;

      usernameInput.value = username;
      usernameInput.readOnly = true;

      createAccountForm.reset();

      showMessage(
        accountResult,
        "Demo account created successfully.",
        "success",
      );

      showMessage(
        loginResult,
        "Account is ready. You can now run a local login test.",
        "success",
      );

      await loadLabState();
      await refreshEvents();
    } catch (error) {
      showMessage(
        accountResult,
        "Could not create account. Check the local server.",
        "error",
      );
    } finally {
      requestInProgress = false;
      createAccountButton.textContent = "CREATE DEMO ACCOUNT";
      updateButtons();
    }
  }

  // ==================================
  // RED TEAM LOGIN TEST
  // ==================================

  async function runLoginTest(event) {
    event.preventDefault();

    if (!serverOnline || !hasAccount || requestInProgress) {
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showMessage(loginResult, "Enter the demo account credentials.", "error");
      return;
    }

    requestInProgress = true;
    updateButtons();

    loginButton.textContent = "TESTING...";

    try {
      const response = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = response.data;

      if (data.success) {
        showMessage(loginResult, "LOGIN SUCCESS: " + data.message, "success");
      } else if (data.blocked) {
        showMessage(
          loginResult,
          `${data.message} Retry after ${data.retry_after} seconds.`,
          "warning",
        );
      } else {
        // HTTP 401 is an expected failed-login result.
        showMessage(
          loginResult,
          data.message || "Login attempt failed.",
          "error",
        );
      }

      passwordInput.value = "";

      await loadLabState();
      await refreshEvents();
    } catch (error) {
      showMessage(
        loginResult,
        "Login request failed. Check the Red Team server.",
        "error",
      );
    } finally {
      requestInProgress = false;
      loginButton.textContent = "RUN LOGIN TEST";
      updateButtons();
    }
  }

  // ==================================
  // SECURITY EVENT TABLE
  // ==================================

  function addCell(row, value) {
    const cell = document.createElement("td");

    cell.textContent = value ?? "-";

    row.appendChild(cell);

    return cell;
  }

  function severityClass(severity) {
    switch (severity) {
      case "CRITICAL":
        return "critical";

      case "WARNING":
        return "warning";

      default:
        return "info";
    }
  }

  async function refreshEvents() {
    try {
      const response = await apiRequest("/events");

      if (!response.ok || !response.data.success) {
        throw new Error("Could not load events.");
      }

      const events = response.data.events || [];

      eventsTable.replaceChildren();

      if (events.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.className = "empty";
        cell.textContent = "No security events found.";

        row.appendChild(cell);
        eventsTable.appendChild(row);
      }

      events.forEach((event) => {
        const row = document.createElement("tr");

        const timestamp = event.timestamp
          ? new Date(event.timestamp).toLocaleString()
          : "-";

        addCell(row, timestamp);
        addCell(row, event.event);

        const severityCell = addCell(row, event.severity);
        severityCell.className = severityClass(event.severity);

        addCell(row, event.details);

        eventsTable.appendChild(row);
      });

      eventCount.textContent = `${events.length} EVENTS`;
    } catch (error) {
      console.error("Events error:", error);

      eventsTable.replaceChildren();

      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 4;
      cell.className = "empty";
      cell.textContent = "Unable to load security events.";

      row.appendChild(cell);
      eventsTable.appendChild(row);
    }
  }

  // ==================================
  // RESET FAILED ATTEMPTS
  // ==================================

  async function resetLab() {
    if (!serverOnline || !hasAccount || requestInProgress) return;

    const confirmed = window.confirm(
      "Reset failed attempts and remove the temporary account lock?",
    );

    if (!confirmed) return;

    requestInProgress = true;
    updateButtons();

    resetButton.textContent = "RESETTING...";

    try {
      const response = await apiRequest("/reset", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!response.ok || !response.data.success) {
        throw new Error(response.data.message);
      }

      showMessage(resetResult, response.data.message, "success");

      showMessage(
        loginResult,
        "Failed attempts reset. The demo account is ready.",
        "success",
      );

      await loadLabState();
      await refreshEvents();
    } catch (error) {
      showMessage(resetResult, "Could not reset the lab.", "error");
    } finally {
      requestInProgress = false;
      resetButton.textContent = "RESET FAILED ATTEMPTS";
      updateButtons();
    }
  }

  // ==================================
  // DELETE DEMO ACCOUNT
  // ==================================

  async function deleteDemoAccount() {
    if (!serverOnline || !hasAccount || requestInProgress) return;

    const confirmed = window.confirm(
      "Delete the local demo account? You will need to create a new one.",
    );

    if (!confirmed) return;

    requestInProgress = true;
    updateButtons();

    deleteButton.textContent = "DELETING...";

    try {
      const response = await apiRequest("/account/delete", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!response.ok || !response.data.success) {
        throw new Error(response.data.message);
      }

      hasAccount = false;
      isBlocked = false;

      usernameInput.value = "";
      usernameInput.readOnly = false;
      passwordInput.value = "";

      showMessage(resetResult, "Demo account deleted successfully.", "success");

      await loadLabState();
      await refreshEvents();
    } catch (error) {
      showMessage(resetResult, "Could not delete the demo account.", "error");
    } finally {
      requestInProgress = false;
      deleteButton.textContent = "DELETE DEMO ACCOUNT";
      updateButtons();
    }
  }

  // ==================================
  // EVENT LISTENERS
  // ==================================

  createAccountForm.addEventListener("submit", createDemoAccount);

  loginForm.addEventListener("submit", runLoginTest);

  refreshButton.addEventListener("click", refreshEvents);

  resetButton.addEventListener("click", resetLab);

  deleteButton.addEventListener("click", deleteDemoAccount);

  // ==================================
  // INITIALIZATION
  // ==================================

  async function initialize() {
    await checkServer();
    await refreshEvents();
  }

  initialize();
})();
