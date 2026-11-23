import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  accountStatementQuery,
  idSchema,
  type AccountListResponse,
  type AccountStatementQuery,
  type AccountStatementResponse,
} from "@pilla/schemas";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
import { DATABASE, type Database } from "../../db/database";
import { accountStatement } from "../application/account-statement";
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

  @Get(":id/entries")
  entries(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Query(new ZodValidationPipe<AccountStatementQuery>(accountStatementQuery)) query: AccountStatementQuery,
  ): Promise<AccountStatementResponse> {
    return accountStatement(this.db, id, query);
  }
}
