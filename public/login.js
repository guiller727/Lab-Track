// Already logged in? Go straight to your home page.
const savedUser = getUser();
if (getToken() && savedUser) window.location.href = NAV[savedUser.role][0][1];

// ----- Switch between "Log in" and "Student sign up" -----
function showTab(which) {
  const isLogin = which === "login";
  $("loginForm").hidden = !isLogin;
  $("registerForm").hidden = isLogin;
  $("tabLogin").classList.toggle("active", isLogin);
  $("tabRegister").classList.toggle("active", !isLogin);
  say("");
}
$("tabLogin").addEventListener("click", () => showTab("login"));
$("tabRegister").addEventListener("click", () => showTab("register"));

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
  } catch (error) { say(error.message, "error"); }
});

// ----- Sign up (always creates a student) -----
$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: $("regName").value, username: $("regUser").value, password: $("regPass").value }),
    });
    $("registerForm").reset();
    showTab("login");
    say(result.message, "success");
  } catch (error) { say(error.message, "error"); }
});

// ----- Eye button: show / hide the password -----
const EYE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/><line class="slash" x1="3" y1="3" x2="21" y2="21"/></svg>`;

document.querySelectorAll('input[type="password"]').forEach((input) => {
  const wrap = document.createElement("div");
  wrap.className = "password-wrap";
  input.parentNode.insertBefore(wrap, input);   // put a wrapper where the input is...
  wrap.appendChild(input);                      // ...and move the input inside it

  const eye = makeButton("", "eye", () => {
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    eye.classList.toggle("on", hidden);
    eye.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
  });
  eye.innerHTML = EYE_ICON;
  eye.setAttribute("aria-label", "Show password");
  wrap.appendChild(eye);
});

// Message after the automatic inactivity logout.
if (new URLSearchParams(window.location.search).get("reason") === "idle") {
  say("You were logged out because of inactivity. Please log in again.");
}
