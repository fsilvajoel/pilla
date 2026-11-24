import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
/** Sem endereço de conexão (socket já fechado): valor neutro aceito pela coluna inet. */
const UNKNOWN_IP = "0.0.0.0";

export type ClientRequest = Pick<IncomingMessage, "headers" | "socket">;

/**
 * IP do cliente (E14 D7): a API só escuta no loopback e confia em X-Forwarded-For apenas quando a conexão vem de lá
 * (o servidor do Next); vale o primeiro endereço da lista, se for um IP. Senão, o IP da conexão.
 */
export function clientIp(request: ClientRequest): string {
  const remote = request.socket.remoteAddress ?? UNKNOWN_IP;
  if (!LOOPBACK.has(remote)) return remote;
  const header = request.headers["x-forwarded-for"];
  const list = Array.isArray(header) ? header.join(",") : (header ?? "");
  const comma = list.indexOf(",");
  const first = (comma === -1 ? list : list.slice(0, comma)).trim();
  return isIP(first) === 0 ? remote : first;
}
