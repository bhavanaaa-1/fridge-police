import { useState } from "react";

export default function Settings({
  user,
  fridges = [],
  isDark,
  onToggleTheme,
  onNavigateToFridgeSettings,
  onNotify,
  onLogout,
}) {
  const [userName, setUserName] = useState(user?.name || "Bee");
  const [fifoHorizon, setFifoHorizon] = useState("3");
  const [notifyClaims, setNotifyClaims] = useState(true);
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setTimeout(() => {
      setSavingProfile(false);
      onNotify?.("Profile settings updated successfully.", "success");
    }, 400);
  };

  const userInitials = (user?.name || userName || "FP")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="stitch-page">
      {/* Editorial Header Bar */}
      <div className="stitch-page-header">
        <div className="page-header-titles">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="w-2 h-2 rounded-full bg-surface-tint" />
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">
              Communal Parameters &amp; Preferences
            </span>
          </div>
          <h1 className="stitch-title">Settings &amp; Preferences</h1>
          <p className="stitch-subtitle">
            Configure household steward credentials, notification thresholds, appearance, and communal discovery policies.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="stitch-btn stitch-btn-secondary"
            onClick={onLogout}
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Section 1: Steward Profile */}
        <div className="stitch-card">
          <div className="stitch-card-header">
            <div className="card-title-group">
              <span className="material-symbols-outlined text-[20px] text-primary">person</span>
              <h2 className="stitch-card-title">Steward Profile &amp; Account</h2>
            </div>
            <span className="brand-version-pill">Verified Steward</span>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0" }}>
              <div className="user-avatar-circle" style={{ width: 48, height: 48, fontSize: 18 }}>
                {userInitials}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: "var(--on-surface)" }}>
                  {user?.name || "Bee"}
                </span>
                <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
                  {user?.email || "steward@larder.org"}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)" }}>
                  Full Name / Display Moniker
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  style={{
                    height: 40,
                    padding: "0 12px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--surface-container-low)",
                    border: "1px solid var(--outline-variant)",
                    color: "var(--on-surface)",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--on-surface)" }}>
                  Pantry Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  style={{
                    height: 40,
                    padding: "0 12px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--surface-container-high)",
                    border: "1px solid var(--outline-variant)",
                    color: "var(--on-surface-variant)",
                    cursor: "not-allowed",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="submit"
                className="stitch-btn stitch-btn-primary"
                disabled={savingProfile}
              >
                <span>{savingProfile ? "Saving..." : "Save Profile Details"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Visual Theme & Appearance */}
        <div className="stitch-card">
          <div className="stitch-card-header">
            <div className="card-title-group">
              <span className="material-symbols-outlined text-[20px] text-primary">palette</span>
              <h2 className="stitch-card-title">System Appearance &amp; Theme</h2>
            </div>
            <span className="card-header-mono">{isDark ? "Obsidian Emerald" : "Warm Botanical"}</span>
          </div>
          <p className="card-description">
            Choose your preferred aesthetic. Both themes feature authentic illustrated culinary watermarks.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 12 }}>
            {/* Light Mode Card */}
            <div
              onClick={() => {
                if (isDark) onToggleTheme?.();
              }}
              style={{
                padding: 16,
                borderRadius: "var(--radius-lg)",
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(250, 247, 242, 0.95)",
                border: !isDark ? "2px solid #123f30" : "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition: "all 0.15s ease",
              }}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: "#123f30" }}>light_mode</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--on-surface)" }}>Warm Botanical Cream</span>
                </div>
                {!isDark && (
                  <span className="material-symbols-outlined text-[20px] text-primary">check_circle</span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--on-surface-variant)", margin: 0 }}>
                Editorial cream canvas with deep forest green accents, perfect for daylight pantry inventory.
              </p>
            </div>

            {/* Dark Mode Card */}
            <div
              onClick={() => {
                if (!isDark) onToggleTheme?.();
              }}
              style={{
                padding: 16,
                borderRadius: "var(--radius-lg)",
                backgroundColor: isDark ? "#131d17" : "rgba(0, 0, 0, 0.04)",
                border: isDark ? "2px solid #a2d0bc" : "1px solid var(--outline-variant)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition: "all 0.15s ease",
              }}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: "#a2d0bc" }}>dark_mode</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--on-surface)" }}>Obsidian Emerald</span>
                </div>
                {isDark && (
                  <span className="material-symbols-outlined text-[20px]" style={{ color: "#a2d0bc" }}>check_circle</span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--on-surface-variant)", margin: 0 }}>
                Deep botanical obsidian canvas with soft mint highlights and subtle engraved watermarks.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: FIFO Tracking & Notification Policies */}
        <div className="stitch-card">
          <div className="stitch-card-header">
            <div className="card-title-group">
              <span className="material-symbols-outlined text-[20px] text-primary">notifications_active</span>
              <h2 className="stitch-card-title">Alert &amp; Expiry Thresholds</h2>
            </div>
            <span className="card-header-mono">FIFO Protocol</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--surface-container-high)" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)", display: "block" }}>
                  Urgent Expiration Horizon
                </span>
                <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
                  Highlight provisions expiring within the specified days in dashboard alert triage.
                </span>
              </div>
              <select
                value={fifoHorizon}
                onChange={(e) => {
                  setFifoHorizon(e.target.value);
                  onNotify?.(`Expiration alert horizon updated to ${e.target.value} days.`, "info");
                }}
                className="role-select-filter"
                style={{ minWidth: 120 }}
              >
                <option value="1">1 Day</option>
                <option value="2">2 Days</option>
                <option value="3">3 Days (Nominal)</option>
                <option value="5">5 Days</option>
                <option value="7">7 Days</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--surface-container-high)" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)", display: "block" }}>
                  Portion Claim Notifications
                </span>
                <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
                  Receive immediate alerts when household members or neighbors claim meal portions.
                </span>
              </div>
              <input
                type="checkbox"
                checked={notifyClaims}
                onChange={(e) => {
                  setNotifyClaims(e.target.checked);
                  onNotify?.(`Portion claim alerts ${e.target.checked ? "enabled" : "disabled"}.`, "info");
                }}
                style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--on-surface)", display: "block" }}>
                  Community Membership Requests
                </span>
                <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
                  Notify stewards when neighbors apply to join your public community larders.
                </span>
              </div>
              <input
                type="checkbox"
                checked={notifyMembers}
                onChange={(e) => {
                  setNotifyMembers(e.target.checked);
                  onNotify?.(`Membership request alerts ${e.target.checked ? "enabled" : "disabled"}.`, "info");
                }}
                style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Your Managed Fridges & Privacy Settings Shortcut */}
        <div className="stitch-card">
          <div className="stitch-card-header">
            <div className="card-title-group">
              <span className="material-symbols-outlined text-[20px] text-primary">kitchen</span>
              <h2 className="stitch-card-title">Storage Units &amp; Discovery Policies</h2>
            </div>
            <span className="mono-badge">{fridges.length} Units Connected</span>
          </div>
          <p className="card-description">
            Each communal fridge maintains independent discoverability, public preview, and access rules.
          </p>

          {fridges.length === 0 ? (
            <div className="empty-sub-card">
              <p>No storage units joined yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {fridges.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--surface-container-low)",
                    border: "1px solid var(--surface-container-high)",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="brand-logo-icon" style={{ width: 34, height: 34 }}>
                      <span className="material-symbols-outlined text-[18px]">kitchen</span>
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--on-surface)" }}>
                          {f.name}
                        </span>
                        <span className={`status-pill ${f.isDiscoverable ? "pill-public" : "pill-private"}`}>
                          {f.isDiscoverable ? "Public Discoverable" : "Private Household"}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
                        {f.itemCount ?? 0} items · {f.memberCount ?? 1} members · Role: {f.role || "MEMBER"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="stitch-btn stitch-btn-secondary"
                    onClick={() => onNavigateToFridgeSettings?.(f.id)}
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span>Configure Fridge Settings</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
