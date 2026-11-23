import { createParamDecorator } from "@nestjs/common";
import type { RequestActor } from "../public/actor";

// Esboço (E14-T05): só para os testes compilarem; a implementação é a E14-T06.
export const CurrentActor = createParamDecorator((): RequestActor | undefined => undefined);
