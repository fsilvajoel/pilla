import { Body, Controller, Delete, HttpCode, Inject, Param, Patch, Post, Res } from "@nestjs/common";
import {
  createPixKeyRequest,
  idSchema,
  updatePixKeyRequest,
  type PixKey,
  type CreatePixKeyRequest,
  type UpdatePixKeyRequest,
} from "@pilla/schemas";
import { PeopleValidationPipe } from "./people-validation.pipe";
import { ProblemException } from "../../core/http/problem-exception";
import { newId } from "../../core/public/ids";
import { DATABASE, type Database } from "../../db/database";
import { createPixKey, deletePixKey, updatePixKey } from "../application/pix-key-service";
import { pixKeyRepository, type PixKeyRepository } from "../infra/pix-key-repository";

type HeaderSetter = { setHeader(name: string, value: string): unknown };

const idPipe = new PeopleValidationPipe<string>(idSchema);

function notFound(): ProblemException {
  return new ProblemException("NOT_FOUND", "Recurso não encontrado.");
}

// Só valida a entrada e traduz HTTP; as regras de principal ficam em application/pix-key-service.
@Controller()
export class PixKeysController {
  private readonly repository: PixKeyRepository;

  constructor(@Inject(DATABASE) db: Database) {
    this.repository = pixKeyRepository(db);
  }

  @Post("people/:id/pix-keys")
  async create(
    @Param("id", idPipe) personId: string,
    @Body(new PeopleValidationPipe<CreatePixKeyRequest>(createPixKeyRequest)) body: CreatePixKeyRequest,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<PixKey> {
    const pixKey = await createPixKey(this.repository, personId, newId(), body);
    if (pixKey === null) throw notFound();
    response.setHeader("Location", `/api/v1/people/${personId}/pix-keys/${pixKey.id}`);
    return pixKey;
  }

  @Patch("pix-keys/:id")
  async update(
    @Param("id", idPipe) pixKeyId: string,
    @Body(new PeopleValidationPipe<UpdatePixKeyRequest>(updatePixKeyRequest)) body: UpdatePixKeyRequest,
  ): Promise<PixKey> {
    const pixKey = await updatePixKey(this.repository, pixKeyId, body);
    if (pixKey === null) throw notFound();
    return pixKey;
  }

  @Delete("pix-keys/:id")
  @HttpCode(204)
  async remove(@Param("id", idPipe) pixKeyId: string): Promise<void> {
    if (!(await deletePixKey(this.repository, pixKeyId))) throw notFound();
  }
}
