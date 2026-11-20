// Portão de qualidade de teste (e4-guardrails F). Teste serve para barrar defeito: ele precisa ser possível
// (sem contradição) e afirmar algo (sem asserção vazia), sem refazer o algoritmo do código.
// Vale para todo teste (pre-commit e pnpm check:tests).
// Regras:
//   Q1 asserção que sempre passa: toBeInstanceOf(Object), toBeDefined(), expect(true|false|literal), expect(x).toBe(x)
//   Q2 teste sem nenhum expect
//   Q3 safeParse sem conferir .success (o resultado de safeParse é sempre um objeto)
//   Q4 teste refaz o algoritmo: padStart ou charCodeAt no corpo, ou valor esperado montado com "texto" + x
//      (% fica de fora: teste de propriedade usa, ex.: "múltiplo do passo")
//   Q5 contradição: a mesma entrada literal da mesma função ora lança erro, ora devolve valor
// Uso: node scripts/check-test-quality.mjs <arquivo.test.ts>...
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Troca o conteúdo de strings e comentários por espaço, mantendo posições (para achar código, não texto). */
export function blank(src) {
  let out = "";
  for (let i = 0; i < src.length;) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    if (two === "//" || two === "/*") {
      const end = two === "//" ? src.indexOf("\n", i) : src.indexOf("*/", i) + 2;
      const stop = end <= 0 || end === 1 ? src.length : end;
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += c + src.slice(i + 1, j).replace(/[^\n]/g, "_") + c;
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Índice do fechamento que casa com a abertura em `open`. */
function closing(code, open) {
  const pair = { "(": ")", "[": "]", "{": "}" }[code[open]];
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === code[open]) depth++;
    else if (code[i] === pair && --depth === 0) return i;
  }
  return code.length - 1;
}

/** Elementos de topo de um array literal, só se forem números ou strings simples. */
function literals(text) {
  const inner = text.trim().replace(/^\[|\]$/g, "");
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of inner) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.every((p) => LITERAL.test(p)) ? parts.map(norm) : [];
}
const LITERAL = /^(?:-?[\d_.]+(?:e\d+)?|NaN|Infinity|-Infinity|"[^"]*"|'[^']*')$/;
const norm = (s) => s.replace(/_/g, "").replace(/^'(.*)'$/, '"$1"');
const lineOf = (src, i) => src.slice(0, i).split("\n").length;

/** Blocos it/test: título, corpo e, em it.each, os elementos literais e o nome do parâmetro. */
export function blocks(src) {
  const code = blank(src);
  const out = [];
  const head = /\b(?:it|test)(?:\.(?:only|skip|concurrent))?(\.each)?\s*\(/g;
  for (let m; (m = head.exec(code));) {
    let open = m.index + m[0].length - 1;
    let each = [];
    if (m[1]) {
      const close = closing(code, open);
      each = literals(src.slice(open + 1, close));
      open = code.indexOf("(", close + 1);
      if (open < 0) continue;
    }
    const close = closing(code, open);
    const args = code.slice(open + 1, close);
    const fn = /,\s*(?:async\s*)?(?:\(([^)]*)\)|(\w+))\s*=>/.exec(args);
    if (!fn) continue;
    const param = (fn[1] ?? fn[2] ?? "")
      .split(",")[0]
      .replace(/[{}[\]\s]/g, "")
      .split(":")[0];
    const bodyStart = open + 1 + fn.index + fn[0].length;
    out.push({
      line: lineOf(src, m.index),
      code: code.slice(bodyStart, close),
      src: src.slice(bodyStart, close),
      each,
      param,
    });
  }
  return out;
}

/** Lista de problemas do arquivo, cada um com a regra (Q1–Q5) e a linha. */
export function checkTestQuality(src, file = "teste") {
  const problems = [];
  const seen = new Set();
  const add = (rule, line, msg) => {
    if (seen.has(`${rule}:${String(line)}`)) return; // uma vez por regra e teste
    seen.add(`${rule}:${String(line)}`);
    problems.push(`${file}:${String(line)} ${rule} ${msg}`);
  };
  const throwsBy = new Map();
  const returnsBy = new Map();
  const note = (map, fn, arg, line) => {
    if (!map.has(fn)) map.set(fn, new Map());
    if (!map.get(fn).has(arg)) map.get(fn).set(arg, line);
  };
  for (const b of blocks(src)) {
    const { code, line } = b;
    if (!/\bexpect(?:TypeOf)?\s*\(/.test(code)) add("Q2", line, "teste sem expect: não barra nada");
    for (const [re, what] of [
      [/\.toBeInstanceOf\(\s*Object\s*\)/, "toBeInstanceOf(Object)"],
      [/\.toBeDefined\(\s*\)/, "toBeDefined()"],
      [/(?<![.\w])expect\(\s*(?:true|false|null|undefined|-?\d[\d_.]*)\s*\)/, "expect(<literal>)"],
    ])
      if (re.test(code)) add("Q1", line, `${what} sempre passa: afirme o valor ou a propriedade esperada`);
    for (const m of code.matchAll(/\bexpect\(\s*([\w.]+)\s*\)\s*\.(?:toBe|toEqual|toStrictEqual)\(\s*([\w.]+)\s*\)/g))
      if (m[1] === m[2]) add("Q1", line, `expect(${m[1]}).toBe(${m[2]}) compara o valor com ele mesmo`);
    if (/\.safeParse\(/.test(code) && !/\.success\b|\.error\b|\bsuccess\s*:/.test(code))
      add("Q3", line, "safeParse sem conferir .success: o resultado é sempre um objeto");
    for (const [re, what] of [
      [/\.padStart\(/, "padStart"],
      [/\.charCodeAt\(/, "charCodeAt"],
    ])
      if (re.test(code))
        add("Q4", line, `${what} no teste: o teste refaz o algoritmo; afirme propriedades ou valores da fonte`);
    for (const m of code.matchAll(/\.(?:toBe|toEqual|toStrictEqual)\(/g)) {
      const open = m.index + m[0].length - 1;
      const arg = code.slice(open + 1, closing(code, open));
      if (/["'`]\s*\+|\+\s*["'`]/.test(arg))
        add("Q4", line, "valor esperado montado com texto + variável: é o código de novo");
    }
    // Q5: quem lança e quem devolve, por função e entrada literal
    const throws = /\.toThrow(?:Error)?\(/.test(code);
    if (b.each.length && b.param) {
      for (const m of code.matchAll(new RegExp(`\\b(\\w+)\\(\\s*${b.param}\\s*\\)`, "g")))
        for (const v of b.each) note(throws ? throwsBy : returnsBy, m[1], v, line);
    }
    for (const m of b.src.matchAll(/\(\s*\)\s*=>\s*(\w+)\(\s*([^(),]+?)\s*\)\s*\)\s*\.toThrow/g))
      if (LITERAL.test(m[2])) note(throwsBy, m[1], norm(m[2]), line);
    for (const m of b.src.matchAll(/\bexpect\(\s*(\w+)\(\s*([^(),]+?)\s*\)\s*\)\s*\.(?!toThrow|not\.toThrow)/g))
      if (LITERAL.test(m[2])) note(returnsBy, m[1], norm(m[2]), line);
  }
  for (const [fn, args] of throwsBy)
    for (const [arg, line] of args) {
      const other = returnsBy.get(fn)?.get(arg);
      if (other !== undefined)
        add(
          "Q5",
          line,
          `${fn}(${arg}) lança erro aqui e devolve valor na linha ${String(other)}: o teste é impossível`,
        );
    }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const files = process.argv.slice(2);
  if (!files.length) {
    process.stderr.write("uso: node scripts/check-test-quality.mjs <arquivo.test.ts>...\n");
    process.exit(2);
  }
  const problems = files.flatMap((f) => checkTestQuality(readFileSync(f, "utf8"), f));
  if (problems.length) {
    process.stderr.write(problems.join("\n") + "\n");
    process.exit(1);
  }
  process.stdout.write(`qualidade de teste ok: ${String(files.length)} arquivo(s)\n`);
}
