import jwt from "jsonwebtoken";

// Create a signed JWT whose subject is the user's ID.
export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

// Verify a JWT and return its payload. Throws on invalid/expired tokens.
export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
}