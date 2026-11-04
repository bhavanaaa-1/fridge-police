import { useState } from "react";
import { apiRequest } from "../lib/api";

export default function CreateFridgeModal({ isOpen, onClose, onCreated, onNotify }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [publicFoodPreview, setPublicFoodPreview] = useState(false);
  const [acceptJoinRequests, setAcceptJoinRequests] = useState(true);
  const [showMemberCount, setShowMemberCount] = useState(true);
  const [publicDescription, setPublicDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Fridge name is required.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        isDiscoverable,
        publicFoodPreview,
        acceptJoinRequests,
        showMemberCount,
        publicDescription: publicDescription.trim() || undefined,
      };

      const data = await apiRequest("/fridges", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotify?.("Fridge unit established successfully.", "success");
      onCreated?.(data.fridge);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create fridge.");
      onNotify?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined text-[20px] text-primary">kitchen</span>
            <h2 id="modal-title">Provision New Storage Unit</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close modal">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="auth-alert" role="alert" style={{ margin: "16px 20px 0" }}>
            <span className="auth-alert-icon">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-field-label">
            <span className="label-text">Fridge Unit Name *</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. 4B Communal Pantry, North Wing Larder"
              autoFocus
            />
          </label>

          <label className="form-field-label">
            <span className="label-text">Internal Description (Members Only)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Kitchen shelf protocol, shelf labels, shelf cleaning schedule"
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="form-field-label">
              <span className="label-text">Visibility Policy</span>
              <select
                className="toolbar-select"
                style={{ height: 38 }}
                value={isDiscoverable ? "public" : "private"}
                onChange={(e) => {
                  const isPub = e.target.value === "public";
                  setIsDiscoverable(isPub);
                  if (isPub) setPublicFoodPreview(true);
                }}
              >
                <option value="private">Private (Invite Only)</option>
                <option value="public">Public Discoverable</option>
              </select>
            </label>

            <label className="form-field-label">
              <span className="label-text">Join Policy</span>
              <select
                className="toolbar-select"
                style={{ height: 38 }}
                value={acceptJoinRequests ? "accept" : "closed"}
                onChange={(e) => setAcceptJoinRequests(e.target.value === "accept")}
              >
                <option value="accept">Accept Applications</option>
                <option value="closed">Closed / Invite Only</option>
              </select>
            </label>
          </div>

          {isDiscoverable && (
            <>
              <label className="form-field-label">
                <span className="label-text">Public Welcome Note (Community View)</span>
                <input
                  type="text"
                  value={publicDescription}
                  onChange={(e) => setPublicDescription(e.target.value)}
                  placeholder="e.g. Open communal fridge stocked by neighborhood bakers & gardeners."
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--on-surface-variant)" }}>
                <input
                  type="checkbox"
                  checked={showMemberCount}
                  onChange={(e) => setShowMemberCount(e.target.checked)}
                />
                <span>Display active member count on discovery card</span>
              </label>
            </>
          )}

          <div className="pantry-quote-box" style={{ display: "flex", alignItems: "flex-start", gap: 8, fontStyle: "normal" }}>
            <span className="material-symbols-outlined text-[18px] text-secondary">verified_user</span>
            <span>
              Creating this unit grants your account instant administrative stewardship and activates automated portion reservation workflows.
            </span>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="stitch-btn stitch-btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="stitch-btn stitch-btn-primary"
              disabled={loading}
            >
              {loading ? "Establishing..." : "Create Fridge Unit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
