// Already logged in? Go straight to your home page.
const savedUser = getUser();
if (getToken() && savedUser) window.location.href = NAV[savedUser.role][0][1];

// ----- Switch between "Sign in" and "Register" -----
function showMode(mode) {
  $("authShell").dataset.mode = mode;           // that's all: the CSS slides the panel and fades the forms
  say("", "", "loginMsg");
  say("", "", "regMsg");
}
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
