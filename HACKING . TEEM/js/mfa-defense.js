document.addEventListener("DOMContentLoaded", () => {
  // Get HTML Elements
  const mfaForm = document.getElementById("mfaForm");
  const otpForm = document.getElementById("otpForm");

  const usernameInput = document.getElementById("demoUsername");
  const phoneInput = document.getElementById("demoPhone");
  const otpInput = document.getElementById("otpInput");

  const smsSection = document.getElementById("smsSection");
  const smsPhone = document.getElementById("smsPhone");
  const smsCode = document.getElementById("smsCode");

  const mfaResult = document.getElementById("mfaResult");

  // Check required elements
  if (
    !mfaForm ||
    !otpForm ||
    !usernameInput ||
    !phoneInput ||
    !otpInput ||
    !smsSection ||
    !smsPhone ||
    !smsCode ||
    !mfaResult
  ) {
    console.error("MFA Error: Required HTML elements are missing.");
    return;
  }

  // Display messages safely
  function showMessage(message, type = "") {
    mfaResult.textContent = message;
    mfaResult.className = type;
  }

  // Send JSON request
  async function sendRequest(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    return {
      response,
      data,
    };
  }

  // =====================================
  // STEP 1: START MFA SIMULATION
  // =====================================

  mfaForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (username.length < 3 || username.length > 30) {
      showMessage("Username must contain 3 to 30 characters.", "mfa-error");
      return;
    }

    if (!/^\d{8,15}$/.test(phone)) {
      showMessage(
        "Enter a demo phone number using 8 to 15 digits.",
        "mfa-error",
      );
      return;
    }

    const button = mfaForm.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    smsSection.hidden = true;
    showMessage("Starting MFA simulation...", "");

    try {
      const result = await sendRequest("/api/mfa/start", {
        username: username,
        phone: phone,
      });

      const data = result.data;

      console.log("MFA Start Response:", data);

      if (!result.response.ok || data.success !== true) {
        throw new Error(data.message || "Could not start verification.");
      }

      // Validate SMS object before accessing its properties
      if (
        !data.sms ||
        typeof data.sms !== "object" ||
        !data.sms.phone ||
        !data.sms.code
      ) {
        throw new Error(
          "Server response is missing SMS information. Check app.py.",
        );
      }

      // Display simulated SMS
      smsPhone.textContent = data.sms.phone;
      smsCode.textContent = data.sms.code;

      smsSection.hidden = false;
      otpInput.value = "";

      showMessage(
        "Simulated SMS created successfully. Enter the displayed code.",
        "mfa-success",
      );
    } catch (error) {
      console.error("MFA Start Error:", error);

      showMessage(error.message || "Server connection failed.", "mfa-error");
    } finally {
      if (button) button.disabled = false;
    }
  });

  // =====================================
  // STEP 2: VERIFY OTP
  // =====================================

  otpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const otp = otpInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {
      showMessage(
        "Verification code must contain exactly 6 digits.",
        "mfa-error",
      );
      return;
    }

    const button = otpForm.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    showMessage("Verifying code...", "");

    try {
      const result = await sendRequest("/api/mfa/verify", {
        otp: otp,
      });

      const data = result.data;

      console.log("MFA Verify Response:", data);

      if (!result.response.ok || data.success !== true) {
        showMessage(data.message || "Verification failed.", "mfa-error");

        if (
          result.response.status === 410 ||
          result.response.status === 429 ||
          result.response.status === 401
        ) {
          smsSection.hidden = true;
        }

        return;
      }

      showMessage(data.message || "Verification successful!", "mfa-success");

      smsSection.hidden = true;
      mfaForm.reset();
      otpForm.reset();
    } catch (error) {
      console.error("MFA Verify Error:", error);

      showMessage(error.message || "Could not connect to server.", "mfa-error");
    } finally {
      if (button) button.disabled = false;
    }
  });

  console.log("CyberShield MFA loaded successfully.");
});
