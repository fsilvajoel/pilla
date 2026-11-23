import { uuidV7 } from "../../core/public/ids";

let lastMs = 0;

/**
 * UUID v7 monotônico no processo (RFC 9562 §6.2): dois ids pedidos no mesmo milissegundo (ou com o relógio
 * parado) saem em ordem crescente, para a ordem do id refletir a ordem de gravação.
 */
export function nextId(nowMs: number = Date.now()): string {
  lastMs = Math.max(nowMs, lastMs + 1);
  return uuidV7(lastMs, crypto.getRandomValues(new Uint8Array(10)));
}
