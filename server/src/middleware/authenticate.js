import { verifyToken } from "../utils/token.js";

// Verifies a Bearer JWT and attaches the user ID to req.user.
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const payload = verifyToken(token);

    if (!payload.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    req.user = { id: payload.sub };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Optional auth: populates req.user if valid token provided, but doesn't reject if not.
export const optionalAuthenticate = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    req.user = null;
    return next();
  }

  try {
    const payload = verifyToken(token);
    if (payload?.sub) {
      req.user = { id: payload.sub };
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
};

export default authenticate;