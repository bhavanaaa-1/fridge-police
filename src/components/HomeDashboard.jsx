import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

export default function HomeDashboard({
  user,
  fridges = [],
  onSelectFridge,
  onOpenCreateFridge,
  setActiveNav,
  onNotify,
}) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/users/me/dashboard");
      setDashboard(data);
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleApproveFoodRequest = async (fridgeId, requestId) => {
    try {
      setActionLoading(`food-${requestId}`);
      await apiRequest(`/fridges/${fridgeId}/requests/${requestId}/approve`, {
        method: "PATCH",
      });
      onNotify?.("Portion claim approved and reserved.", "success");
      fetchDashboard();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectFoodRequest = async (fridgeId, requestId) => {
    try {
      setActionLoading(`food-${requestId}`);
      await apiRequest(`/fridges/${fridgeId}/requests/${requestId}/reject`, {
        method: "PATCH",
      });
      onNotify?.("Portion claim declined.", "info");
      fetchDashboard();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingFoodToReview = dashboard?.pendingFoodRequestsToReview || [];
  const pendingJoinToReview = dashboard?.pendingJoinRequestsToReview || [];
  const recentLogs = dashboard?.recentActivity || [];

  // Calculate high-level metrics
  const totalItems = fridges.reduce((acc, f) => acc + (f.itemCount || 0), 0);
  const totalPendingClaims = pendingFoodToReview.length + pendingJoinToReview.length;

  return (
    <div className="stitch-page">
      {/* Page Header */}
      <div className="stitch-page-header">
        <div className="page-header-titles">
          <div className="page-title-row">
            <h1 className="stitch-title">Dashboard</h1>
            <span className="sync-badge">Real-time sync</span>
          </div>
          <p className="stitch-subtitle">
            Welcome back, {user?.name || "Neighbor"}. Overview of kitchen inventory, member portion claims, and communal storage across your households.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="stitch-btn stitch-btn-secondary"
            onClick={() => setActiveNav("discover")}
          >
            <span className="material-symbols-outlined text-[16px]">explore</span>
            <span>Discover Pantries</span>
          </button>
          <button
            type="button"
            className="stitch-btn stitch-btn-primary"
            onClick={onOpenCreateFridge}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Create Fridge</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="stitch-metrics-grid">
        {/* Metric 1 */}
        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Active Fridges</span>
            <div className="metric-icon-wrap">
              <span className="material-symbols-outlined text-[18px]">kitchen</span>
            </div>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">{fridges.length}</span>
            <div className="metric-sub-status text-secondary">
              <span className="status-dot dot-green" />
              <span>All in sync</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Total Provisions</span>
            <div className="metric-icon-wrap">
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            </div>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">{totalItems}</span>
            <span className="metric-chip">Across {fridges.length || 1} units</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Pending Claims</span>
            <div className="metric-icon-wrap">
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            </div>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">{totalPendingClaims}</span>
            <span className="metric-sub-status text-secondary">
              {totalPendingClaims > 0 ? "Awaiting review" : "Queue clear"}
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Expiring Horizon</span>
            <div className="metric-icon-wrap">
              <span className="material-symbols-outlined text-[18px]">schedule</span>
            </div>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">
              {dashboard?.expiringCount !== undefined ? dashboard.expiringCount : 0}
            </span>
            <div className="metric-sub-status text-muted">
              <span className="status-dot dot-amber" />
              <span>FIFO tracking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Asymmetric Workspace Layout (7fr / 5fr) */}
      <div className="stitch-workspace-split">
        {/* Left Column (7 cols) */}
        <div className="workspace-left-col">
          {/* Section: Your Fridges */}
          <div className="stitch-card">
            <div className="stitch-card-header">
              <div className="card-title-group">
                <span className="material-symbols-outlined text-[20px] text-primary">shelves</span>
                <h2 className="stitch-card-title">Your Fridges</h2>
              </div>
              <button
                type="button"
                className="stitch-text-link"
                onClick={() => setActiveNav("fridges")}
              >
                <span>View All Fridges</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>

            {fridges.length === 0 ? (
              <div className="empty-sub-card">
                <span className="material-symbols-outlined text-[28px] text-muted">kitchen</span>
                <p>No storage units joined yet. Create your first shared household larder.</p>
                <button
                  type="button"
                  className="stitch-btn stitch-btn-secondary"
                  onClick={onOpenCreateFridge}
                >
                  Create Fridge
                </button>
              </div>
            ) : (
              <div className="mini-fridges-grid">
                {fridges.slice(0, 3).map((f) => (
                  <div
                    key={f.id}
                    className="mini-fridge-item"
                    onClick={() => onSelectFridge(f.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div>
                      <div className="mini-fridge-top">
                        <span className="mini-fridge-name">{f.name}</span>
                        <span className="mini-role-pill">{f.role || "MEMBER"}</span>
                      </div>
                      <div className="mini-fridge-meta">
                        {f.itemCount ?? 0} items · {f.memberCount ?? 1} members
                      </div>
                      <div className="mini-fridge-privacy">
                        {f.isDiscoverable ? "Public Discoverable" : "Private household"}
                      </div>
                    </div>
                    <div className="mini-fridge-status">
                      <span className="status-chip-subtle">
                        <span className="status-dot dot-green" />
                        Active sync
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Expiring Alerts / Quick Inventory Access */}
          <div className="stitch-card">
            <div className="stitch-card-header">
              <div className="card-title-group">
                <span className="material-symbols-outlined text-[20px] text-danger">notification_important</span>
                <h2 className="stitch-card-title">Storage & FIFO Alerts</h2>
              </div>
              <span className="card-header-mono">Batch FIFO active</span>
            </div>

            {fridges.length === 0 ? (
              <div className="empty-sub-card">
                <p>Add a fridge to track shelf batches and expiration dates.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Pantry / Fridge</th>
                      <th>Items Stored</th>
                      <th>Discovery</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fridges.slice(0, 4).map((f) => (
                      <tr key={f.id}>
                        <td>
                          <div className="table-item-cell">
                            <strong>{f.name}</strong>
                            <span className="table-sub-text">{f.description || "Active household pantry"}</span>
                          </div>
                        </td>
                        <td>
                          <span className="mono-badge">{f.itemCount ?? 0} items</span>
                        </td>
                        <td>
                          <span className={`status-pill ${f.isDiscoverable ? "pill-public" : "pill-private"}`}>
                            {f.isDiscoverable ? "Discoverable" : "Private"}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => onSelectFridge(f.id)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols) */}
        <div className="workspace-right-col">
          {/* Section: Awaiting Your Decision */}
          <div className="stitch-card">
            <div className="stitch-card-header">
              <div className="card-title-group">
                <span className="material-symbols-outlined text-[20px] text-primary">assignment_turned_in</span>
                <h2 className="stitch-card-title">Awaiting Your Decision</h2>
              </div>
              {totalPendingClaims > 0 && (
                <span className="urgent-badge">{totalPendingClaims} pending</span>
              )}
            </div>
            <p className="card-description">
              Household members requesting portions or membership from your fridges.
            </p>

            {loading ? (
              <div className="empty-sub-card">Loading pending decisions...</div>
            ) : totalPendingClaims === 0 ? (
              <div className="empty-sub-card">
                <span className="material-symbols-outlined text-[24px] text-secondary">check_circle</span>
                <p>All portion claims and membership requests are reviewed!</p>
              </div>
            ) : (
              <div className="claims-queue-list">
                {pendingFoodToReview.map((req) => (
                  <div key={req.id} className="claim-queue-card">
                    <div className="claim-queue-top">
                      <div className="claim-user-profile">
                        <div className="user-avatar-round">
                          {req.user?.name ? req.user.name.slice(0, 2).toUpperCase() : "MB"}
                        </div>
                        <div className="claim-user-meta">
                          <span className="claim-user-name">{req.user?.name || req.user?.email}</span>
                          <span className="claim-fridge-name">{req.fridge?.name}</span>
                        </div>
                      </div>
                      <span className="claim-timestamp">Portion Claim</span>
                    </div>

                    <div className="claim-body-detail">
                      Requested <strong className="text-primary">{req.quantity} portion(s)</strong> of{" "}
                      <span className="claimed-item-name">{req.item?.name}</span>
                      {req.note && <div className="claim-note">"{req.note}"</div>}
                    </div>

                    <div className="claim-actions-row">
                      <button
                        type="button"
                        className="claim-btn-approve"
                        disabled={actionLoading === `food-${req.id}`}
                        onClick={() => handleApproveFoodRequest(req.fridgeId, req.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="claim-btn-decline"
                        disabled={actionLoading === `food-${req.id}`}
                        onClick={() => handleRejectFoodRequest(req.fridgeId, req.id)}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Recent Ledger Activity */}
          <div className="stitch-card">
            <div className="stitch-card-header">
              <div className="card-title-group">
                <span className="material-symbols-outlined text-[20px] text-primary">history</span>
                <h2 className="stitch-card-title">Recent Ledger Activity</h2>
              </div>
              <span className="card-header-mono">Live feed</span>
            </div>

            {recentLogs.length === 0 ? (
              <div className="empty-sub-card">
                <p>No activity logged yet across your units.</p>
              </div>
            ) : (
              <div className="live-ledger-feed">
                {recentLogs.slice(0, 4).map((log) => (
                  <div key={log.id} className="ledger-entry">
                    <div className="ledger-icon-wrap">
                      <span className="material-symbols-outlined text-[16px]">
                        {log.action.includes("FOOD") ? "inventory_2" : log.action.includes("MEMBER") ? "person_add" : "check_circle"}
                      </span>
                    </div>
                    <div className="ledger-content">
                      <div className="ledger-top-row">
                        <span className="ledger-title">{log.action.replace(/_/g, " ")}</span>
                        <span className="ledger-time">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="ledger-details">
                        {log.user?.name || "System"} on {log.fridge?.name || "Larder"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="card-bottom-link-wrap">
              <button
                type="button"
                className="stitch-block-link"
                onClick={() => setActiveNav("activity")}
              >
                View full historical log
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
