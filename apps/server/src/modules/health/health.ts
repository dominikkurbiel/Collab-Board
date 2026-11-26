export function getHealth() {
  return {
    status: "ok" as const,
    service: "collab-board-server",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}
