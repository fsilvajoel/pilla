import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { clientIp, type ClientRequest } from "./client-ip";

// Limite de tentativas do login por IP do cliente (E14 D6, D7), não pelo IP do Next.
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: ClientRequest): Promise<string> {
    return Promise.resolve(clientIp(request));
  }
}
