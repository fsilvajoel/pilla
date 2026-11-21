import { Controller, Get, Inject } from "@nestjs/common";
import type { AccountListResponse } from "@pilla/schemas";
import { DATABASE, type Database } from "../../db/database";
import { listAccountSummaries } from "../application/list-accounts";

@Controller("accounts")
export class AccountsController {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  @Get()
  list(): Promise<AccountListResponse> {
    return listAccountSummaries(this.db);
  }
}
