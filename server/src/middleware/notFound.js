// Middleware for unknown routes.
// Runs after all valid routes have been checked, so any request
// reaching here did not match a defined endpoint.

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
};

export default notFound;