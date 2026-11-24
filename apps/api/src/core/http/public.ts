import { SetMetadata, type CustomDecorator } from "@nestjs/common";

/** Metadado lido pelo guard global (E14 D7): rota marcada não exige sessão. */
export const IS_PUBLIC = "pilla:isPublic";

/** Rota aberta, sem sessão ADMIN (E14 D7): só health, OpenAPI e login. */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC, true);
