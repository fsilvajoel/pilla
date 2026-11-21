import { dashboardTodayResponse, type DashboardTodayResponse } from "@pilla/schemas";
import { apiFetch } from "./client";

/** GET /dashboard/today (RF-50): parcelas de hoje, da semana e atrasadas, calculadas em Brasília. */
export function getDashboardToday(): Promise<DashboardTodayResponse> {
  return apiFetch({ path: "/dashboard/today", schema: dashboardTodayResponse });
}
