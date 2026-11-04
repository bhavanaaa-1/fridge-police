import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

const ACTION_LABELS = {
  FRIDGE_CREATED: "Fridge Established",
  SETTINGS_UPDATED: "Settings & Policies Updated",
  MEMBER_ADDED: "New Member Added",
  JOIN_REQUEST_SUBMITTED: "Membership Inquired",
  JOIN_REQUEST_APPROVED: "Membership Approved",
  JOIN_REQUEST_REJECTED: "Membership Declined",
  FOOD_ADDED: "Provisions Stocked",
  FOOD_UPDATED: "Item Quantity Modified",
  FOOD_DELETED: "Item Removed from Inventory",
  REQUEST_CREATED: "Portion Requested",
  REQUEST_APPROVED: "Portion Approved",
  REQUEST_REJECTED: "Portion Declined",
  REQUEST_COMPLETED: "Portion Consumed",
  REQUEST_CANCELLED: "Portion Cancelled",
};

export default function ActivityFeed({ _user, fridges = [], onNotify }) {
  const [selectedFridgeId, setSelectedFridgeId] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedFridgeId) {
        const data = await apiRequest(`/fridges/${selectedFridgeId}/activity?limit=50`);
        setLogs(data.logs || []);
      } else {
        const data = await apiRequest("/users/me/dashboard");
        setLogs(data.recentActivity || []);
      }
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [selectedFridgeId, onNotify]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="stitch-page">
      {/* Header */}
      <div className="stitch-page-header">
        <div className="page-header-titles">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", color: "var(--outline)" }}>
              Audit Ledger
            </span>
            <span style={{ color: "var(--outline)" }}>•</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--secondary)", fontWeight: 600 }}>
              Immutable Record
            </span>
          </div>
          <h1 className="stitch-title">Activity History</h1>
          <p className="stitch-subtitle">
            Chronological record of stock additions, reservations, member approvals, and policy changes across your fridges.
          </p>
        </div>

        {fridges.length > 0 && (
          <div className="page-header-actions">
            <select
              className="toolbar-select"
              value={selectedFridgeId}
              onChange={(e) => setSelectedFridgeId(e.target.value)}
              aria-label="Filter activity by fridge"
            >
              <option value="">All My Fridges</option>
              {fridges.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Ledger Card */}
      <div className="stitch-card">
        <div className="stitch-card-header">
          <div className="card-title-group">
            <span className="material-symbols-outlined text-[20px] text-primary">history</span>
            <h2 className="stitch-card-title">Event Stream</h2>
          </div>
          <span className="card-header-mono">{logs.length} entries</span>
        </div>

        {loading ? (
          <div className="empty-sub-card">Loading activity ledger...</div>
        ) : logs.length === 0 ? (
          <div className="empty-sub-card">
            <span className="material-symbols-outlined text-[32px] text-muted">history</span>
            <p>
              {selectedFridgeId
                ? "No events recorded in this fridge yet."
                : "Events will appear as housemates stock food, claim portions, and manage members."}
            </p>
          </div>
        ) : (
          <div className="live-ledger-feed">
            {logs.map((entry) => {
              const readableAction = ACTION_LABELS[entry.action] || entry.action.replace(/_/g, " ");
              const fridgeName =
                fridges.find((f) => f.id === entry.fridgeId)?.name ||
                entry.fridge?.name ||
                "Shared Larder";

              return (
                <div key={entry.id} className="ledger-entry">
                  <div className="ledger-icon-wrap">
                    <span className="material-symbols-outlined text-[16px]">
                      {entry.action.includes("FOOD")
                        ? "inventory_2"
                        : entry.action.includes("MEMBER") || entry.action.includes("JOIN")
                        ? "person_add"
                        : "history"}
                    </span>
                  </div>
                  <div className="ledger-content">
                    <div className="ledger-top-row">
                      <span className="ledger-title">{readableAction}</span>
                      <span className="ledger-time">
                        {new Date(entry.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="ledger-details">
                      <strong>{entry.user?.name || "System"}</strong> on {fridgeName}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
