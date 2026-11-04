import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load Neon variables from the project root first, then local overrides.
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Fail safely if authentication is not configured securely.
const jwtSecret = process.env.JWT_SECRET;
if (
  !jwtSecret ||
  jwtSecret === "replace_with_a_long_random_secret" ||
  jwtSecret.length < 32
) {
  throw new Error(
    "JWT_SECRET is missing or insecure. Set a strong secret in .env.local."
  );
}
if (!process.env.JWT_EXPIRES_IN) {
  throw new Error("JWT_EXPIRES_IN is missing. Set it in .env.local.");
}

const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`FridgePolice server running on http://localhost:${PORT}`);
});