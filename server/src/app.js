import express from "express";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import requestRoutes from "./routes/request.routes.js";
import fridgeRoutes from "./routes/fridge.routes.js";
import discoverRoutes from "./routes/discover.routes.js";
import userRoutes from "./routes/user.routes.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

// Limit request body size to reduce abuse.
app.use(express.json({ limit: "10kb" }));

// Basic security headers.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// Mount routes.
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/discover/fridges", discoverRoutes);
app.use("/api/users", userRoutes);
app.use("/api/fridges", fridgeRoutes);
app.use("/api/fridges/:fridgeId/items", inventoryRoutes);
app.use("/api/fridges/:fridgeId/requests", requestRoutes);

// Handle requests that did not match any route.
app.use(notFound);

// Centralized error handler (must be last).
app.use(errorHandler);

export default app;