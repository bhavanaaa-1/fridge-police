import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

export default function MyFridges({
  user,
  fridges = [],
  activeFridgeId,
  onSelectFridge,
  onOpenCreateFridge,
  onRefreshFridges,
  onNotify,
}) {
  const [currentFridge, setCurrentFridge] = useState(null);
  const [activeTab, setActiveTab] = useState("inventory"); // inventory | requests | members | activity | settings

  // Inventory state
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [inventoryViewMode, setInventoryViewMode] = useState("table"); // 'table' | 'grid'
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Add Item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [foodName, setFoodName] = useState("");
  const [foodCategory, setFoodCategory] = useState("");
  const [foodQuantity, setFoodQuantity] = useState("1");
  const [foodUnit, setFoodUnit] = useState("units");
  const [foodNotes, setFoodNotes] = useState("");
  const [itemSubmitting, setItemSubmitting] = useState(false);

  // Portion Request modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestItem, setRequestItem] = useState(null);
  const [requestQuantity, setRequestQuantity] = useState("1");
  const [requestNote, setRequestNote] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  // Requests tab state
  const [requests, setRequests] = useState([]);
  const [_requestsLoading, setRequestsLoading] = useState(false);

  // Members tab state
  const [members, setMembers] = useState([]);
  const [_membersLoading, setMembersLoading] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("MEMBER");
  const [addingMember, setAddingMember] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [_joinRequestsLoading, setJoinRequestsLoading] = useState(false);

  // Activity tab state
  const [activity, setActivity] = useState([]);
  const [_activityLoading, setActivityLoading] = useState(false);

  // Settings tab state
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
    isDiscoverable: false,
    publicFoodPreview: false,
    acceptJoinRequests: false,
    showMemberCount: false,
    publicDescription: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [catalogSearch, setCatalogSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const isPrivileged = currentFridge?.role === "OWNER" || currentFridge?.role === "ADMIN";

  // Fetch full single fridge details
  const fetchFridgeDetails = useCallback(async (id) => {
    if (!id) {
      setCurrentFridge(null);
      return;
    }
    try {
      const data = await apiRequest(`/fridges/${id}`);
      setCurrentFridge(data.fridge);
      setSettingsForm({
        name: data.fridge.name || "",
        description: data.fridge.description || "",
        isDiscoverable: Boolean(data.fridge.isDiscoverable),
        publicFoodPreview: Boolean(data.fridge.publicFoodPreview),
        acceptJoinRequests: Boolean(data.fridge.acceptJoinRequests),
        showMemberCount: Boolean(data.fridge.showMemberCount),
        publicDescription: data.fridge.publicDescription || "",
      });
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  }, [onNotify]);

  // Fetch fridge inventory
  const fetchInventory = useCallback(async () => {
    if (!activeFridgeId) return;
    setItemsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("page", String(page));
      params.set("limit", "25");
      const data = await apiRequest(`/fridges/${activeFridgeId}/items?${params.toString()}`);
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setItemsLoading(false);
    }
  }, [activeFridgeId, search, categoryFilter, page, onNotify]);

  // Fetch food requests
  const fetchRequests = useCallback(async () => {
    if (!activeFridgeId) return;
    setRequestsLoading(true);
    try {
      const data = await apiRequest(`/fridges/${activeFridgeId}/requests`);
      setRequests(data.requests || []);
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setRequestsLoading(false);
    }
  }, [activeFridgeId, onNotify]);

  // Fetch members & join requests
  const fetchMembersAndJoinRequests = useCallback(async () => {
    if (!activeFridgeId) return;
    setMembersLoading(true);
    try {
      const data = await apiRequest(`/fridges/${activeFridgeId}/members`);
      setMembers(data.members || []);
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setMembersLoading(false);
    }

    if (isPrivileged) {
      setJoinRequestsLoading(true);
      try {
        const jrData = await apiRequest(`/fridges/${activeFridgeId}/join-requests`);
        setJoinRequests(jrData.requests || []);
      } catch {
        // Silently ignore
      } finally {
        setJoinRequestsLoading(false);
      }
    }
  }, [activeFridgeId, isPrivileged, onNotify]);

  // Fetch activity logs
  const fetchActivity = useCallback(async () => {
    if (!activeFridgeId) return;
    setActivityLoading(true);
    try {
      const data = await apiRequest(`/fridges/${activeFridgeId}/activity`);
      setActivity(data.logs || []);
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setActivityLoading(false);
    }
  }, [activeFridgeId, onNotify]);

  useEffect(() => {
    if (activeFridgeId) {
      fetchFridgeDetails(activeFridgeId);
      fetchInventory();
      fetchRequests();
      fetchMembersAndJoinRequests();
      fetchActivity();
    } else {
      setCurrentFridge(null);
    }
  }, [activeFridgeId, fetchFridgeDetails, fetchInventory, fetchRequests, fetchMembersAndJoinRequests, fetchActivity]);

  // Add Item handler
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!foodName.trim() || !activeFridgeId) return;
    setItemSubmitting(true);
    try {
      await apiRequest(`/fridges/${activeFridgeId}/items`, {
        method: "POST",
        body: JSON.stringify({
          name: foodName.trim(),
          category: foodCategory.trim() || undefined,
          quantity: Number(foodQuantity),
          unit: foodUnit.trim() || "units",
          notes: foodNotes.trim() || undefined,
        }),
      });
      onNotify?.("Provision successfully logged into inventory.", "success");
      setFoodName("");
      setFoodCategory("");
      setFoodQuantity("1");
      setFoodUnit("units");
      setFoodNotes("");
      setShowAddItem(false);
      fetchInventory();
      fetchActivity();
      onRefreshFridges?.();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setItemSubmitting(false);
    }
  };

  // Update item quantity
  const handleUpdateItemQuantity = async (itemId, newQty) => {
    try {
      await apiRequest(`/fridges/${activeFridgeId}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: Math.max(0, Number(newQty)) }),
      });
      onNotify?.("Item quantity updated.", "success");
      fetchInventory();
      fetchActivity();
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Remove this provision from inventory?")) return;
    try {
      await apiRequest(`/fridges/${activeFridgeId}/items/${itemId}`, {
        method: "DELETE",
      });
      onNotify?.("Provision removed.", "success");
      fetchInventory();
      fetchActivity();
      onRefreshFridges?.();
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  };

  // Submit portion request
  const handleSubmitPortionRequest = async (e) => {
    e.preventDefault();
    if (!requestItem || !activeFridgeId) return;
    setRequestSubmitting(true);
    try {
      await apiRequest(`/fridges/${activeFridgeId}/requests`, {
        method: "POST",
        body: JSON.stringify({
          foodItemId: requestItem.id,
          requestedQuantity: Number(requestQuantity),
          note: requestNote.trim() || undefined,
        }),
      });
      onNotify?.(`Portion claim for ${requestItem.name} submitted.`, "success");
      setShowRequestModal(false);
      setRequestItem(null);
      setRequestQuantity("1");
      setRequestNote("");
      fetchRequests();
      fetchActivity();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setRequestSubmitting(false);
    }
  };

  // Food request action (approve/reject)
  const handleFoodRequestAction = async (requestId, action) => {
    try {
      await apiRequest(`/fridges/${activeFridgeId}/requests/${requestId}/${action}`, {
        method: "PATCH",
      });
      onNotify?.(`Claim ${action}ed successfully.`, "success");
      fetchRequests();
      fetchInventory();
      fetchActivity();
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  };

  // Add member
  const handleAddMember = async (e) => {
    e.preventDefault();
    const email = newMemberEmail.trim().toLowerCase();
    if (!email || !activeFridgeId) return;
    setAddingMember(true);
    try {
      await apiRequest(`/fridges/${activeFridgeId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role: newMemberRole }),
      });
      onNotify?.(`Member ${email} added.`, "success");
      setNewMemberEmail("");
      fetchMembersAndJoinRequests();
      fetchActivity();
      onRefreshFridges?.();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setAddingMember(false);
    }
  };

  // Join request action
  const handleJoinRequestAction = async (requestId, action) => {
    try {
      await apiRequest(`/fridges/${activeFridgeId}/join-requests/${requestId}/${action}`, {
        method: "PATCH",
      });
      onNotify?.(`Membership request ${action}ed.`, "success");
      fetchMembersAndJoinRequests();
      fetchFridgeDetails(activeFridgeId);
      onRefreshFridges?.();
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!activeFridgeId) return;
    setSavingSettings(true);
    try {
      await apiRequest(`/fridges/${activeFridgeId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          name: settingsForm.name.trim(),
          description: settingsForm.description.trim() || null,
          isDiscoverable: settingsForm.isDiscoverable,
          publicFoodPreview: settingsForm.publicFoodPreview,
          acceptJoinRequests: settingsForm.acceptJoinRequests,
          showMemberCount: settingsForm.showMemberCount,
          publicDescription: settingsForm.publicDescription.trim() || null,
        }),
      });
      onNotify?.("Fridge settings and discovery policies saved.", "success");
      fetchFridgeDetails(activeFridgeId);
      onRefreshFridges?.();
    } catch (err) {
      onNotify?.(err.message, "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Filtered fridges in catalog view
  const filteredFridges = fridges.filter((f) => {
    const matchesSearch =
      !catalogSearch ||
      f.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(catalogSearch.toLowerCase()));
    const matchesRole =
      roleFilter === "all" || (f.role && f.role.toLowerCase() === roleFilter.toLowerCase());
    return matchesSearch && matchesRole;
  });

  // Calculate totals
  const totalTrackedItems = fridges.reduce((acc, f) => acc + (f.itemCount || 0), 0);
  const totalMembers = fridges.reduce((acc, f) => acc + (f.memberCount || 1), 0);

  // ==========================================
  // VIEW 1: ALL FRIDGES OVERVIEW (STITCH SCREEN 2)
  // ==========================================
  if (!activeFridgeId || !currentFridge) {
    return (
      <div className="stitch-page">
        {/* Editorial Header Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-6 pb-8">
          <div className="flex flex-col gap-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-surface-tint"></span>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">
                Communal Hubs &amp; Vaults
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
              My Fridges
            </h1>
            <p className="font-body-md text-body-md text-secondary">
              Manage your communal storage spaces, inventory logs, and membership policies.
            </p>
          </div>

          {/* Search, Filter & Creation Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex items-center min-w-[220px]">
              <span className="material-symbols-outlined absolute left-3.5 text-secondary text-[18px]">
                search
              </span>
              <input
                type="text"
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-secondary rounded-lg pl-10 pr-4 py-2.5 font-body-sm text-body-sm focus:outline-none shadow-sm transition-all"
                placeholder="Search fridges..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
            </div>

            <div className="relative">
              <select
                className="bg-surface-container-lowest text-on-surface hover:bg-surface-container px-4 py-2.5 rounded-lg font-label-md text-label-md flex items-center gap-2 shadow-sm transition-colors border-0 focus:outline-none cursor-pointer"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
              >
                <option value="all">All Roles</option>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
            </div>

            <button
              type="button"
              className="bg-primary-container text-on-primary hover:bg-primary px-5 py-2.5 rounded-lg font-label-md text-label-md flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              onClick={onOpenCreateFridge}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create Fridge</span>
            </button>
          </div>
        </div>

        {/* High-level Botanical Metrics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[24px]">kitchen</span>
              </div>
              <div>
                <span className="font-headline-md text-headline-md text-primary font-semibold block leading-tight">
                  {fridges.length}
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-medium">
                  Total Managed Fridges
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-secondary-container font-label-sm text-label-sm">
                Active Spaces
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">shelves</span>
              </div>
              <div>
                <span className="font-headline-md text-headline-md text-primary font-semibold block leading-tight">
                  {totalTrackedItems}
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-medium">
                  Stocked Provisions
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-fixed-variant font-label-sm text-label-sm font-semibold">
                Nominal
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[24px]">diversity_3</span>
              </div>
              <div>
                <span className="font-headline-md text-headline-md text-primary font-semibold block leading-tight">
                  {totalMembers}
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-medium">
                  Connected Neighbors
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-secondary-container font-label-sm text-label-sm">
                Co-stewards
              </span>
            </div>
          </div>
        </div>

        {/* Fridge Cards Grid */}
        {filteredFridges.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-10 text-center shadow-sm flex flex-col items-center">
            <span className="material-symbols-outlined text-[36px] text-secondary mb-2">kitchen</span>
            <h3 className="font-headline-sm text-headline-sm text-primary mb-1">No fridges matched</h3>
            <p className="font-body-md text-body-md text-secondary max-w-md mb-4">
              {catalogSearch || roleFilter !== "all"
                ? "Try adjusting your search query or role filter."
                : "You have not created or joined any communal fridges yet."}
            </p>
            <button
              type="button"
              className="bg-primary-container text-on-primary hover:bg-primary px-5 py-2.5 rounded-lg font-label-md text-label-md flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              onClick={onOpenCreateFridge}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create Your First Fridge</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {filteredFridges.map((f, idx) => {
              const isPrivilegedUser = f.role === "OWNER" || f.role === "ADMIN";
              const icons = ["cottage", "apartment", "corporate_fare", "eco"];
              const cardIcon = icons[idx % icons.length];

              return (
                <div
                  key={f.id}
                  className="bg-surface-container-lowest rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
                  data-role={f.role?.toLowerCase() || "member"}
                >
                  <div>
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[22px]">{cardIcon}</span>
                        </div>
                        <div>
                          <h2 className="font-headline-sm text-headline-sm text-primary tracking-tight">
                            {f.name}
                          </h2>
                          <span className="font-label-sm text-label-sm text-secondary">
                            {f.isDiscoverable ? "Public Hub · Communal Larder" : "Private Household Larder"}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm uppercase tracking-wider font-semibold ${
                        f.role === "OWNER"
                          ? "bg-primary-container text-on-primary"
                          : f.role === "ADMIN"
                          ? "bg-surface-container-high text-on-secondary-fixed"
                          : "bg-surface-container text-on-secondary-container"
                      }`}>
                        {f.role || "MEMBER"}
                      </span>
                    </div>

                    <p className="font-body-md text-body-md text-on-surface-variant mb-6 line-clamp-2">
                      {f.description || "Active household cold storage and shared communal pantry."}
                    </p>

                    {/* Metric Details Pill Bar */}
                    <div className="p-3 bg-surface-container-low rounded-lg flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-secondary">inventory_2</span>
                        <span className="font-label-md text-label-md text-primary font-semibold">
                          {f.itemCount ?? 0} Items
                        </span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-outline-variant"></div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-secondary">group</span>
                        <span className="font-label-md text-label-md text-on-surface">
                          {f.memberCount ?? 1} Members
                        </span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-outline-variant"></div>
                      <div className="flex items-center gap-1.5 text-secondary">
                        <span className="material-symbols-outlined text-[16px]">
                          {f.isDiscoverable ? "public" : "lock"}
                        </span>
                        <span className="font-label-sm text-label-sm">
                          {f.isDiscoverable ? "Public Discoverable" : "Private Household"}
                        </span>
                      </div>
                    </div>

                    {/* Badges Strip */}
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                      <span className={`px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1.5 ${
                        f.isDiscoverable
                          ? "bg-secondary-container text-on-secondary-fixed-variant font-semibold"
                          : "bg-surface-container text-on-secondary-container"
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {f.isDiscoverable ? "travel_explore" : "shield"}
                        </span>
                        {f.isDiscoverable ? "Public Discovery Active" : "Private Storage"}
                      </span>
                      {f.publicFoodPreview && (
                        <span className="px-3 py-1 rounded-full bg-surface-container text-on-secondary-container font-label-sm text-label-sm flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">preview</span>
                          Public Food Preview Enabled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="flex items-center gap-2 pt-4 bg-surface-container-lowest">
                    <button
                      type="button"
                      className="flex-1 bg-primary-container text-on-primary hover:bg-primary py-2.5 px-4 rounded-lg font-label-md text-label-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      onClick={() => {
                        onSelectFridge(f.id);
                        setActiveTab("inventory");
                      }}
                    >
                      <span>Open &amp; Manage</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                    {isPrivilegedUser && (
                      <button
                        type="button"
                        aria-label={`Settings for ${f.name}`}
                        className="p-2.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-container transition-colors flex items-center justify-center cursor-pointer"
                        onClick={() => {
                          onSelectFridge(f.id);
                          setActiveTab("settings");
                        }}
                      >
                        <span className="material-symbols-outlined text-[20px]">tune</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Editorial Helper Context Bar */}
        <div className="mt-12 bg-surface-container-low rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary-container shrink-0">
              <span className="material-symbols-outlined text-[22px]">policy</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-primary">
                Need a custom shared inventory policy?
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                Configure multi-household guest tags, expiration alerts, and claim quotas in each fridge's parameters.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="bg-surface-container-lowest text-primary hover:bg-surface-container px-4 py-2 rounded-lg font-label-md text-label-md flex items-center gap-2 whitespace-nowrap shadow-sm transition-colors cursor-pointer"
            onClick={() => {
              if (fridges.length > 0) {
                onSelectFridge(fridges[0].id);
                setActiveTab("settings");
              }
            }}
          >
            <span>Review Guidelines</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: FRIDGE DETAIL & INVENTORY (STITCH SCREEN 3)
  // ==========================================
  return (
    <div className="stitch-page">
      {/* Fridge Header Section */}
      <div className="fridge-view-header">
        {/* Scope path & sync status */}
        <div className="fridge-sync-status-bar">
          <div className="fridge-scope-path">
            <span>FRIDGE://{currentFridge.name.toUpperCase().replace(/\s+/g, "-")}</span>
            <span style={{ margin: "0 6px" }}>/</span>
            <span style={{ cursor: "pointer" }} onClick={() => onSelectFridge("")}>
              My Fridges
            </span>
            <span style={{ margin: "0 6px" }}>/</span>
            <strong style={{ color: "var(--on-surface)" }}>{currentFridge.name}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="status-pill pill-public">
              <span className="status-dot dot-green" />
              ACTIVE SYNC
            </span>
            <span className="mini-role-pill">{currentFridge.role || "MEMBER"}</span>
            <span className="status-pill pill-private">
              {currentFridge.isDiscoverable ? "Public Discoverable" : "Private Household"}
            </span>
          </div>
        </div>

        {/* Title & Action Cluster */}
        <div className="fridge-title-actions-row">
          <div className="fridge-title-left">
            <div className="fridge-headline-group">
              <div className="brand-logo-icon">
                <span className="material-symbols-outlined text-[18px]">kitchen</span>
              </div>
              <h1 className="stitch-title">{currentFridge.name}</h1>
            </div>
            <p className="stitch-subtitle">
              {currentFridge.description ||
                "Primary cold storage and shared pantry. Please date-label all provisions and claim portions before expiry."}
            </p>
          </div>

          <div className="fridge-title-actions">
            {isPrivileged && (
              <button
                type="button"
                className="stitch-btn stitch-btn-secondary"
                onClick={() => setActiveTab("settings")}
              >
                <span className="material-symbols-outlined text-[16px]">settings</span>
                <span>Settings</span>
              </button>
            )}
            <button
              type="button"
              className="stitch-btn stitch-btn-primary"
              onClick={() => setShowAddItem(true)}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Add Provision</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="stitch-metrics-grid">
        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Total Stock</span>
            <span className="material-symbols-outlined text-[18px] text-outline">inventory_2</span>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">{pagination.total}</span>
            <span className="metric-chip">provisions</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Active Members</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">verified</span>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">{members.length || currentFridge.memberCount || 1}</span>
            <span className="metric-chip">stewards</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Portion Claims</span>
            <span className="material-symbols-outlined text-[18px] text-primary">volunteer_activism</span>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">{requests.filter((r) => r.status === "PENDING").length}</span>
            <span className="metric-sub-status text-secondary">pending</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Join Inquiries</span>
            <span className="material-symbols-outlined text-[18px] text-outline">group_add</span>
          </div>
          <div className="metric-box-bottom">
            <span className="metric-number">{joinRequests.length}</span>
            <span className="metric-chip">awaiting</span>
          </div>
        </div>
      </div>

      {/* Primary Tab Bar */}
      <div className="stitch-tab-bar" role="tablist">
        <button
          type="button"
          className={`stitch-tab-btn ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          <span className="material-symbols-outlined text-[16px]">kitchen</span>
          <span>Inventory</span>
          <span className="tab-numeric-badge">{pagination.total}</span>
        </button>

        <button
          type="button"
          className={`stitch-tab-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
          <span>Portion Claims</span>
          <span className="tab-numeric-badge">{requests.length}</span>
        </button>

        <button
          type="button"
          className={`stitch-tab-btn ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          <span className="material-symbols-outlined text-[16px]">group</span>
          <span>Household Members</span>
          <span className="tab-numeric-badge">{members.length}</span>
        </button>

        <button
          type="button"
          className={`stitch-tab-btn ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span>Activity Audit</span>
        </button>

        {isPrivileged && (
          <button
            type="button"
            className={`stitch-tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Policies & Discovery</span>
          </button>
        )}
      </div>

      {/* TAB 1: INVENTORY TAB */}
      {activeTab === "inventory" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Table Toolbar */}
          <div className="table-toolbar">
            <div className="toolbar-search">
              <span className="material-symbols-outlined text-[16px] search-glyph">search</span>
              <input
                type="text"
                placeholder="Filter provisions by name, storage note..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="toolbar-filters">
              <select
                className="toolbar-select"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Categories</option>
                <option value="Bakery">Bakery</option>
                <option value="Dairy">Dairy</option>
                <option value="Produce">Produce</option>
                <option value="Prepared">Prepared Meals</option>
                <option value="Pantry">Pantry</option>
                <option value="Beverages">Beverages</option>
              </select>

              <select
                className="toolbar-select"
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="fresh">Fresh</option>
                <option value="expiring">Expiring Soon</option>
              </select>

              <div className="view-mode-toggle">
                <button
                  type="button"
                  className={`view-toggle-btn ${inventoryViewMode === "table" ? "active" : ""}`}
                  onClick={() => setInventoryViewMode("table")}
                  title="Table View"
                >
                  <span className="material-symbols-outlined text-[16px]">table_rows</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${inventoryViewMode === "grid" ? "active" : ""}`}
                  onClick={() => setInventoryViewMode("grid")}
                  title="Grid View"
                >
                  <span className="material-symbols-outlined text-[16px]">grid_view</span>
                </button>
              </div>

              <button
                type="button"
                className="stitch-btn stitch-btn-primary stitch-btn-small"
                onClick={() => setShowAddItem(true)}
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>Add Food</span>
              </button>
            </div>
          </div>

          {/* Add Item Modal / Drawer */}
          {showAddItem && (
            <div className="stitch-card" style={{ border: "2px solid var(--primary)" }}>
              <div className="stitch-card-header">
                <div>
                  <h3 className="stitch-card-title">Stock Food Provision into {currentFridge.name}</h3>
                  <p className="card-description">Register ingredients or prepared dishes with exact quantities.</p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowAddItem(false)}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleAddItem} className="modal-form" style={{ padding: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
                  <label className="form-field-label">
                    <span className="label-text">Food Item Name *</span>
                    <input
                      required
                      placeholder="e.g. Sourdough Loaf, Whole Oat Milk"
                      value={foodName}
                      onChange={(e) => setFoodName(e.target.value)}
                    />
                  </label>

                  <label className="form-field-label">
                    <span className="label-text">Category</span>
                    <input
                      placeholder="Bakery, Dairy, Produce"
                      value={foodCategory}
                      onChange={(e) => setFoodCategory(e.target.value)}
                    />
                  </label>

                  <label className="form-field-label">
                    <span className="label-text">Quantity *</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={foodQuantity}
                      onChange={(e) => setFoodQuantity(e.target.value)}
                    />
                  </label>

                  <label className="form-field-label">
                    <span className="label-text">Unit *</span>
                    <input
                      required
                      placeholder="units, L, grams"
                      value={foodUnit}
                      onChange={(e) => setFoodUnit(e.target.value)}
                    />
                  </label>
                </div>

                <label className="form-field-label">
                  <span className="label-text">Storage Location & Expiry Notes</span>
                  <input
                    placeholder="e.g. Top door shelf, consume before Sunday dinner"
                    value={foodNotes}
                    onChange={(e) => setFoodNotes(e.target.value)}
                  />
                </label>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="stitch-btn stitch-btn-secondary"
                    onClick={() => setShowAddItem(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="stitch-btn stitch-btn-primary"
                    disabled={itemSubmitting}
                  >
                    {itemSubmitting ? "Stocking..." : "Stock Provision"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* High Density Inventory Table View */}
          {itemsLoading ? (
            <div className="stitch-card" style={{ padding: 32, textAlign: "center" }}>
              <p>Loading inventory provisions...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="stitch-card" style={{ padding: 40, textAlign: "center", alignItems: "center" }}>
              <span className="material-symbols-outlined text-[32px] text-muted">inventory_2</span>
              <h3 className="stitch-card-title">No provisions found</h3>
              <p className="card-description">Stock your first batch or adjust your search filter.</p>
              <button
                type="button"
                className="stitch-btn stitch-btn-primary"
                style={{ marginTop: 8 }}
                onClick={() => setShowAddItem(true)}
              >
                Add Food Provision
              </button>
            </div>
          ) : inventoryViewMode === "table" ? (
            <div className="high-density-table-wrap">
              <table className="inventory-data-table">
                <thead>
                  <tr>
                    <th>Provision & Notes</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Quantity</th>
                    <th>Horizon</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="food-item-cell">
                          <span className="food-item-name">{item.name}</span>
                          <span className="food-item-notes">
                            {item.notes || "Storage shelf"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="category-tag-pill">{item.category || "General"}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="qty-mono">
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td>
                        <span className="mono-badge">Optimal</span>
                      </td>
                      <td>
                        <span className="status-badge-chip status-fresh">
                          <span className="status-dot dot-green" />
                          Fresh
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions-cluster">
                          <button
                            type="button"
                            className="inline-claim-btn"
                            onClick={() => {
                              setRequestItem(item);
                              setShowRequestModal(true);
                            }}
                          >
                            Claim
                          </button>
                          {isPrivileged && (
                            <>
                              <div className="qty-stepper">
                                <button
                                  type="button"
                                  className="stepper-btn"
                                  title="Reduce quantity by 1"
                                  onClick={() =>
                                    handleUpdateItemQuantity(item.id, Number(item.quantity) - 1)
                                  }
                                >
                                  −
                                </button>
                                <button
                                  type="button"
                                  className="stepper-btn"
                                  title="Increase quantity by 1"
                                  onClick={() =>
                                    handleUpdateItemQuantity(item.id, Number(item.quantity) + 1)
                                  }
                                >
                                  +
                                </button>
                              </div>
                              <button
                                type="button"
                                className="icon-button"
                                title="Delete provision"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <span className="material-symbols-outlined text-[16px] text-danger">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="fridge-cards-grid">
              {items.map((item) => (
                <div key={item.id} className="stitch-card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="category-tag-pill">{item.category || "General"}</span>
                    <span className="qty-mono">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                  <div>
                    <h3 className="food-item-name">{item.name}</h3>
                    <p className="food-item-notes">{item.notes || "Stored on communal shelf."}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <button
                      type="button"
                      className="stitch-btn stitch-btn-primary stitch-btn-small"
                      onClick={() => {
                        setRequestItem(item);
                        setShowRequestModal(true);
                      }}
                    >
                      Claim Portion
                    </button>
                    {isPrivileged && (
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <span className="material-symbols-outlined text-[16px] text-danger">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PORTION CLAIMS */}
      {activeTab === "requests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="stitch-card">
            <h3 className="stitch-card-title">Portion Claims in {currentFridge.name}</h3>
            <p className="card-description">
              Review and coordinate requests submitted by household members for shared provisions.
            </p>

            {requests.length === 0 ? (
              <div className="empty-sub-card">
                <span className="material-symbols-outlined text-[24px] text-secondary">check_circle</span>
                <p>No active portion claims awaiting decision.</p>
              </div>
            ) : (
              <div className="claims-queue-list">
                {requests.map((r) => (
                  <div key={r.id} className="claim-queue-card">
                    <div className="claim-queue-top">
                      <div className="claim-user-profile">
                        <div className="user-avatar-round">
                          {r.requester?.name ? r.requester.name.slice(0, 2).toUpperCase() : "MB"}
                        </div>
                        <div className="claim-user-meta">
                          <span className="claim-user-name">{r.requester?.name || r.requester?.email}</span>
                          <span className="claim-fridge-name">{r.status}</span>
                        </div>
                      </div>
                      <span className="claim-timestamp">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="claim-body-detail">
                      Requested <strong className="text-primary">{r.requestedQuantity}</strong> portion(s) of{" "}
                      <span className="claimed-item-name">{r.foodItem?.name}</span>
                      {r.note && <div className="claim-note">"{r.note}"</div>}
                    </div>

                    {r.status === "PENDING" && isPrivileged && (
                      <div className="claim-actions-row">
                        <button
                          type="button"
                          className="claim-btn-approve"
                          onClick={() => handleFoodRequestAction(r.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="claim-btn-decline"
                          onClick={() => handleFoodRequestAction(r.id, "reject")}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MEMBERS */}
      {activeTab === "members" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="stitch-card">
            <div className="stitch-card-header">
              <div>
                <h3 className="stitch-card-title">Household Members & Co-Stewards</h3>
                <p className="card-description">People with authorized access to log provisions and claim food.</p>
              </div>
            </div>

            {isPrivileged && (
              <form onSubmit={handleAddMember} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <label className="form-field-label" style={{ flex: 1 }}>
                  <span className="label-text">Invite by Email</span>
                  <input
                    type="email"
                    required
                    placeholder="housemate@email.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                </label>
                <label className="form-field-label" style={{ width: 140 }}>
                  <span className="label-text">Role</span>
                  <select
                    className="toolbar-select"
                    style={{ height: 38 }}
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="stitch-btn stitch-btn-primary"
                  style={{ height: 38 }}
                  disabled={addingMember}
                >
                  {addingMember ? "Adding..." : "Add Member"}
                </button>
              </form>
            )}

            {/* Members List Table */}
            <div className="high-density-table-wrap" style={{ marginTop: 12 }}>
              <table className="inventory-data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="owner-cell">
                          <div className="owner-avatar-mini">
                            {m.user?.name ? m.user.name.slice(0, 2).toUpperCase() : "MB"}
                          </div>
                          <strong>
                            {m.user?.name || "Member"}
                            {user && (m.user?.id === user.id || m.userId === user.id) ? " (You)" : ""}
                          </strong>
                        </div>
                      </td>
                      <td>
                        <span className="table-sub-text">{m.user?.email}</span>
                      </td>
                      <td>
                        <span className="mini-role-pill">{m.role}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Join Requests if Privileged */}
            {isPrivileged && joinRequests.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 className="stitch-card-title" style={{ fontSize: 14, marginBottom: 8 }}>
                  Pending Join Applications ({joinRequests.length})
                </h4>
                <div className="claims-queue-list">
                  {joinRequests.map((jr) => (
                    <div key={jr.id} className="claim-queue-card">
                      <div className="claim-queue-top">
                        <span className="claim-user-name">{jr.user?.name || jr.user?.email}</span>
                        <span className="claim-timestamp">{new Date(jr.createdAt).toLocaleDateString()}</span>
                      </div>
                      {jr.note && <p className="claim-note">"{jr.note}"</p>}
                      <div className="claim-actions-row">
                        <button
                          type="button"
                          className="claim-btn-approve"
                          onClick={() => handleJoinRequestAction(jr.id, "approve")}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="claim-btn-decline"
                          onClick={() => handleJoinRequestAction(jr.id, "reject")}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ACTIVITY AUDIT */}
      {activeTab === "activity" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="stitch-card">
            <h3 className="stitch-card-title">Activity Audit Trail</h3>
            <p className="card-description">Complete chronological history of changes in {currentFridge.name}.</p>
            {activity.length === 0 ? (
              <div className="empty-sub-card">
                <p>No activity records logged yet.</p>
              </div>
            ) : (
              <div className="live-ledger-feed">
                {activity.map((log) => (
                  <div key={log.id} className="ledger-entry">
                    <div className="ledger-icon-wrap">
                      <span className="material-symbols-outlined text-[16px]">history</span>
                    </div>
                    <div className="ledger-content">
                      <div className="ledger-top-row">
                        <span className="ledger-title">{log.action.replace(/_/g, " ")}</span>
                        <span className="ledger-time">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="ledger-details">Executed by {log.user?.name || "Member"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: POLICIES & DISCOVERY (SETTINGS) */}
      {activeTab === "settings" && isPrivileged && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="stitch-card">
            <h3 className="stitch-card-title">Discovery & Privacy Policies</h3>
            <p className="card-description">
              Configure how this fridge appears in neighborhood searches and manage public preview permissions.
            </p>

            <form onSubmit={handleSaveSettings} className="modal-form" style={{ padding: 0 }}>
              <label className="form-field-label">
                <span className="label-text">Fridge Name</span>
                <input
                  required
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                />
              </label>

              <label className="form-field-label">
                <span className="label-text">Internal Description</span>
                <input
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                />
              </label>

              <label className="form-field-label">
                <span className="label-text">Public Welcome Message (Community View)</span>
                <input
                  placeholder="e.g. Open communal pantry stocked with fresh sourdough and produce."
                  value={settingsForm.publicDescription}
                  onChange={(e) => setSettingsForm({ ...settingsForm, publicDescription: e.target.value })}
                />
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settingsForm.isDiscoverable}
                    onChange={(e) => setSettingsForm({ ...settingsForm, isDiscoverable: e.target.checked })}
                  />
                  <strong>Make this fridge discoverable in community searches</strong>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settingsForm.publicFoodPreview}
                    onChange={(e) => setSettingsForm({ ...settingsForm, publicFoodPreview: e.target.checked })}
                  />
                  <span>Allow public preview of surplus food provisions without membership</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settingsForm.acceptJoinRequests}
                    onChange={(e) => setSettingsForm({ ...settingsForm, acceptJoinRequests: e.target.checked })}
                  />
                  <span>Accept membership join requests from neighbors</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settingsForm.showMemberCount}
                    onChange={(e) => setSettingsForm({ ...settingsForm, showMemberCount: e.target.checked })}
                  />
                  <span>Display member count publicly on Discover card</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="submit"
                  className="stitch-btn stitch-btn-primary"
                  disabled={savingSettings}
                >
                  {savingSettings ? "Saving..." : "Save Policies"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PORTION CLAIM MODAL */}
      {showRequestModal && requestItem && (
        <div className="modal-backdrop" onClick={() => setShowRequestModal(false)} role="dialog">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Claim Portion of {requestItem.name}</h2>
                <p className="modal-subtitle">Reserve available ingredients for household cooking</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowRequestModal(false)}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitPortionRequest} className="modal-form">
              <label className="form-field-label">
                <span className="label-text">
                  Portion Quantity (Max {requestItem.quantity} {requestItem.unit})
                </span>
                <input
                  type="number"
                  min="0.01"
                  max={Number(requestItem.quantity)}
                  step="0.01"
                  required
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(e.target.value)}
                />
              </label>

              <label className="form-field-label">
                <span className="label-text">Note for Housemates / Chef (Optional)</span>
                <input
                  placeholder="e.g. Making vegetable soup tonight"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="stitch-btn stitch-btn-secondary"
                  onClick={() => setShowRequestModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="stitch-btn stitch-btn-primary"
                  disabled={requestSubmitting}
                >
                  {requestSubmitting ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
