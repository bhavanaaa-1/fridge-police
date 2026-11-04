// Centralized error-handling middleware.
// Must be registered last in app.js so it can catch errors
// forwarded via next(err) from any route or middleware.

const errorHandler = (err, req, res, _next) => {
  // Log the full error on the server for debugging (never to clients).
  console.error(err);

  // Handle Zod validation errors as HTTP 400.
  if (err?.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
      errors: err.errors,
    });
  }

  const statusCode = err?.statusCode || err?.status || 500;

  // Avoid leaking internal error messages for unexpected errors.
  const message =
    statusCode === 500 ? "Internal server error" : err?.message || "Something went wrong";

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorHandler;