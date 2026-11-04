import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

export default function MyRequests({ _user, onNotify, onNavigateToFridge }) {
  const [activeTab, setActiveTab] = useState("incoming"); // 'incoming' | 'outgoing' | 'history'
  const [incomingFoodRequests, setIncomingFoodRequests] = useState([]);
  const [outgoingFoodRequests, setOutgoingFoodRequests] = useState([]);
  const [outgoingJoinRequests, setOutgoingJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchAllRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, userReqData] = await Promise.all([
        apiRequest("/users/me/dashboard").catch(() => null),
        apiRequest("/users/me/requests").catch(() => null),
      ]);

      if (dashData?.pendingFoodRequestsToReview) {
        setIncomingFoodRequests(dashData.pendingFoodRequestsToReview);
      }
      if (userReqData?.foodRequests) {
        setOutgoingFoodRequests(userReqData.foodRequests);
      }
      if (userReqData?.joinRequests) {
        setOutgoingJoinRequests(userReqData.joinRequests);
      }
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

  // Approve incoming claim
  const handleApproveIncoming = async (fridgeId, requestId, itemName) => {
    try {
      setActionLoading(`inc-${requestId}`);
      await apiRequest(`/fridges/${fridgeId}/requests/${requestId}/approve`, {
        method: "PATCH",
      });
      onNotify?.(`Approved claim for ${itemName || "item"}. Reserved for 24h.`, "success");
      fetchAllRequests();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Decline incoming claim
  const handleDeclineIncoming = async (fridgeId, requestId) => {
    try {
      setActionLoading(`inc-${requestId}`);
      await apiRequest(`/fridges/${fridgeId}/requests/${requestId}/reject`, {
        method: "PATCH",
      });
      onNotify?.("Claim declined.", "info");
      fetchAllRequests();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel outgoing claim
  const handleCancelOutgoingFood = async (fridgeId, requestId) => {
    try {
      setActionLoading(`out-${requestId}`);
      await apiRequest(`/fridges/${fridgeId}/requests/${requestId}/cancel`, {
        method: "PATCH",
      });
      onNotify?.("Food portion reservation cancelled.", "info");
      fetchAllRequests();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Mark outgoing claim as completed (consumed / picked up)
  const handleCompleteOutgoingFood = async (fridgeId, requestId) => {
    try {
      setActionLoading(`out-${requestId}`);
      await apiRequest(`/fridges/${fridgeId}/requests/${requestId}/complete`, {
        method: "PATCH",
      });
      onNotify?.("Portion marked as picked up / consumed.", "success");
      fetchAllRequests();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel outgoing join request
  const handleCancelOutgoingJoin = async (requestId) => {
    try {
      setActionLoading(`join-${requestId}`);
      await apiRequest(`/users/me/join-requests/${requestId}/cancel`, {
        method: "PATCH",
      });
      onNotify?.("Membership application cancelled.", "info");
      fetchAllRequests();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Batch approve all pending incoming claims
  const handleBatchApproveAll = async () => {
    if (incomingFoodRequests.length === 0) return;
    try {
      await Promise.all(
        incomingFoodRequests.map((r) =>
          apiRequest(`/fridges/${r.fridgeId}/requests/${r.id}/approve`, {
            method: "PATCH",
          })
        )
      );
      onNotify?.("All pending incoming claims approved.", "success");
      fetchAllRequests();
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  };

  const activeOutgoing = outgoingFoodRequests.filter(
    (r) => r.status === "PENDING" || r.status === "APPROVED"
  );
  const completedHistory = outgoingFoodRequests.filter(
    (r) => r.status === "COMPLETED" || r.status === "REJECTED" || r.status === "CANCELLED"
  );

  return (
    <div className="stitch-page">
      {/* Header */}
      <div className="stitch-page-header">
        <div className="page-header-titles">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", color: "var(--outline)" }}>
              Hub Allocation Node
            </span>
            <span style={{ color: "var(--outline)" }}>•</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--secondary)", fontWeight: 600 }}>
              Auto-reserve active (24h)
            </span>
          </div>
          <h1 className="stitch-title">Food Requests</h1>
          <p className="stitch-subtitle">
            Manage incoming portion claims for your fridges and track your outgoing food reservations.
          </p>
        </div>

        {/* Quick Metrics Strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="metric-box" style={{ padding: "8px 14px", flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span className="material-symbols-outlined text-[20px] text-secondary">pending_actions</span>
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--outline)", fontFamily: "var(--font-mono)" }}>
                Incoming
              </div>
              <strong style={{ fontSize: 14 }}>{incomingFoodRequests.length} to review</strong>
            </div>
          </div>
          <div className="metric-box" style={{ padding: "8px 14px", flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span className="material-symbols-outlined text-[20px] text-primary">lock_clock</span>
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--outline)", fontFamily: "var(--font-mono)" }}>
                Outgoing
              </div>
              <strong style={{ fontSize: 14 }}>{activeOutgoing.length} reserved</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="stitch-tab-bar" role="tablist">
        <button
          type="button"
          className={`stitch-tab-btn ${activeTab === "incoming" ? "active" : ""}`}
          onClick={() => setActiveTab("incoming")}
        >
          <span className="material-symbols-outlined text-[16px]">inbox</span>
          <span>Incoming Requests (Awaiting Review)</span>
          <span className="tab-numeric-badge">{incomingFoodRequests.length}</span>
        </button>

        <button
          type="button"
          className={`stitch-tab-btn ${activeTab === "outgoing" ? "active" : ""}`}
          onClick={() => setActiveTab("outgoing")}
        >
          <span className="material-symbols-outlined text-[16px]">schedule_send</span>
          <span>Your Outgoing Claims (Active)</span>
          <span className="tab-numeric-badge">{activeOutgoing.length}</span>
        </button>

        <button
          type="button"
          className={`stitch-tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span>History & Completed</span>
          <span className="tab-numeric-badge">{completedHistory.length}</span>
        </button>
      </div>

      {/* TAB 1: INCOMING REQUESTS */}
      {activeTab === "incoming" && (
        <div className="requests-stack-container">
          {/* Operational Advisory Banner */}
          <div className="requests-advisory-banner">
            <div className="requests-advisory-left">
              <span className="material-symbols-outlined text-[20px] text-secondary">info</span>
              <span>
                You have <strong>{incomingFoodRequests.length} portion requests</strong> waiting for your approval. Claimed items are automatically reserved for 24 hours upon approval.
              </span>
            </div>
            {incomingFoodRequests.length > 0 && (
              <button
                type="button"
                className="stitch-text-link"
                onClick={handleBatchApproveAll}
              >
                <span className="material-symbols-outlined text-[16px]">done_all</span>
                <span>Batch Approve All</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="stitch-card" style={{ padding: 40, textAlign: "center" }}>
              <p>Loading incoming claims queue...</p>
            </div>
          ) : incomingFoodRequests.length === 0 ? (
            <div className="stitch-card" style={{ padding: 40, textAlign: "center", alignItems: "center" }}>
              <span className="material-symbols-outlined text-[32px] text-secondary">check_circle</span>
              <h3 className="stitch-card-title">All incoming portion claims reviewed!</h3>
              <p className="card-description">
                When housemates request items from your fridges, they will appear here for one-click approval.
              </p>
            </div>
          ) : (
            incomingFoodRequests.map((req) => (
              <div key={req.id} className="request-allocation-card">
                <div className="request-card-info-left">
                  <div className="food-avatar-wrap">
                    <span className="material-symbols-outlined text-[24px]">lunch_dining</span>
                  </div>
                  <div className="request-card-titles">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="mono-badge">
                        {req.item?.category || "Provisions"}
                      </span>
                      <span className="status-badge-chip status-expiring">
                        <span className="status-dot dot-amber" />
                        PENDING REVIEW
                      </span>
                    </div>
                    <div className="request-card-title-line">
                      {req.item?.name || "Provision Item"}
                    </div>
                    <div className="request-card-subline">
                      {onNavigateToFridge && req.fridge?.id ? (
                        <button
                          type="button"
                          className="text-button"
                          style={{ padding: 0, textDecoration: "underline", color: "var(--primary)" }}
                          onClick={() => onNavigateToFridge(req.fridge.id)}
                        >
                          {req.fridge.name}
                        </button>
                      ) : (
                        <span>{req.fridge?.name}</span>
                      )}
                      <span>•</span>
                      <strong>{req.quantity} portion(s) requested</strong>
                    </div>
                  </div>
                </div>

                <div className="request-requester-box">
                  <div className="requester-profile-row">
                    <span className="requester-name">
                      {req.user?.name || req.user?.email || "Neighbor"}
                    </span>
                    <span className="requester-role-chip">Requester</span>
                  </div>
                  {req.note ? (
                    <p className="requester-note">“{req.note}”</p>
                  ) : (
                    <p className="requester-note" style={{ color: "var(--outline)" }}>No note attached.</p>
                  )}
                </div>

                <div className="request-actions-row">
                  <button
                    type="button"
                    className="stitch-btn stitch-btn-secondary stitch-btn-small"
                    disabled={actionLoading === `inc-${req.id}`}
                    onClick={() => handleDeclineIncoming(req.fridgeId, req.id)}
                  >
                    Decline Claim
                  </button>
                  <button
                    type="button"
                    className="stitch-btn stitch-btn-primary stitch-btn-small"
                    disabled={actionLoading === `inc-${req.id}`}
                    onClick={() => handleApproveIncoming(req.fridgeId, req.id, req.item?.name)}
                  >
                    <span className="material-symbols-outlined text-[15px]">check</span>
                    <span>Approve & Reserve</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: OUTGOING CLAIMS */}
      {activeTab === "outgoing" && (
        <div className="requests-stack-container">
          {activeOutgoing.length === 0 ? (
            <div className="stitch-card" style={{ padding: 40, textAlign: "center", alignItems: "center" }}>
              <span className="material-symbols-outlined text-[32px] text-muted">shopping_bag</span>
              <h3 className="stitch-card-title">No active food reservations</h3>
              <p className="card-description">
                You have no outstanding portions claimed. Browse your fridges or public community pantries to reserve ingredients.
              </p>
            </div>
          ) : (
            activeOutgoing.map((claim) => (
              <div key={claim.id} className="request-allocation-card">
                <div className="request-card-info-left">
                  <div className="food-avatar-wrap">
                    <span className="material-symbols-outlined text-[24px]">kitchen</span>
                  </div>
                  <div className="request-card-titles">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {claim.status === "APPROVED" ? (
                        <span className="status-badge-chip status-fresh">
                          <span className="status-dot dot-green" />
                          APPROVED — RESERVED FOR PICKUP
                        </span>
                      ) : (
                        <span className="status-badge-chip status-expiring">
                          <span className="status-dot dot-amber" />
                          AWAITING HOST APPROVAL
                        </span>
                      )}
                    </div>
                    <div className="request-card-title-line">
                      {claim.foodItem?.name || "Claimed Provision"} ({claim.requestedQuantity} portions)
                    </div>
                    <div className="request-card-subline">
                      <span>Pantry: </span>
                      {onNavigateToFridge && claim.fridgeId ? (
                        <button
                          type="button"
                          className="text-button"
                          style={{ padding: 0, textDecoration: "underline", color: "var(--primary)" }}
                          onClick={() => onNavigateToFridge(claim.fridgeId)}
                        >
                          {claim.fridge?.name || "View Pantry"}
                        </button>
                      ) : (
                        <span>{claim.fridge?.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="request-actions-row">
                  <button
                    type="button"
                    className="stitch-btn stitch-btn-secondary stitch-btn-small"
                    disabled={actionLoading === `out-${claim.id}`}
                    onClick={() => handleCancelOutgoingFood(claim.fridgeId, claim.id)}
                  >
                    Cancel Claim
                  </button>
                  {claim.status === "APPROVED" && (
                    <button
                      type="button"
                      className="stitch-btn stitch-btn-primary stitch-btn-small"
                      disabled={actionLoading === `out-${claim.id}`}
                      onClick={() => handleCompleteOutgoingFood(claim.fridgeId, claim.id)}
                    >
                      <span className="material-symbols-outlined text-[15px]">shopping_bag</span>
                      <span>Mark as Consumed</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Outgoing Membership Applications */}
          {outgoingJoinRequests.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 className="stitch-card-title" style={{ fontSize: 15, marginBottom: 12 }}>
                Outgoing Membership Applications ({outgoingJoinRequests.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {outgoingJoinRequests.map((jr) => (
                  <div key={jr.id} className="request-allocation-card">
                    <div>
                      <strong>Application for {jr.fridge?.name}</strong>
                      <div style={{ fontSize: 12, color: "var(--outline)" }}>
                        Status: <span className="mono-badge">{jr.status}</span>
                      </div>
                    </div>
                    {jr.status === "PENDING" && (
                      <button
                        type="button"
                        className="stitch-btn stitch-btn-secondary stitch-btn-small"
                        onClick={() => handleCancelOutgoingJoin(jr.id)}
                      >
                        Withdraw Application
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HISTORY & COMPLETED */}
      {activeTab === "history" && (
        <div className="stitch-card">
          <div className="stitch-card-header">
            <h3 className="stitch-card-title">Recent Request Audit Trail</h3>
            <span className="card-header-mono">Completed & Expired</span>
          </div>

          {completedHistory.length === 0 ? (
            <div className="empty-sub-card">
              <p>No completed or expired claims recorded in your history.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {completedHistory.map((item) => (
                <div key={item.id} className="ledger-entry" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="material-symbols-outlined text-[18px] text-secondary">
                      {item.status === "COMPLETED" ? "check_circle" : "cancel"}
                    </span>
                    <div>
                      <strong>{item.foodItem?.name || "Provision Item"}</strong>
                      <div className="table-sub-text">
                        {item.requestedQuantity} portion(s) on {item.fridge?.name}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`status-badge-chip ${
                      item.status === "COMPLETED" ? "status-fresh" : "status-expired"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
