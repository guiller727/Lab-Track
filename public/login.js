// Already logged in? Go straight to your home page.
const savedUser = getUser();
if (getToken() && savedUser) window.location.href = NAV[savedUser.role][0][1];

// ----- Switch between "Sign in" and "Register" -----
// PC: changing data-mode is enough, the CSS slides the blue panel sideways and fades the forms.
// Phones: the panel sits BELOW Sign In and ABOVE Register, so here we glide it up/down ourselves.
const shell = $("authShell");
const panel = document.querySelector(".auth-panel");
const boxes = { login: document.querySelector(".auth-box-login"), register: document.querySelector(".auth-box-register") };
const isPhone = () => window.matchMedia("(max-width: 760px)").matches;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SMOOTH = "cubic-bezier(0.22, 1, 0.36, 1)";
let switching = false;                          // ignore extra taps while it animates

function applyMode(mode) {
  shell.dataset.mode = mode;
  say("", "", "loginMsg");
  say("", "", "regMsg");
  // The hidden form can't be tabbed into
  boxes.login.inert = mode !== "login";
  boxes.register.inert = mode !== "register";
}

async function showMode(mode) {
  const from = shell.dataset.mode;
  if (from === mode) return;
  if (!isPhone() || reducedMotion() || !panel.animate) return applyMode(mode);
  if (switching) return;
  switching = true;
  try {
    const oldBox = boxes[from];
    const leavingRegister = from === "register";

    // 1. Leaving Sign In: the form fades out first, drifting down.
    if (!leavingRegister) {
      await oldBox.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(24px)" }],
        { duration: 260, easing: "ease-in", fill: "forwards" }).finished.catch(() => {});
    } else {
      // Leaving Register: keep "Create Account" where it is so it can slide away on top of the new layout.
      oldBox.style.top = oldBox.offsetTop + "px";
      oldBox.classList.add("auth-leaving");
    }

    // 2. Swap the layout; the blue panel glides from its old spot to the new one.
    const before = panel.getBoundingClientRect().top;
    applyMode(mode);
    if (!leavingRegister) oldBox.getAnimations().forEach((a) => a.cancel());
    const after = panel.getBoundingClientRect().top;
    panel.animate([{ transform: `translateY(${before - after}px)` }, { transform: "translateY(0)" }],
      { duration: 700, easing: "cubic-bezier(0.65, 0, 0.35, 1)" });

    if (leavingRegister) {
      oldBox.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-60px)" }],
        { duration: 350, easing: "ease-out", fill: "forwards" }).finished.catch(() => {}).then(() => {
        oldBox.classList.remove("auth-leaving");
        oldBox.style.top = "";
        oldBox.getAnimations().forEach((a) => a.cancel());
      });
    }

    // 3. The new form slides in: Create Account rises from below, Sign In drops from above.
    boxes[mode].animate(
      [{ opacity: 0, transform: `translateY(${mode === "register" ? 60 : -60}px)` }, { opacity: 1, transform: "none" }],
      { duration: 750, delay: leavingRegister ? 350 : 120, easing: SMOOTH, fill: "backwards" });

    // Keep the top of the card in view
    if (shell.getBoundingClientRect().top < 0) shell.scrollIntoView({ block: "start", behavior: "smooth" });
  } finally {
    switching = false;
  }
}
applyMode("login");
$("toRegister").addEventListener("click", () => showMode("register"));
$("toLogin").addEventListener("click", () => showMode("login"));

// ----- Log in -----
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();                       // stop the page from reloading
  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: $("loginUser").value, password: $("loginPass").value }),
    });
    sessionStorage.setItem("token", result.token);
    sessionStorage.setItem("user", JSON.stringify(result.user));
    window.location.href = NAV[result.user.role][0][1];   // admin -> Dashboard, student -> Equipment
  } catch (error) { say(error.message, "error", "loginMsg"); }
});

// ----- Duplicate username: shown in red under the field -----
function flagUsername(text) {
  $("regUserError").textContent = text;
  $("regUser").classList.toggle("invalid", Boolean(text));
}

// Checks as soon as the student leaves the username box.
$("regUser").addEventListener("blur", async () => {
  const username = $("regUser").value.trim();
  if (!username) return;
  try {
    const result = await api("/api/auth/username-available?username=" + encodeURIComponent(username));
    if (!result.available) flagUsername("That username is already taken.");
  } catch (error) { console.error(error); }
});
$("regUser").addEventListener("input", () => flagUsername(""));   // clear the flag while typing

// ----- Sign up (always creates a student) -----
$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: $("regName").value, username: $("regUser").value, password: $("regPass").value }),
    });
    $("registerForm").reset();
    showMode("login");
    say(result.message, "success", "loginMsg");
  } catch (error) {
    if (error.status === 409) {                 // 409 = username already exists
      flagUsername(error.message);
      $("regUser").focus();
    } else {
      say(error.message, "error", "regMsg");
    }
  }
});

// ----- Forgot password: upload the .key file, then choose a new password -----
let keyText = "";                               // the text inside the uploaded file (kept only in memory)

function openResetDialog() {
  keyText = "";
  $("keyFile").value = "";
  $("resetForm").reset();
  $("resetStep1").hidden = false;               // show step 1 (upload)
  $("resetForm").hidden = true;                 // hide step 2 (new password)
  say("", "", "resetMsg");
  $("resetDialog").showModal();
}
$("forgotBtn").addEventListener("click", openResetDialog);
$("resetClose").addEventListener("click", () => $("resetDialog").close());

// Step 1: a file was chosen. Ask the server if the key inside it is correct.
$("keyFile").addEventListener("change", async () => {
  const file = $("keyFile").files[0];
  if (!file) return;
  if (file.size > 1024) { say("That file is too big to be a key file.", "error", "resetMsg"); return; }
  keyText = await file.text();
  try {
    await api("/api/auth/check-key", { method: "POST", body: JSON.stringify({ key: keyText }) });
    say("Key accepted. Choose a new password.", "success", "resetMsg");
    $("resetStep1").hidden = true;
    $("resetForm").hidden = false;
    $("resetUser").focus();
  } catch (error) {
    say(error.message, "error", "resetMsg");
    $("keyFile").value = "";                    // let them pick another file
  }
});

// Step 2: send username + new password (the key is checked again on the server).
$("resetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if ($("resetPass").value !== $("resetPass2").value) { say("The two passwords do not match.", "error", "resetMsg"); return; }
  try {
    const result = await api("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ key: keyText, username: $("resetUser").value, new_password: $("resetPass").value }),
    });
    $("resetDialog").close();
    say(result.message, "success", "loginMsg");
  } catch (error) { say(error.message, "error", "resetMsg"); }
});

// ----- Eye button: show / hide the password -----
const EYE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/><line class="slash" x1="3" y1="3" x2="21" y2="21"/></svg>`;

document.querySelectorAll('input[type="password"]').forEach((input) => {
  input.classList.add("has-toggle");            // leave room for the eye on the right
  const eye = makeButton("", "eye", () => {
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    eye.classList.toggle("on", hidden);
    eye.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
  });
  eye.innerHTML = EYE_ICON;
  eye.setAttribute("aria-label", "Show password");
  input.parentNode.appendChild(eye);            // the eye sits inside the same .input-icon box
});

// Message after the automatic inactivity logout.
if (new URLSearchParams(window.location.search).get("reason") === "idle") {
  say("You were logged out because of inactivity. Please log in again.", "", "loginMsg");
}
