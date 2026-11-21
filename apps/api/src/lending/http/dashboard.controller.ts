import { Controller, Get, Inject } from "@nestjs/common";
import type { DashboardTodayResponse } from "@pilla/schemas";
import { DashboardService } from "../application/dashboard-service";

// Só delega: o agrupamento mora em application/dashboard-today.ts.
@Controller("dashboard")
export class DashboardController {
  private readonly service: DashboardService;

  constructor(@Inject(DashboardService) service: DashboardService) {
    this.service = service;
  }

  @Get("today")
  today(): Promise<DashboardTodayResponse> {
    return this.service.today();
  }
}
