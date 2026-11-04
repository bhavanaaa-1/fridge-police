import { useEffect, useRef, useState } from "react";

export default function Navigation({
  activeNav,
  setActiveNav,
  user,
  fridges = [],
  selectedFridge,
  onOpenCreateFridge,
  onLogout,
  onSearchFocus,
  isDark: propIsDark,
  onToggleTheme: propToggleTheme,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const [internalDark, setInternalDark] = useState(() => {
    const saved = localStorage.getItem("fridgepolice_theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  const isDark = propIsDark !== undefined ? propIsDark : internalDark;

  const toggleTheme = () => {
    if (propToggleTheme) {
      propToggleTheme();
    } else {
      setInternalDark((prev) => {
        const next = !prev;
        localStorage.setItem("fridgepolice_theme", next ? "dark" : "light");
        if (next) {
          document.documentElement.setAttribute("data-theme", "dark");
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.setAttribute("data-theme", "light");
          document.documentElement.classList.remove("dark");
        }
        return next;
      });
    }
  };

  // Close user dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

  const navItems = [
    {
      id: "home",
      label: "Dashboard",
      icon: "space_dashboard",
    },
    {
      id: "fridges",
      label: "My Fridges",
      icon: "inventory_2",
      count: fridges.length,
    },
    {
      id: "discover",
      label: "Discover Fridges",
      icon: "explore",
    },
    {
      id: "my-requests",
      label: "Food Requests",
      icon: "ramen_dining",
    },
    {
      id: "activity",
      label: "Activity Log",
      icon: "history",
    },
  ];

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "FP";

  // Breadcrumb resolver
  const getBreadcrumbs = () => {
    if (activeNav === "fridges") {
      if (selectedFridge) {
        return (
          <>
            <span
              className="breadcrumb-link"
              onClick={() => setActiveNav("fridges")}
              role="button"
              tabIndex={0}
            >
              Fridges
            </span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-link">{selectedFridge.name}</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Inventory</span>
          </>
        );
      }
      return (
        <>
          <span className="breadcrumb-link">Fridges</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">All Units</span>
        </>
      );
    }
    if (activeNav === "discover") {
      return (
        <>
          <span className="breadcrumb-link">Explore</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Community Pantries</span>
        </>
      );
    }
    if (activeNav === "my-requests") {
      return (
        <>
          <span className="breadcrumb-link">Operations</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Food Requests</span>
        </>
      );
    }
    if (activeNav === "activity") {
      return (
        <>
          <span className="breadcrumb-link">Ledger</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Activity Audit</span>
        </>
      );
    }
    if (activeNav === "settings") {
      return (
        <>
          <span className="breadcrumb-link">Operations</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Settings &amp; Preferences</span>
        </>
      );
    }
    return (
      <>
        <span className="breadcrumb-link">Overview</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Dashboard</span>
      </>
    );
  };

  return (
    <>
      {/* Stitch Fixed Operations Left Sidebar */}
      <aside className={`stitch-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          {/* Brand Header */}
          <div className="sidebar-brand">
            <div className="brand-badge-row">
              <div className="brand-logo-icon">
                <span className="material-symbols-outlined text-[24px]">kitchen</span>
              </div>
              <div className="brand-text-col">
                <span className="brand-title">FridgePolice</span>
                <span className="brand-subtitle">Botanical Inventory</span>
              </div>
            </div>
            <span className="brand-version-pill">v2.4</span>
          </div>

          {/* Nav Links */}
          <div className="sidebar-nav-section">
            <div className="sidebar-section-heading">OPERATIONS</div>
            <nav className="sidebar-nav">
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <div className="nav-item-left">
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count !== null && (
                      <span className="nav-count-badge">{item.count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer User Pill */}
        <div className="sidebar-footer">
          <div className="sidebar-bottom-nav">
            <button
              type="button"
              className={`sidebar-settings-link ${activeNav === "settings" ? "active" : ""}`}
              onClick={() => {
                setActiveNav("settings");
                setMobileMenuOpen(false);
              }}
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span>Settings</span>
            </button>
          </div>

          <div
            className="user-steward-pill"
            onClick={() => {
              setActiveNav("settings");
              setMobileMenuOpen(false);
            }}
            role="button"
            tabIndex={0}
            title="Manage steward settings"
            style={{ cursor: "pointer" }}
          >
            <div className="user-steward-left">
              <div className="user-avatar-circle">{userInitials}</div>
              <div className="user-steward-info">
                <span className="steward-name">{user?.name || "Bee"}</span>
                <span className="steward-role">Household Steward</span>
              </div>
            </div>
            <button
              type="button"
              className="logout-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Stitch Top Header Bar */}
      <header className="stitch-topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-[20px]">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {getBreadcrumbs()}
          </nav>
        </div>

        {/* Search Command Bar (Desktop) */}
        <div className="topbar-center">
          <div className="command-search-wrap">
            <span className="material-symbols-outlined text-[16px] search-glyph">search</span>
            <input
              type="text"
              placeholder="Search inventory, batches, tags... (⌘K)"
              className="command-search-input"
              onFocus={onSearchFocus}
            />
            <span className="command-key-chip">⌘K</span>
          </div>
        </div>

        {/* Top Actions */}
        <div className="topbar-actions">
          <button
            type="button"
            className="topbar-action-btn"
            onClick={onOpenCreateFridge}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span className="btn-label-desktop">Create Fridge</span>
          </button>

          <button
            type="button"
            className="topbar-icon-btn"
            onClick={toggleTheme}
            title={isDark ? "Light mode" : "Dark botanical mode"}
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* Topbar User Avatar Dropdown */}
          <div className="topbar-user-menu-wrapper" ref={userMenuRef}>
            <button
              type="button"
              className="topbar-user-avatar-btn"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label="User account menu"
              title={`Signed in as ${user?.name || "Steward"} (${user?.email || ""})`}
            >
              <div className="topbar-user-avatar">
                {userInitials}
              </div>
            </button>

            {userMenuOpen && (
              <div className="topbar-dropdown-menu" role="menu">
                <div className="dropdown-user-header">
                  <div className="dropdown-user-avatar">{userInitials}</div>
                  <div className="dropdown-user-info">
                    <div className="dropdown-user-name">{user?.name || "Household Steward"}</div>
                    <div className="dropdown-user-email">{user?.email || "steward@fridgepolice.org"}</div>
                    <span className="dropdown-user-badge">Communal Steward</span>
                  </div>
                </div>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setActiveNav("settings");
                    setUserMenuOpen(false);
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  <span>Settings &amp; Preferences</span>
                </button>

                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setActiveNav("fridges");
                    setUserMenuOpen(false);
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                  <span>My Managed Fridges</span>
                  {fridges.length > 0 && <span className="dropdown-pill-badge">{fridges.length}</span>}
                </button>

                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    toggleTheme();
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isDark ? "light_mode" : "dark_mode"}
                  </span>
                  <span>{isDark ? "Switch to Light Mode" : "Dark Botanical Mode"}</span>
                </button>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  className="dropdown-item dropdown-item-danger"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout?.();
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
