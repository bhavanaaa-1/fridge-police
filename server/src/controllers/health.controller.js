// Health check controller
// Returns a simple status payload so the frontend or uptime monitors
// can verify the API is alive.

export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    message: "FridgePolice API is running!",
  });
};

export default getHealth;