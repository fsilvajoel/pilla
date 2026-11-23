import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from "@nestjs/common";
import {
  accountEntryRequest,
  accountStatementQuery,
  idSchema,
  type AccountEntryRequest,
  type AccountEntryResponse,
  type AccountListResponse,
  type AccountStatementQuery,
  type AccountStatementResponse,
} from "@pilla/schemas";
import { z } from "zod";
import { ProblemException } from "../../core/http/problem-exception";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
import { DATABASE, type Database } from "../../db/database";
import { accountStatement } from "../application/account-statement";
import { createAccountEntry } from "../application/create-account-entry";
import { listAccountSummaries } from "../application/list-accounts";

const idempotencyKeySchema = z.string().min(1).max(200).optional();

function idempotencyKeyOf(header: string | undefined): string | undefined {
  const key = idempotencyKeySchema.safeParse(header);
  if (!key.success) {
    throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
      { field: "Idempotency-Key", message: "Use de 1 a 200 caracteres." },
    ]);
  }
  return key.data;
}

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

  /** Aporte, retirada ou ajuste (RF-30); `Idempotency-Key` opcional repete o mesmo lançamento. */
  @Post(":id/entries")
  createEntry(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe<AccountEntryRequest>(accountEntryRequest)) body: AccountEntryRequest,
  ): Promise<AccountEntryResponse> {
    return createAccountEntry(this.db, id, body, idempotencyKeyOf(idempotencyKey), new Date());
  }

  @Get(":id/entries")
  entries(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Query(new ZodValidationPipe<AccountStatementQuery>(accountStatementQuery)) query: AccountStatementQuery,
  ): Promise<AccountStatementResponse> {
    return accountStatement(this.db, id, query);
  }
}
