import type { IncomingHttpHeaders } from "node:http";
import type { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { clientIp, type ClientRequest } from "./client-ip";

// IP do cliente (E14 D7): X-Forwarded-For só vale quando a conexão vem do loopback.
function requestFrom(remoteAddress: string | undefined, headers: IncomingHttpHeaders = {}): ClientRequest {
  const socket = { remoteAddress } as Socket;
  return { headers, socket };
}

describe("clientIp", () => {
  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])(
    "from loopback %s takes the first X-Forwarded-For address",
    (lo) => {
      expect(clientIp(requestFrom(lo, { "x-forwarded-for": " 203.0.113.9 , 10.0.0.1" }))).toBe("203.0.113.9");
    },
  );

  it("joins a repeated X-Forwarded-For header and takes the first address", () => {
    const headers = { "x-forwarded-for": ["2001:db8::1", "10.0.0.1"] } as unknown as IncomingHttpHeaders;
    expect(clientIp(requestFrom("127.0.0.1", headers))).toBe("2001:db8::1");
  });

  it("from loopback without the header gives the connection address", () => {
    expect(clientIp(requestFrom("127.0.0.1"))).toBe("127.0.0.1");
  });

  it("from loopback with a header that is not an IP gives the connection address", () => {
    expect(clientIp(requestFrom("::1", { "x-forwarded-for": "evil, 203.0.113.9" }))).toBe("::1");
  });

  it("ignores X-Forwarded-For when the connection is not loopback", () => {
    expect(clientIp(requestFrom("198.51.100.4", { "x-forwarded-for": "203.0.113.9" }))).toBe("198.51.100.4");
  });

  it("without a connection address gives 0.0.0.0", () => {
    expect(clientIp(requestFrom(undefined, { "x-forwarded-for": "203.0.113.9" }))).toBe("0.0.0.0");
  });
});
