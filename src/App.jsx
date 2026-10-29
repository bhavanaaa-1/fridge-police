import { useEffect, useMemo, useState } from "react";
import "./App.css";

const KEY = "fridge-police-final";
const PEOPLE = ["Alex", "Jordan", "Casey", "Sam"];
const INITIAL = [
  { id: "pizza-001", name: "Pizza", owner: "Alex", quantity: 25, status: "available" },
  { id: "pasta-001", name: "Pasta", owner: "Alex", quantity: 100, status: "available" },
  { id: "ketchup-001", name: "Heinz Ketchup", owner: "Jordan", quantity: 100, status: "available" },
  { id: "ketchup-002", name: "Heinz Ketchup", owner: "Casey", quantity: 100, status: "available" },
  { id: "juice-001", name: "Orange Juice", owner: "Casey", quantity: 100, status: "available" },
];
const EXPIRES_IN = 24 * 60 * 60 * 1000;

function normalize(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : INITIAL;
  const requests = Array.isArray(raw?.requests) ? raw.requests : [];
  const log = Array.isArray(raw?.log) ? raw.log : [];
  return {
    items: items.filter((x) => x && x.id).map((x) => ({
      ...x,
      quantity: Number.isFinite(Number(x.quantity)) ? Math.max(0, Math.min(100, Number(x.quantity))) : 0,
      status: x.status || "available",
    })),
    requests: requests.filter((x) => x && x.id).map((x) => ({
      ...x,
      amount: Number(x.amount) || 0,
      status: x.status || "pending",
    })),
    log,
  };
}

function loadData() {
  try {
    for (const key of [KEY, "fridge-police-complete-v1", "fridge-police-state-v2"]) {
      const saved = localStorage.getItem(key);
      if (saved) return normalize(JSON.parse(saved));
    }
    const oldItems = localStorage.getItem("fridge-police-items");
    return normalize({ items: oldItems ? JSON.parse(oldItems) : INITIAL });
  } catch (error) {
    console.error("Could not load saved fridge data:", error);
    return normalize({});
  }
}

function expire(data, now = Date.now()) {
  return {
    ...data,
    requests: data.requests.map((r) =>
      r.status === "approved" && r.expiresAt <= now
        ? { ...r, status: "expired", expiredAt: now }
        : r
    ),
  };
}

function reserved(data, itemId) {
  return data.requests
    .filter((r) => r.itemId === itemId && r.status === "approved")
    .reduce((sum, r) => sum + r.amount, 0);
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emoji(name) {
  const n = name.toLowerCase();
  if (n.includes("pizza")) return "🍕";
  if (n.includes("pasta")) return "🍝";
  if (n.includes("ketchup") || n.includes("tomato")) return "🍅";
  if (n.includes("juice")) return "🧃";
  if (n.includes("milk")) return "🥛";
  if (n.includes("yogurt")) return "🥣";
  if (n.includes("bread")) return "🍞";
  if (n.includes("chicken")) return "🍗";
  return "🥡";
}

function prettyStatus(item, free) {
  if (item.status !== "available") return item.status;
  if (free <= 0 && item.quantity > 0) return "reserved";
  if (item.quantity <= 0) return "depleted";
  return "available";
}

function App() {
  const [data, setData] = useState(loadData);
  const [message, setMessage] = useState("");
  const [foodName, setFoodName] = useState("");
  const [foodOwner, setFoodOwner] = useState("Alex");
  const [foodQuantity, setFoodQuantity] = useState("100");
  const [requester, setRequester] = useState("Jordan");
  const [itemId, setItemId] = useState("pizza-001");
  const [amount, setAmount] = useState("25");
  const [correctionId, setCorrectionId] = useState("juice-001");
  const [correctionType, setCorrectionType] = useState("missing");
  const [correctionAmount, setCorrectionAmount] = useState("25");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeNav, setActiveNav] = useState("inventory");

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Could not save fridge data:", error);
      setMessage("Could not save data. Check browser storage settings.");
    }
  }, [data]);

  useEffect(() => {
    const timer = setInterval(() => setData((current) => expire(current)), 1000);
    return () => clearInterval(timer);
  }, []);

  function addFood(e) {
    e.preventDefault();
    const name = foodName.trim();
    const quantity = Number(foodQuantity);
    if (!name || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100) {
      setMessage("Enter a name and a quantity between 1 and 100.");
      return;
    }
    const item = { id: newId(), name, owner: foodOwner, quantity, status: "available" };
    setData((d) => ({ ...d, items: [...d.items, item] }));
    setFoodName("");
    setFoodQuantity("100");
    setCorrectionId((current) => current || item.id);
    setItemId((current) => current || item.id);
    setMessage("Food added to the fridge.");
  }

  function requestFood(e) {
    e.preventDefault();
    const quantity = Number(amount);
    const item = data.items.find((x) => x.id === itemId);
    if (!item || !Number.isFinite(quantity) || quantity <= 0) {
      setMessage("Choose an item and enter a valid portion.");
      return;
    }
    if (requester === item.owner) {
      setMessage("You cannot request your own food.");
      return;
    }
    if (item.status !== "available" || quantity > item.quantity - reserved(data, item.id)) {
      setMessage("Not enough unreserved food is available.");
      return;
    }
    setData((d) => ({
      ...d,
      requests: [...d.requests, {
        id: newId(), itemId: item.id, itemName: item.name, owner: item.owner,
        requester, amount: quantity, status: "pending", createdAt: Date.now(),
      }],
    }));
    setMessage("Request submitted for owner approval.");
    setActiveNav("requests");
    document.getElementById("requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function decide(id, action) {
    const current = expire(data);
    const request = current.requests.find((r) => r.id === id);
    if (!request || request.status !== "pending") {
      setData(current);
      setMessage("This request is no longer pending.");
      return;
    }
    if (action === "reject") {
      setData({ ...current, requests: current.requests.map((r) => r.id === id ? { ...r, status: "rejected" } : r) });
      setMessage("Request rejected.");
      return;
    }
    const item = current.items.find((x) => x.id === request.itemId);
    const available = item ? item.quantity - reserved(current, item.id) : 0;
    if (!item || item.status !== "available" || request.amount > available) {
      setData({ ...current, requests: current.requests.map((r) => r.id === id ? { ...r, status: "rejected" } : r) });
      setMessage("Approval denied: that portion is no longer available.");
      return;
    }
    setData({
      ...current,
      requests: current.requests.map((r) => r.id === id
        ? { ...r, status: "approved", approvedAt: Date.now(), expiresAt: Date.now() + EXPIRES_IN }
        : r),
    });
    setMessage("Approved. The portion is reserved for 24 hours.");
  }

  function consume(id) {
    const current = expire(data);
    const request = current.requests.find((r) => r.id === id);
    const item = current.items.find((x) => x.id === request?.itemId);
    if (!request || request.status !== "approved" || !item || item.status !== "available" || request.amount > item.quantity) {
      setData(current);
      setMessage("Cannot consume this portion. Check its approval and inventory.");
      return;
    }
    const quantity = item.quantity - request.amount;
    setData({
      ...current,
      items: current.items.map((x) => x.id === item.id ? { ...x, quantity, status: quantity === 0 ? "depleted" : "available" } : x),
      requests: current.requests.map((r) => r.id === id ? { ...r, status: "consumed", consumedAt: Date.now() } : r),
      log: [...current.log, { id: newId(), type: "Consumed", itemName: item.name, details: `${request.requester} consumed ${request.amount}%.`, at: Date.now() }],
    });
    setMessage("Consumption recorded and inventory updated.");
  }

  function simulateExpiry() {
    const current = expire(data);
    let count = 0;
    const requests = current.requests.map((r) => {
      if (r.status === "approved") {
        count++;
        return { ...r, status: "expired", expiredAt: Date.now() };
      }
      return r;
    });
    if (!count) {
      setMessage("No active approvals to expire.");
      return;
    }
    setData({ ...current, requests });
    setMessage(`${count} approval(s) expired. Their portions are available again.`);
  }

  function correctInventory(e) {
    e.preventDefault();
    const item = data.items.find((x) => x.id === correctionId);
    const quantity = Number(correctionAmount);
    if (!item || item.status !== "available") {
      setMessage("Choose an available item.");
      return;
    }
    if (correctionType === "consumed" && (!Number.isFinite(quantity) || quantity <= 0 || quantity > item.quantity)) {
      setMessage("Enter a quantity within the recorded inventory.");
      return;
    }
    const missing = correctionType === "missing";
    const spoiled = correctionType === "spoiled";
    const remaining = missing || spoiled ? 0 : item.quantity - quantity;
    const status = missing ? "missing" : spoiled ? "spoiled" : remaining === 0 ? "depleted" : "available";
    const description = missing ? `${item.quantity}% reported missing.` : spoiled ? `${item.quantity}% discarded as spoiled.` : `${quantity}% consumed outside the app.`;
    setData({
      ...data,
      items: data.items.map((x) => x.id === item.id ? { ...x, quantity: remaining, status } : x),
      requests: data.requests.map((r) => r.itemId === item.id && ["pending", "approved"].includes(r.status)
        ? { ...r, status: "cancelled", cancelledAt: Date.now() } : r),
      log: [...data.log, {
        id: newId(), type: missing ? "Missing" : spoiled ? "Spoiled / discarded" : "Off-app consumption",
        itemName: item.name, details: description, at: Date.now(),
      }],
    });
    setMessage("Inventory corrected. Active requests for this item were cancelled.");
  }

  function resetDemo() {
    setData(normalize({ items: INITIAL, requests: [], log: [] }));
    setItemId("pizza-001");
    setCorrectionId("juice-001");
    setMessage("Demo reset.");
  }

  const availableCount = data.items.filter((x) => x.status === "available" && x.quantity - reserved(data, x.id) > 0).length;
  const pendingCount = data.requests.filter((r) => r.status === "pending").length;
  const approvedCount = data.requests.filter((r) => r.status === "approved").length;

  const filteredItems = useMemo(() => data.items.filter((item) => {
    const free = Math.max(0, item.quantity - reserved(data, item.id));
    const searchable = `${item.name} ${item.owner} ${item.id}`.toLowerCase().includes(search.toLowerCase());
    if (!searchable) return false;
    if (filter === "available") return item.status === "available" && free > 0;
    if (filter === "attention") return item.status !== "available" || free <= 0;
    return true;
  }), [data, search, filter]);

  function scrollTo(id, nav) {
    setActiveNav(nav);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" onClick={() => setActiveNav("inventory")} aria-label="FridgePolice home">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span className="brand-copy"><strong>FridgePolice</strong><small>Shared fridge manager</small></span>
        </a>
        <span className="room-label"><span className="room-dot" /> Floor 3 Kitchen</span>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={activeNav === "inventory" ? "nav-link active" : "nav-link"} onClick={() => scrollTo("inventory", "inventory")}>Inventory</button>
          <button className={activeNav === "requests" ? "nav-link active" : "nav-link"} onClick={() => scrollTo("requests", "requests")}>Requests{pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}</button>
          <button className={activeNav === "quick-actions" ? "nav-link active" : "nav-link"} onClick={() => scrollTo("quick-actions", "quick-actions")}>Quick Actions</button>
          <button className={activeNav === "activity" ? "nav-link active" : "nav-link"} onClick={() => scrollTo("activity", "activity")}>Activity</button>
        </nav>
      </header>

      <div className="page">
        <section className="page-intro" id="top">
          <div>
            <p className="eyebrow">SHARED FOOD, LESS WASTE</p>
            <h1>Your fridge, at a glance.</h1>
            <p className="subtitle">Keep track of what's here, who owns it, and what's available to share.</p>
          </div>
          <div className="intro-actions">
            <button className="button button-secondary" onClick={() => scrollTo("quick-actions", "quick-actions")}>Audit &amp; discrepancies</button>
            <button className="button button-primary" onClick={() => scrollTo("add-food", "quick-actions")}>＋ Add food</button>
          </div>
        </section>

        {message && <div className="toast" role="status"><span>{message}</span><button onClick={() => setMessage("")} aria-label="Dismiss message">×</button></div>}

        <section className="inventory-section" id="inventory">
          <div className="section-top">
            <div><h2>Fridge inventory</h2><p className="section-subtitle">{data.items.length} items tracked · quantities shown as a percentage</p></div>
            <button className="text-button" onClick={resetDemo}>Reset demo</button>
          </div>
          <div className="inventory-toolbar">
            <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search food, owner, or ID..." aria-label="Search inventory" /></label>
            <div className="filter-group" aria-label="Filter inventory">
              {[["all", "All items"], ["available", "Available only"], ["attention", "Needs attention"]].map(([value, label]) =>
                <button key={value} className={filter === value ? "filter-button selected" : "filter-button"} onClick={() => setFilter(value)}>{label}</button>
              )}
            </div>
          </div>
          {filteredItems.length === 0 ? <p className="empty-state">No food items match your search.</p> :
            <div className="inventory-grid">
              {filteredItems.map((item) => {
                const reservedAmount = reserved(data, item.id);
                const free = Math.max(0, item.quantity - reservedAmount);
                const status = prettyStatus(item, free);
                return <article className="food-card" key={item.id}>
                  <div className="food-card-top"><span className="item-id">#{item.id.slice(0, 8).toUpperCase()}</span><span className={`status status-${status}`}>{free > 0 && status === "available" ? "Available" : status}</span></div>
                  <div className="food-title-row"><span className="food-emoji" aria-hidden="true">{emoji(item.name)}</span><div className="food-title"><h3>{item.name}</h3><p>Owned by <strong>{item.owner}</strong></p></div></div>
                  <p className="full-id">ID: {item.id}</p>
                  <div className="stock-breakdown">
                    <div className="stock-labels"><span>Stock breakdown</span><strong>Total: {item.quantity}%</strong></div>
                    <div className="stock-bar"><span className="stock-reserved" style={{ width: `${Math.min(100, reservedAmount)}%` }} /><span className="stock-free" style={{ width: `${free}%` }} /></div>
                    <div className="stock-labels"><span>Reserved: {reservedAmount}%</span><strong>Free: {free}%</strong></div>
                  </div>
                  <div className="food-card-bottom"><span className="muted-small">{item.quantity === 0 ? "No stock left" : free === 0 ? "Fully reserved" : "Ready to share"}</span><button className="mini-button" disabled={free <= 0 || item.status !== "available"} onClick={() => { setItemId(item.id); scrollTo("request-food", "requests"); }}>Request</button></div>
                </article>;
              })}
            </div>
          }
        </section>

        <section className="panel request-panel" id="requests">
          <div className="section-top"><div><h2>Pending portion requests</h2><p className="section-subtitle">{pendingCount} waiting for owner approval</p></div><button className="button button-secondary button-small" onClick={simulateExpiry}>Simulate expiry</button></div>
          {data.requests.length === 0 ? <p className="empty-state">No requests yet. Submit a request for a portion to see it here.</p> :
            <div className="request-list">{[...data.requests].reverse().map((r) => {
              const item = data.items.find((x) => x.id === r.itemId);
              return <article className="request-row" key={r.id}>
                <span className="request-avatar">{r.requester.slice(0, 1)}</span>
                <div className="request-details"><h3>{r.itemName} <span>· {r.amount}%</span></h3><p>{r.requester} requested a portion from {r.owner}</p>{r.status === "approved" && <small>Expires {new Date(r.expiresAt).toLocaleString()}</small>}</div>
                <div className="request-actions"><span className={`status status-${r.status}`}>{r.status}</span>{r.status === "pending" && <><button className="button button-primary button-small" onClick={() => decide(r.id, "approve")}>Approve</button><button className="button button-secondary button-small" onClick={() => decide(r.id, "reject")}>Decline</button></>}{r.status === "approved" && <button className="button button-primary button-small" onClick={() => consume(r.id)}>Mark consumed</button>}{!item && <small>Item no longer exists</small>}</div>
              </article>;
            })}</div>
          }
        </section>

        <section className="bottom-grid" id="quick-actions">
          <article className="panel compact-panel" id="add-food">
            <div className="section-top compact-heading"><div><h2>Add food</h2><p className="section-subtitle">Add an item to the fridge.</p></div></div>
            <form className="form-stack" onSubmit={addFood}>
              <label>Food name<input value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="e.g. Milk" maxLength={60} required /></label>
              <label>Owner<select value={foodOwner} onChange={(e) => setFoodOwner(e.target.value)}>{PEOPLE.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label>Quantity (%)<input type="number" min="1" max="100" value={foodQuantity} onChange={(e) => setFoodQuantity(e.target.value)} required /></label>
              <button className="button button-primary form-submit">＋ Add to fridge</button>
            </form>
          </article>

          <article className="panel compact-panel" id="physical-audit">
            <div className="section-top compact-heading"><div><h2>Physical audit</h2><p className="section-subtitle">Correct what's actually in the fridge.</p></div></div>
            <form className="form-stack" onSubmit={correctInventory}>
              <label>Food item<select value={correctionId} onChange={(e) => setCorrectionId(e.target.value)}>{data.items.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.owner} ({x.id.slice(0, 8)})</option>)}</select></label>
              <label>What happened?<select value={correctionType} onChange={(e) => setCorrectionType(e.target.value)}><option value="consumed">Consumed outside the app</option><option value="missing">Item is missing</option><option value="spoiled">Food spoiled</option></select></label>
              {correctionType === "consumed" && <label>Quantity consumed (%)<input type="number" min="1" max={data.items.find((x) => x.id === correctionId)?.quantity || 100} value={correctionAmount} onChange={(e) => setCorrectionAmount(e.target.value)} required /></label>}
              <button className="button button-secondary form-submit">Correct inventory</button>
            </form>
          </article>

          <article className="panel compact-panel" id="request-food">
            <div className="section-top compact-heading"><div><h2>Request a portion</h2><p className="section-subtitle">Ask an owner before taking food.</p></div></div>
            <form className="form-stack" onSubmit={requestFood}>
              <label>Roommate<select value={requester} onChange={(e) => setRequester(e.target.value)}>{PEOPLE.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label>Food item<select value={itemId} onChange={(e) => setItemId(e.target.value)}>{data.items.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.owner} ({x.id.slice(0, 8)})</option>)}</select></label>
              <label>Portion requested (%)<input type="number" min="1" max="100" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
              <button className="button button-primary form-submit">Request portion</button>
            </form>
          </article>
        </section>

        <section className="panel activity-panel" id="activity">
          <div className="section-top"><div><h2>Breakroom activity</h2><p className="section-subtitle">Recent consumption and inventory corrections.</p></div><span className="activity-count">{data.log.length} events</span></div>
          {data.log.length === 0 ? <p className="empty-state">Activity will appear here when food is consumed or inventory is corrected.</p> :
            <div className="activity-list">{[...data.log].reverse().map((entry) => <article className="activity-entry" key={entry.id}><span className="activity-dot" /><div><strong>{entry.type}</strong><p>{entry.itemName} · {entry.details}</p><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleString()}</time></div></article>)}</div>}
        </section>

        <footer className="footer"><span>FridgePolice · Shared food, less waste.</span><span>{approvedCount} active reservation{approvedCount === 1 ? "" : "s"}</span></footer>
      </div>
    </main>
  );
}

export default App;
