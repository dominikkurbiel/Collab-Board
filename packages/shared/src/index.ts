export const APP_NAME = "Collab Board";

export interface HealthResponse {
  status: "ok";
  service: string;
  uptime: number;
  timestamp: string;
}
