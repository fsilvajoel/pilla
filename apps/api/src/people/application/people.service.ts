import { Inject, Injectable } from "@nestjs/common";
import type {
  CreatePersonRequest,
  PersonListQuery,
  PersonListResponse,
  PersonResponse,
  UpdatePersonRequest,
} from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import { newId } from "../../core/public/ids";
import { DATABASE, type Database } from "../../db/database";
import { listPersons } from "../infra/person-list";
import { findPersonById, insertPerson, type NewPersonRow } from "../infra/person-repository";
import { updatePerson, type PersonChanges } from "../infra/person-update";
import { personWriteErrorCode } from "../infra/person-write-error";
import type { PersonRow } from "../infra/schema";

const NOT_FOUND_DETAIL = "Recurso não encontrado.";

function toResponse(row: PersonRow): PersonResponse {
  return {
    id: row.id,
    fullName: row.fullName,
    cpf: row.cpf,
    phone: row.phone,
    ...(row.email === null ? {} : { email: row.email }),
    ...(row.birthDate === null ? {} : { birthDate: row.birthDate }),
    ...(row.notes === null ? {} : { notes: row.notes }),
    active: row.active,
    version: row.version,
  };
}

function writeError(error: unknown): unknown {
  const code = personWriteErrorCode(error);
  if (code === "DUPLICATE_CPF") return new ProblemException("DUPLICATE_CPF", "CPF já cadastrado.");
  if (code === "NOT_FOUND") return new ProblemException("NOT_FOUND", NOT_FOUND_DETAIL);
  return error;
}

function changesOf(request: UpdatePersonRequest): PersonChanges {
  return Object.fromEntries(Object.entries(request).filter(([key, value]) => key !== "version" && value !== undefined));
}

// Regras de pessoa (RF-01 a RF-04); o banco fica nos repositórios de infra.
@Injectable()
export class PeopleService {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  async create(request: CreatePersonRequest): Promise<PersonResponse> {
    const row: NewPersonRow = {
      id: newId(),
      fullName: request.fullName,
      cpf: request.cpf,
      phone: request.phone,
      ...(request.email === undefined ? {} : { email: request.email }),
      ...(request.birthDate === undefined ? {} : { birthDate: request.birthDate }),
      ...(request.referredById === undefined ? {} : { referredById: request.referredById }),
      ...(request.notes === undefined ? {} : { notes: request.notes }),
    };
    try {
      await insertPerson(this.db, row);
    } catch (error) {
      throw writeError(error);
    }
    return this.get(row.id);
  }

  async list(query: PersonListQuery): Promise<PersonListResponse> {
    try {
      const page = await listPersons(this.db, {
        search: query.search ?? "",
        limit: query.limit,
        cursor: query.cursor ?? null,
        active: null,
      });
      return page;
    } catch (error) {
      if (error instanceof Error && error.message === "invalid cursor") {
        throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
          { field: "cursor", message: "Cursor inválido." },
        ]);
      }
      throw error;
    }
  }

  async get(id: string): Promise<PersonResponse> {
    const row = await findPersonById(this.db, id);
    if (row === null) throw new ProblemException("NOT_FOUND", NOT_FOUND_DETAIL);
    return toResponse(row);
  }

  async update(id: string, request: UpdatePersonRequest): Promise<PersonResponse> {
    let result;
    try {
      result = await updatePerson(this.db, id, request.version, changesOf(request));
    } catch (error) {
      throw writeError(error);
    }
    if (result === "NOT_FOUND") throw new ProblemException("NOT_FOUND", NOT_FOUND_DETAIL);
    if (result === "VERSION_CONFLICT") throw new ProblemException("VERSION_CONFLICT", "Versão desatualizada.");
    return this.get(id);
  }
}
