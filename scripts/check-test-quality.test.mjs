import assert from "node:assert/strict";
import { test } from "node:test";
import { checkTestQuality } from "./check-test-quality.mjs";

const rules = (src) => checkTestQuality(src).map((p) => / (Q\d) /.exec(p)[1]);
const wrap = (body) => `describe("f", () => {\n${body}\n});\n`;

test("teste bom passa: propriedades, erros e valores da fonte", () => {
  const src = wrap(`
  it.each([1, 2, 999])("valida para %i", (seed) => {
    expect(cpfSchema.safeParse(fakeCpf(seed)).success).toBe(true);
  });
  it.each([-1, 1.5, NaN])("lança para %s", (seed) => {
    expect(() => fakeCpf(seed)).toThrow(RangeError);
  });
  it("devolve o mesmo valor", () => {
    expect(fakeCpf(42)).toBe(fakeCpf(42));
  });
  it("soma fecha", () => {
    expect(total % step).toBe(0);
  });`);
  assert.deepEqual(rules(src), []);
});

test("Q1 asserção que sempre passa", () => {
  assert.deepEqual(rules(wrap(`it("a", () => { expect(r).toBeInstanceOf(Object); });`)), ["Q1"]);
  assert.deepEqual(rules(wrap(`it("a", () => { expect(f(1)).toBeDefined(); });`)), ["Q1"]);
  assert.deepEqual(rules(wrap(`it("a", () => { expect(true).toBe(true); });`)), ["Q1"]);
  assert.deepEqual(rules(wrap(`it("a", () => { expect(x).toBe(x); });`)), ["Q1"]);
  assert.deepEqual(rules(wrap(`it("a", async () => { await request(app).get("/x").expect(200); });`)), []);
});

test("Q2 teste sem expect", () => {
  assert.deepEqual(rules(wrap(`it("a", async () => { await add(1); });`)), ["Q2"]);
});

test("Q3 safeParse sem .success", () => {
  assert.deepEqual(rules(wrap(`it("a", () => { const r = s.safeParse(v); expect(r).toMatchObject({}); });`)), ["Q3"]);
});

test("Q4 teste refaz o algoritmo", () => {
  assert.deepEqual(rules(wrap(`it("a", () => { expect(f(1)).toBe(String(1).padStart(9, "0")); });`)), ["Q4"]);
  assert.deepEqual(rules(wrap(`it("a", () => { expect(f(s)).toBe(s + "91"); });`)), ["Q4"]);
  assert.deepEqual(rules(wrap(`it("a", () => { expect(d.charCodeAt(0)).toBe(48); });`)), ["Q4"]);
});

test("Q5 a mesma entrada lança e devolve (o caso do E4-T01)", () => {
  const src = wrap(`
  it.each([0, 1, 2])("devolve para %i", (seed) => {
    expect(fakeCpf(seed)).toMatch(/^\\d{11}$/);
  });
  it.each([0, 111111111])("lança para %i", (seed) => {
    expect(() => fakeCpf(seed)).toThrow(RangeError);
  });`);
  assert.deepEqual(rules(src), ["Q5"]);
  const direct = wrap(`
  it("a", () => { expect(fakeCpf(1_000)).toMatch(/x/); });
  it("b", () => { expect(() => fakeCpf(1000)).toThrow(); });`);
  assert.deepEqual(rules(direct), ["Q5"]);
});

test("texto e comentário não contam como código", () => {
  const src = wrap(`it("usa padStart e toBeDefined() no título", () => {
    // expect(x).toBeInstanceOf(Object)
    expect(f("a % b + 'c'")).toBe("ok");
  });`);
  assert.deepEqual(rules(src), []);
});
