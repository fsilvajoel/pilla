/** Ator da requisição (E14 D1): só ADMIN no MVP; lido no controller por `@CurrentActor()`. */
export type RequestActor = { type: "ADMIN"; adminUserId: string; ip: string | null };
