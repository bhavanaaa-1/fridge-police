import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { apiRequest, clearToken, getToken, setToken } from "./lib/api";
import Navigation from "./components/Navigation";
import HomeDashboard from "./components/HomeDashboard";
import MyFridges from "./components/MyFridges";
import Discover from "./components/Discover";
import MyRequests from "./components/MyRequests";
import ActivityFeed from "./components/ActivityFeed";
import CreateFridgeModal from "./components/CreateFridgeModal";
import Settings from "./components/Settings";

function App() {
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authFieldErrors, setAuthFieldErrors] = useState({});
  const [authLoading, setAuthLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // App Navigation & Selected Fridge state
  const [activeNav, setActiveNav] = useState("home"); // "home" | "fridges" | "discover" | "my-requests" | "activity" | "settings"
  const [fridges, setFridges] = useState([]);
  const [selectedFridgeId, setSelectedFridgeId] = useState(
    sessionStorage.getItem("fridgepolice_fridge") || ""
  );
  const [createFridgeOpen, setCreateFridgeOpen] = useState(false);

  // Theme state (synced with localStorage & html attributes)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("fridgepolice_theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("fridgepolice_theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  // Notification Toast state
  const [notification, setNotification] = useState(null);

  const notify = useCallback((message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  // Load current user profile when token exists
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/auth/me");
        if (!cancelled) setUser(data.user);
      } catch (err) {
        if (!cancelled) {
          clearToken();
          setTokenState("");
          setUser(null);
          notify(err.message, "error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, notify]);

  // Load fridges when user is known
  const fetchFridges = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiRequest("/fridges");
      setFridges(data.fridges || []);
      setSelectedFridgeId((prev) => {
        if (prev && data.fridges?.some((f) => f.id === prev)) return prev;
        const first = data.fridges?.[0]?.id || "";
        if (first) sessionStorage.setItem("fridgepolice_fridge", first);
        else sessionStorage.removeItem("fridgepolice_fridge");
        return first;
      });
    } catch (err) {
      notify(err.message, "error");
    }
  }, [user, notify]);

  useEffect(() => {
    fetchFridges();
  }, [fetchFridges]);

  // Update selected fridge in sessionStorage
  const handleSelectFridge = (id) => {
    setSelectedFridgeId(id);
    if (id) {
      sessionStorage.setItem("fridgepolice_fridge", id);
    } else {
      sessionStorage.removeItem("fridgepolice_fridge");
    }
  };

  // RFC-compliant email validation matching backend Zod email schema rules
  const EMAIL_REGEX =
    /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/i;

  function validateAuthForm() {
    const errors = {};
    if (authMode === "register" && !authForm.name.trim()) {
      errors.name = "Name is required.";
    }
    const trimmedEmail = authForm.email.trim();
    if (!trimmedEmail) {
      errors.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = "Enter a valid email address.";
    }
    if (authForm.password.length < 8) {
      errors.password = "Password must contain at least 8 characters.";
    }
    setAuthFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    setAuthFieldErrors({});
    if (!validateAuthForm()) return;
    setAuthLoading(true);
    try {
      const trimmedEmail = authForm.email.trim();
      const normalizedEmail = trimmedEmail.toLowerCase();

      if (authMode === "register") {
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name: authForm.name.trim(),
            email: normalizedEmail,
            password: authForm.password,
          }),
        });
        // Automatically authenticate newly registered user
        const loginData = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: normalizedEmail,
            password: authForm.password,
          }),
        });
        setToken(loginData.token);
        setTokenState(loginData.token);
        setUser(loginData.user);
        setAuthForm({ name: "", email: "", password: "" });
      } else {
        const data = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: normalizedEmail,
            password: authForm.password,
          }),
        });
        setToken(data.token);
        setTokenState(data.token);
        setUser(data.user);
        setAuthForm({ name: "", email: "", password: "" });
      }
    } catch (err) {
      if (Array.isArray(err.fieldErrors)) {
        const mapped = {};
        err.fieldErrors.forEach((e) => {
          const field = Array.isArray(e.path) ? e.path[e.path.length - 1] : null;
          if (field && !mapped[field]) mapped[field] = e.message;
        });
        setAuthFieldErrors((prev) => ({ ...prev, ...mapped }));
      }
      if (err.status === 409 || err.message === "Email is already registered") {
        setAuthFieldErrors((prev) => ({
          ...prev,
          email: prev.email || "Email is already registered.",
        }));
      }
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    setTokenState("");
    setUser(null);
    setFridges([]);
    setSelectedFridgeId("");
    sessionStorage.removeItem("fridgepolice_fridge");
  }

  // ==========================================
  // AUTHENTICATION SCREEN (MATCHING STITCH)
  // ==========================================
  if (!token || !user) {
    const showPassword = authMode === "login" ? showLoginPassword : showRegisterPassword;
    const setShowPassword = authMode === "login" ? setShowLoginPassword : setShowRegisterPassword;

    const fillDemo = (email, password) => {
      setAuthForm((prev) => ({
        ...prev,
        email,
        password,
      }));
      setAuthError("");
      setAuthFieldErrors({});
    };

    return (
      <main className="auth-page-stitch">
        <div className="auth-card-stitch">
          {/* Brand Crest & Header */}
          <header className="auth-header-stitch">
            <div className="auth-crest-wrap">
              <span className="material-symbols-outlined text-[28px] text-primary">kitchen</span>
            </div>
            <div className="auth-brand-tag-row">
              <span className="auth-brand-title">FridgePolice</span>
              <span className="auth-version-pill">v2.4</span>
            </div>
            <h1 className="auth-headline">
              {authMode === "login" ? "Welcome back" : "Create an account"}
            </h1>
            <p className="auth-subtitle">
              {authMode === "login"
                ? "Sign in to manage your household and communal pantry provisions."
                : "Register to coordinate and share communal pantry provisions."}
            </p>
          </header>

          {authError && (
            <div className="auth-alert" role="alert">
              <span className="auth-alert-icon">!</span>
              <span>{authError}</span>
            </div>
          )}

          {/* Interactive Credentials Form */}
          <form className="auth-form-stitch" onSubmit={handleAuthSubmit} noValidate>
            {authMode === "register" && (
              <div className="auth-field-group">
                <div className="auth-label-row">
                  <label htmlFor="nameInput" className="auth-field-label">Full Name</label>
                  <span className="auth-field-required">Required</span>
                </div>
                <div className="auth-input-wrapper">
                  <span className="material-symbols-outlined auth-input-icon">person</span>
                  <input
                    id="nameInput"
                    type="text"
                    value={authForm.name}
                    onChange={(e) => {
                      setAuthForm({ ...authForm, name: e.target.value });
                      if (authFieldErrors.name) setAuthFieldErrors((prev) => ({ ...prev, name: "" }));
                      if (authError) setAuthError("");
                    }}
                    placeholder="Maya Chen"
                    autoComplete="name"
                    className={authFieldErrors.name ? "input-has-error" : ""}
                  />
                </div>
                {authFieldErrors.name && (
                  <span className="field-error" role="alert">
                    {authFieldErrors.name}
                  </span>
                )}
              </div>
            )}

            <div className="auth-field-group">
              <div className="auth-label-row">
                <label htmlFor="emailInput" className="auth-field-label">Pantry ID / Email</label>
                <span className="auth-field-required">Required</span>
              </div>
              <div className="auth-input-wrapper">
                <span className="material-symbols-outlined auth-input-icon">mail</span>
                <input
                  id="emailInput"
                  type="email"
                  value={authForm.email}
                  onChange={(e) => {
                    setAuthForm({ ...authForm, email: e.target.value });
                    if (authFieldErrors.email) setAuthFieldErrors((prev) => ({ ...prev, email: "" }));
                    if (authError) setAuthError("");
                  }}
                  placeholder="bee@larder.org"
                  autoComplete="email"
                  className={authFieldErrors.email ? "input-has-error" : ""}
                />
              </div>
              {authFieldErrors.email && (
                <span className="field-error" role="alert">
                  {authFieldErrors.email}
                </span>
              )}
            </div>

            <div className="auth-field-group">
              <div className="auth-label-row">
                <label htmlFor="passwordInput" className="auth-field-label">Password</label>
                {authMode === "login" && (
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      notify("Contact your household steward or administrator to reset password.", "info");
                    }}
                    className="auth-forgot-link"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="auth-input-wrapper">
                <span className="material-symbols-outlined auth-input-icon">lock</span>
                <input
                  id="passwordInput"
                  type={showPassword ? "text" : "password"}
                  value={authForm.password}
                  onChange={(e) => {
                    setAuthForm({ ...authForm, password: e.target.value });
                    if (authFieldErrors.password) setAuthFieldErrors((prev) => ({ ...prev, password: "" }));
                    if (authError) setAuthError("");
                  }}
                  placeholder="••••••••••••"
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  className={authFieldErrors.password ? "input-has-error" : ""}
                />
                <button
                  type="button"
                  className="auth-password-toggle-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {authMode === "register" && (
                <span className="field-hint">Must contain at least 8 characters.</span>
              )}
              {authFieldErrors.password && (
                <span className="field-error" role="alert">
                  {authFieldErrors.password}
                </span>
              )}
            </div>

            <div className="auth-action-row">
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={authLoading}
              >
                <span>
                  {authLoading
                    ? "Authenticating..."
                    : authMode === "login"
                    ? "Sign In to FridgePolice"
                    : "Create FridgePolice Account"}
                </span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </form>

          {/* Demo Quick-Fill Presets from Stitch */}
          <div className="auth-quick-fill-card">
            <div className="quick-fill-header">
              <span className="quick-fill-title">Quick fill access</span>
              <span className="material-symbols-outlined text-secondary text-[16px]">touch_app</span>
            </div>
            <div className="quick-fill-buttons">
              <button
                type="button"
                className="quick-fill-btn"
                onClick={() => fillDemo("bee@larder.org", "green-steward-2025")}
              >
                <div className="quick-fill-btn-left">
                  <span className="quick-fill-dot dot-primary"></span>
                  <span className="quick-fill-name">Demo: Bee <span className="quick-fill-role">(Household Steward)</span></span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-secondary">login</span>
              </button>
              <button
                type="button"
                className="quick-fill-btn"
                onClick={() => fillDemo("maya@larder.org", "harvest-commune-99")}
              >
                <div className="quick-fill-btn-left">
                  <span className="quick-fill-dot dot-secondary"></span>
                  <span className="quick-fill-name">Demo: Maya <span className="quick-fill-role">(Community Member)</span></span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-secondary">login</span>
              </button>
            </div>
          </div>

          {/* Registration Switch */}
          <div className="auth-switch-stitch">
            <span>{authMode === "login" ? "Don't have an account?" : "Already have an account?"}</span>{" "}
            <button
              type="button"
              className="auth-switch-link"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
                setAuthFieldErrors({});
              }}
            >
              {authMode === "login" ? "Create an account" : "Sign in"}
            </button>
          </div>

          {/* Protocol Security Notice */}
          <footer className="auth-footer-notice">
            <span className="material-symbols-outlined text-[15px]">lock</span>
            <span>Zero food waste · Encrypted communal sharing protocols</span>
          </footer>
        </div>
      </main>
    );
  }

  // ==========================================
  // MAIN AUTHENTICATED PLATFORM
  // ==========================================
  return (
    <div className="app-shell platform-shell">
      {/* Universal Navigation Bar */}
      <Navigation
        activeNav={activeNav}
        setActiveNav={(nav) => {
          setActiveNav(nav);
          // If switching to fridges without pre-selection, let MyFridges show all
        }}
        user={user}
        fridges={fridges}
        selectedFridge={fridges.find((f) => f.id === selectedFridgeId)}
        onOpenCreateFridge={() => setCreateFridgeOpen(true)}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      {/* Global Toast Notification */}
      {notification && (
        <div className={`toast-notification toast-${notification.type}`} role="status">
          <span>{notification.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            onClick={() => setNotification(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Destination Router */}
      <main className="main-content-area">
        {activeNav === "home" && (
          <HomeDashboard
            user={user}
            fridges={fridges}
            onSelectFridge={(id) => {
              handleSelectFridge(id);
              setActiveNav("fridges");
            }}
            onOpenCreateFridge={() => setCreateFridgeOpen(true)}
            setActiveNav={setActiveNav}
            onNotify={notify}
          />
        )}

        {activeNav === "fridges" && (
          <MyFridges
            user={user}
            fridges={fridges}
            activeFridgeId={selectedFridgeId}
            onSelectFridge={handleSelectFridge}
            onOpenCreateFridge={() => setCreateFridgeOpen(true)}
            onRefreshFridges={fetchFridges}
            onNotify={notify}
          />
        )}

        {activeNav === "discover" && (
          <Discover
            user={user}
            onNotify={notify}
            onNavigateToFridge={(id) => {
              handleSelectFridge(id);
              setActiveNav("fridges");
            }}
          />
        )}

        {activeNav === "my-requests" && (
          <MyRequests
            user={user}
            onNotify={notify}
            onNavigateToFridge={(id) => {
              handleSelectFridge(id);
              setActiveNav("fridges");
            }}
          />
        )}

        {activeNav === "activity" && (
          <ActivityFeed
            user={user}
            fridges={fridges}
            onNotify={notify}
            onNavigateToFridge={(id) => {
              handleSelectFridge(id);
              setActiveNav("fridges");
            }}
          />
        )}

        {activeNav === "settings" && (
          <Settings
            user={user}
            fridges={fridges}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            onNavigateToFridgeSettings={(fridgeId) => {
              handleSelectFridge(fridgeId);
              setActiveNav("fridges");
            }}
            onNotify={notify}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Create Fridge Modal */}
      <CreateFridgeModal
        isOpen={createFridgeOpen}
        onClose={() => setCreateFridgeOpen(false)}
        onCreated={(newFridge) => {
          fetchFridges();
          handleSelectFridge(newFridge.id);
          setActiveNav("fridges");
        }}
        onNotify={notify}
      />

      {/* Editorial Platform Footer */}
      <footer className="platform-footer">
        <div className="footer-content">
          <div className="footer-left">
            <strong>FridgePolice</strong>
            <span>Communal food logistics & zero-waste pantry intelligence</span>
          </div>
          <div className="footer-right">
            <span>Signed in as {user.name} ({user.email})</span>
            <small>© 2026 FridgePolice · Community Edition</small>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
