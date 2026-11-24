import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from "@nestjs/throttler";
import { clientIp, type ClientRequest } from "./client-ip";

// Limite de tentativas do login por IP do cliente (E14 D6, D7), não pelo IP do Next.
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  // Injeção explícita: o runtime com tsx não emite decorator metadata, então o construtor herdado não resolve por tipo.
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected override getTracker(request: ClientRequest): Promise<string> {
    return Promise.resolve(clientIp(request));
  }
}
