import { describe, expect, it } from "vitest";
import { newId, uuidV7 } from "./ids";

describe("uuidV7", () => {
  it("gives the RFC 9562 A.6 vector", () => {
    const unixMs = 1645557742000;
    const random = Uint8Array.of(0x7c, 0xc3, 0x98, 0xc4, 0xdc, 0x0c, 0x0c, 0x07, 0x39, 0x8f);
    expect(uuidV7(unixMs, random)).toEqual("017f22e2-79b0-7cc3-98c4-dc0c0c07398f");
  });

  it("gives the zero lower bound", () => {
    const unixMs = 0;
    const random = new Uint8Array(10);
    expect(uuidV7(unixMs, random)).toEqual("00000000-0000-7000-8000-000000000000");
  });

  it("gives the max upper bound", () => {
    const unixMs = 281474976710655;
    const random = new Uint8Array(10).fill(0xff);
    expect(uuidV7(unixMs, random)).toEqual("ffffffff-ffff-7fff-bfff-ffffffffffff");
  });

  it("throws RangeError for random length 9", () => {
    const random = new Uint8Array(9);
    expect(() => uuidV7(0, random)).toThrow(RangeError);
  });

  it("throws RangeError for random length 11", () => {
    const random = new Uint8Array(11);
    expect(() => uuidV7(0, random)).toThrow(RangeError);
  });

  it("throws RangeError for unixMs -1", () => {
    const random = new Uint8Array(10);
    expect(() => uuidV7(-1, random)).toThrow(RangeError);
  });

  it("throws RangeError for unixMs 1.5", () => {
    const random = new Uint8Array(10);
    expect(() => uuidV7(1.5, random)).toThrow(RangeError);
  });

  it("throws RangeError for unixMs 281474976710656", () => {
    const random = new Uint8Array(10);
    expect(() => uuidV7(281474976710656, random)).toThrow(RangeError);
  });
});

describe("newId", () => {
  it("matches UUID v7 pattern and two calls differ", () => {
    const id1 = newId();
    const id2 = newId();
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id1).not.toEqual(id2);
  });

  it("time in first 12 hex digits is between Date.now before and after", () => {
    const before = Date.now();
    const id = newId();
    const after = Date.now();
    const hexTime = id.slice(0, 12);
    const time = parseInt(hexTime, 16);
    expect(time).toBeGreaterThanOrEqual(before);
    expect(time).toBeLessThanOrEqual(after);
  });
});
