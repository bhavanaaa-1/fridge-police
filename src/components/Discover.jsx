import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

const CATEGORIES = [
  "All Provisions",
  "Fresh Produce",
  "Bakery",
  "Dairy & Eggs",
  "Pantry Staples",
  "Prepared Meals",
  "Vegan / GF Only",
];

// Curated stock photos for community fridges
const PANTRY_PHOTOS = [
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80",
];

export default function Discover({ _user, onNotify, onNavigateToFridge }) {
  const [fridges, setFridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Provisions");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });

  // Detail Modal state
  const [activeFridgeDetail, setActiveFridgeDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [joinNote, setJoinNote] = useState("");
  const [submittingJoin, setSubmittingJoin] = useState(false);

  const fetchPublicFridges = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedCategory && selectedCategory !== "All Provisions") {
        params.set("category", selectedCategory.replace(" Only", ""));
      }
      params.set("page", String(page));
      params.set("limit", "12");

      const data = await apiRequest(`/discover/fridges?${params.toString()}`);
      setFridges(data.fridges || []);
      setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, page, onNotify]);

  useEffect(() => {
    fetchPublicFridges();
  }, [fetchPublicFridges]);

  const openFridgeDetail = async (fridgeId) => {
    setDetailLoading(true);
    try {
      const data = await apiRequest(`/discover/fridges/${fridgeId}`);
      setActiveFridgeDetail(data.fridge);
      setJoinNote("");
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmitJoinRequest = async (e) => {
    e.preventDefault();
    if (!activeFridgeDetail) return;
    setSubmittingJoin(true);
    try {
      await apiRequest(`/fridges/${activeFridgeDetail.id}/join-requests`, {
        method: "POST",
        body: JSON.stringify({
          note: joinNote.trim() || undefined,
        }),
      });
      onNotify?.("Membership request submitted to fridge stewards.", "success");
      openFridgeDetail(activeFridgeDetail.id);
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handleCancelJoinRequest = async (requestId) => {
    try {
      await apiRequest(`/users/me/join-requests/${requestId}/cancel`, {
        method: "PATCH",
      });
      onNotify?.("Membership application withdrawn.", "info");
      if (activeFridgeDetail) {
        openFridgeDetail(activeFridgeDetail.id);
      }
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  };

  return (
    <div className="stitch-page">
      {/* Page Header */}
      <div className="stitch-page-header">
        <div className="page-header-titles">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span className="discover-hero-pill">
              <span className="status-dot dot-green" />
              CIVIC AID PROTOCOL
            </span>
            <span style={{ color: "var(--outline)" }}>•</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--outline)" }}>
              OPEN COMMUNITY NETWORK
            </span>
          </div>
          <h1 className="stitch-title">Discover Community Fridges</h1>
          <p className="stitch-subtitle">
            Explore publicly shared pantries in your neighborhood. Preview available surplus provisions and submit membership applications.
          </p>
        </div>
      </div>

      {/* Search & Filter Section */}
      <div className="discover-controls-container">
        <div className="discover-search-row">
          <div className="discover-search-field">
            <span className="material-symbols-outlined text-[18px] search-glyph">search</span>
            <input
              type="text"
              placeholder="Search by pantry name, food provision (e.g. sourdough, produce), or district..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="stitch-btn stitch-btn-secondary"
              onClick={() => {
                setSearch("");
                setSelectedCategory("All Provisions");
              }}
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="category-filter-chips" role="tablist">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`category-chip-btn ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => {
                setSelectedCategory(cat);
                setPage(1);
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Network Stats Overview Bar */}
      <div className="stitch-metrics-grid">
        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Available In Area</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">inventory</span>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">
              {fridges.reduce((acc, f) => acc + (f.availableItemCount || 0), 0) || 48}
            </span>
            <span className="metric-sub-status text-secondary">Safe Portions</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Active Fridges</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">shelves</span>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">{pagination.total || fridges.length}</span>
            <span className="metric-chip">Nearby pantries</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Restock Schedule</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">schedule</span>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number" style={{ fontSize: 20 }}>~4:30 PM</span>
            <span className="metric-sub-status text-secondary">Peak dropoff</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Solidarity Network</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">volunteer_activism</span>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">100%</span>
            <span className="metric-chip">Free access</span>
          </div>
        </div>
      </div>

      {/* 3-Column Public Community Fridges Grid */}
      {loading ? (
        <div className="stitch-card" style={{ padding: 40, textAlign: "center" }}>
          <p>Scanning community network for discoverable pantries...</p>
        </div>
      ) : fridges.length === 0 ? (
        <div className="stitch-card" style={{ padding: 40, textAlign: "center", alignItems: "center" }}>
          <span className="material-symbols-outlined text-[36px] text-muted">explore_off</span>
          <h3 className="stitch-card-title">No public pantries found</h3>
          <p className="card-description">
            {search || selectedCategory !== "All Provisions"
              ? "No discoverable fridges match your filter criteria."
              : "No community fridges are discoverable at this time."}
          </p>
          {(search || selectedCategory !== "All Provisions") && (
            <button
              type="button"
              className="stitch-btn stitch-btn-secondary"
              style={{ marginTop: 8 }}
              onClick={() => {
                setSearch("");
                setSelectedCategory("All Provisions");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="discover-grid-3col">
          {fridges.map((f, idx) => {
            const photoUrl = PANTRY_PHOTOS[idx % PANTRY_PHOTOS.length];
            const publicItems = f.publicFoodItems || [];

            return (
              <article key={f.id} className="public-pantry-card">
                <div>
                  {/* Hero Visual */}
                  <div className="pantry-card-visual">
                    <img src={photoUrl} alt={f.name} />
                    <div className="pantry-visual-overlay" />
                    <div className="pantry-visual-top">
                      <span className="status-pill pill-public">
                        <span className="status-dot dot-green" />
                        {f.acceptJoinRequests ? "Accepting Members" : "Invite Only"}
                      </span>
                      {f.showMemberCount && f.memberCount !== null && (
                        <span className="mono-badge">
                          {f.memberCount} active
                        </span>
                      )}
                    </div>
                    <div className="pantry-visual-bottom">
                      <span className="pantry-distance-scope">Community Larder</span>
                      <h2 className="pantry-card-name">{f.name}</h2>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="pantry-card-body">
                    {/* Welcome Quote */}
                    <div className="pantry-quote-box">
                      “{f.publicDescription || f.description || "Shared community larder stocked with neighbor provisions."}”
                    </div>

                    {/* Provisions Preview */}
                    {f.publicFoodPreview && publicItems.length > 0 ? (
                      <div className="public-provisions-stack">
                        <div className="provisions-stack-header">
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span className="material-symbols-outlined text-[13px] text-secondary">eco</span>
                            Public Surplus Preview
                          </span>
                          <span>Verified active</span>
                        </div>
                        {publicItems.slice(0, 3).map((item, i) => (
                          <div key={i} className="provision-strip">
                            <span className="provision-name-group">
                              <span className="material-symbols-outlined text-[15px] text-secondary">lunch_dining</span>
                              <span>{item.name}</span>
                            </span>
                            <span className="provision-qty-chip">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                        {f.availableItemCount > 3 && (
                          <span style={{ fontSize: 11, color: "var(--secondary)", fontWeight: 600, textAlign: "center", display: "block" }}>
                            +{f.availableItemCount - 3} more provisions available
                          </span>
                        )}
                      </div>
                    ) : f.publicFoodPreview ? (
                      <div className="shield-private-box">
                        <span className="shield-private-title">Pantry currently restocking</span>
                        <span className="shield-private-sub">New provisions arrive daily</span>
                      </div>
                    ) : (
                      <div className="shield-private-box">
                        <span className="material-symbols-outlined text-[20px] text-outline">shield</span>
                        <span className="shield-private-title">Provisions kept private to members</span>
                        <span className="shield-private-sub">Join cohort to view active batches</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pantry-card-footer">
                  <button
                    type="button"
                    className="stitch-btn stitch-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => openFridgeDetail(f.id)}
                  >
                    <span>Public Details</span>
                  </button>
                  {f.acceptJoinRequests && (
                    <button
                      type="button"
                      className="stitch-btn stitch-btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => openFridgeDetail(f.id)}
                    >
                      <span className="material-symbols-outlined text-[16px]">person_add</span>
                      <span>Request to Join</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Bottom Privacy Assurance Banner */}
      <footer className="privacy-assurance-footer">
        <div className="privacy-assurance-left">
          <div className="privacy-icon-box">
            <span className="material-symbols-outlined text-[22px]">verified_user</span>
          </div>
          <div className="privacy-content-text">
            <div className="privacy-title-line">
              <span className="privacy-heading">FridgePolice Privacy Standard</span>
              <span className="privacy-audited-tag">CIVIC AUDITED</span>
            </div>
            <p className="privacy-desc">
              Public fridges only expose items explicitly marked for discovery by their organizers. Private contact details, member emails, and internal activity logs are never exposed.
            </p>
          </div>
        </div>
      </footer>

      {/* Public Fridge Detail & Join Modal */}
      {(activeFridgeDetail || detailLoading) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!detailLoading) setActiveFridgeDetail(null);
          }}
          role="dialog"
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
            {detailLoading ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--on-surface-variant)" }}>
                <span className="material-symbols-outlined text-[32px] rotating">progress_activity</span>
                <p style={{ marginTop: 12, fontSize: 14 }}>Retrieving community pantry details...</p>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <div>
                    <h2>{activeFridgeDetail.name}</h2>
                    <span className="modal-subtitle">
                      {activeFridgeDetail.isMember
                        ? "You are an active member of this pantry"
                        : activeFridgeDetail.hasPendingJoinRequest
                        ? "Membership application pending steward review"
                        : "Community Food Sharing Hub"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setActiveFridgeDetail(null)}
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  {activeFridgeDetail.publicDescription && (
                    <div className="pantry-quote-box">
                      “{activeFridgeDetail.publicDescription}”
                    </div>
                  )}

                  {/* Public food items */}
                  {activeFridgeDetail.publicFoodPreview && (
                    <div>
                      <h4 className="stitch-card-title" style={{ fontSize: 13, marginBottom: 8 }}>
                        Current Surplus Provisions ({activeFridgeDetail.publicFoodItems?.length || 0})
                      </h4>
                      {activeFridgeDetail.publicFoodItems?.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {activeFridgeDetail.publicFoodItems.map((item, idx) => (
                            <div key={idx} className="provision-strip">
                              <span className="provision-name-group">
                                <span className="material-symbols-outlined text-[15px] text-secondary">lunch_dining</span>
                                <strong>{item.name}</strong>
                              </span>
                              <span className="provision-qty-chip">
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: "var(--outline)" }}>No provisions currently on shelf.</p>
                      )}
                    </div>
                  )}

                  {/* Member or Join status */}
                  {activeFridgeDetail.isMember ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="status-pill pill-public">Already a Member</span>
                      <button
                        type="button"
                        className="stitch-btn stitch-btn-primary"
                        onClick={() => {
                          setActiveFridgeDetail(null);
                          onNavigateToFridge(activeFridgeDetail.id);
                        }}
                      >
                        Open Fridge Workspace
                      </button>
                    </div>
                  ) : activeFridgeDetail.hasPendingJoinRequest ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="status-pill pill-private">Application Under Review</span>
                      {activeFridgeDetail.userJoinRequestId && (
                        <button
                          type="button"
                          className="stitch-btn stitch-btn-secondary"
                          onClick={() => handleCancelJoinRequest(activeFridgeDetail.userJoinRequestId)}
                        >
                          Withdraw Application
                        </button>
                      )}
                    </div>
                  ) : activeFridgeDetail.acceptJoinRequests ? (
                    <form onSubmit={handleSubmitJoinRequest} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <label className="form-field-label">
                        <span className="label-text">Note for Fridge Stewards (Optional)</span>
                        <input
                          placeholder="e.g. Neighbor from 3rd floor, love to cook and share garden herbs"
                          value={joinNote}
                          onChange={(e) => setJoinNote(e.target.value)}
                        />
                      </label>
                      <button
                        type="submit"
                        className="stitch-btn stitch-btn-primary"
                        disabled={submittingJoin}
                      >
                        {submittingJoin ? "Submitting..." : "Submit Membership Application"}
                      </button>
                    </form>
                  ) : (
                    <div className="shield-private-box">
                      <span className="shield-private-title">This pantry is invite-only</span>
                      <span className="shield-private-sub">Contact the household steward directly to request an invite.</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
