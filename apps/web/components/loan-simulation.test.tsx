import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isoDate } from "@pilla/finance";
import { LoanSimulation } from "./loan-simulation";

// Contrato e valores: docs/plano/E6-F02/plano.md (A1 a A3, C1 a C9).
interface SimulationInput {
  readonly amount: string;
  readonly monthlyRate: string;
  readonly installmentCount: string;
  readonly frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY";
  readonly firstDueDate: string;
}

const disbursementDate = isoDate("2026-11-14");

// Exemplo da RFC-004 §5.
const rfcExample: SimulationInput = {
  amount: "5.000,00",
  monthlyRate: "6,33",
  installmentCount: "6",
  frequency: "MONTHLY",
  firstDueDate: "2026-12-14",
};

// PRD-001 CA-11.
const ca11Example: SimulationInput = {
  amount: "1.000,00",
  monthlyRate: "10,00",
  installmentCount: "4",
  frequency: "WEEKLY",
  firstDueDate: "2026-11-21",
};

const ALERT_TEXT = "Confira os campos da simulação.";

function fillAndSubmit(input: SimulationInput): void {
  fireEvent.change(screen.getByLabelText("Valor emprestado"), { target: { value: input.amount } });
  fireEvent.change(screen.getByLabelText("Taxa ao mês (%)"), { target: { value: input.monthlyRate } });
  fireEvent.change(screen.getByLabelText("Nº de parcelas"), { target: { value: input.installmentCount } });
  fireEvent.change(screen.getByLabelText("Periodicidade"), { target: { value: input.frequency } });
  fireEvent.change(screen.getByLabelText("1º vencimento"), { target: { value: input.firstDueDate } });
  fireEvent.click(screen.getByRole("button", { name: "Simular" }));
}

function simulateWith(input: SimulationInput): void {
  render(<LoanSimulation disbursementDate={disbursementDate} />);
  fillAndSubmit(input);
}

function texts(elements: readonly HTMLElement[]): string[] {
  return elements.map((element) => element.textContent);
}

/** Linhas com células de dados (exclui a linha de cabeçalho). */
function dataRows(table: HTMLElement): HTMLElement[] {
  return within(table)
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("cell").length > 0);
}

/** Pares [rótulo, valor] do resumo: cada `<dt>` (role term) com o `<dd>` logo depois, no mesmo `<dl>`. */
async function summaryPairs(): Promise<[string, string | null][]> {
  const terms = await screen.findAllByRole("term");
  return terms.map((term) => {
    const next = term.nextElementSibling;
    const value =
      next !== null && next.tagName === "DD" && term.parentElement?.tagName === "DL" ? next.textContent : null;
    return [term.textContent, value];
  });
}

/** Texto do alerta e se sobrou algum resultado (resumo ou tabela) na tela. */
async function alertOutcome(): Promise<{ alert: string; hasSummary: boolean; hasTable: boolean }> {
  const alert = await screen.findByRole("alert");
  return {
    alert: alert.textContent,
    hasSummary: screen.queryByText("Total a receber") !== null,
    hasTable: screen.queryByRole("table") !== null,
  };
}

const ALERT_ONLY = { alert: ALERT_TEXT, hasSummary: false, hasTable: false };

describe("LoanSimulation", () => {
  it("C1 (A1): shows the five labelled fields, the four frequency options and the Simular button", () => {
    render(<LoanSimulation disbursementDate={disbursementDate} />);

    expect(screen.getByLabelText("Valor emprestado")).toBeInTheDocument();
    expect(screen.getByLabelText("Taxa ao mês (%)")).toBeInTheDocument();
    expect(screen.getByLabelText("Nº de parcelas")).toBeInTheDocument();
    expect(screen.getByLabelText("1º vencimento")).toHaveAttribute("type", "date");

    const frequency = screen.getByLabelText("Periodicidade");
    expect(frequency.tagName).toBe("SELECT");
    const options = within(frequency).getAllByRole<HTMLOptionElement>("option");
    expect(texts(options)).toEqual(["Semanal", "Quinzenal", "Mensal", "Bimestral"]);
    expect(options.map((option) => option.value)).toEqual(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY"]);

    expect(screen.getByRole("button", { name: "Simular" })).toBeInTheDocument();
  });

  it("C2 (A2): RFC-004 §5 example shows R$ 6.900,00, R$ 1.900,00 and 6 × R$ 1.150,00", async () => {
    simulateWith(rfcExample);

    expect(await summaryPairs()).toEqual([
      ["Total a receber", "R$ 6.900,00"],
      ["Juros", "R$ 1.900,00"],
      ["Parcela", "6 × R$ 1.150,00"],
    ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("C3 (A2): RFC-004 §5 example shows 6 rows and the first is 1, 14/12/2026, 833,33, 316,67, 1.150,00", async () => {
    simulateWith(rfcExample);

    const table = await screen.findByRole("table");
    expect(texts(within(table).getAllByRole("columnheader"))).toEqual([
      "Nº",
      "Vencimento",
      "Principal",
      "Juros",
      "Parcela",
    ]);

    const rows = dataRows(table);
    expect(rows).toHaveLength(6);
    const [firstRow] = rows;
    if (firstRow === undefined) throw new Error("tabela sem linhas");
    expect(texts(within(firstRow).getAllByRole("cell"))).toEqual(["1", "14/12/2026", "833,33", "316,67", "1.150,00"]);
  });

  it("C4 (A2): CA-11 shows 4 × R$ 275,00 and R$ 1.100,00", async () => {
    simulateWith(ca11Example);

    // O plano (A2) fixa só o total e a parcela do CA-11; os juros não são conferidos aqui.
    const pairs = new Map(await summaryPairs());
    expect([...pairs.keys()]).toEqual(["Total a receber", "Juros", "Parcela"]);
    expect(pairs.get("Total a receber")).toBe("R$ 1.100,00");
    expect(pairs.get("Parcela")).toBe("4 × R$ 275,00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("C5 (A3): amount 5000 without comma shows the alert and no result", async () => {
    simulateWith({ ...rfcExample, amount: "5000" });

    expect(await alertOutcome()).toEqual(ALERT_ONLY);
  });

  it("C6 (A3): rate 6 without comma shows the alert and no result", async () => {
    simulateWith({ ...rfcExample, monthlyRate: "6" });

    expect(await alertOutcome()).toEqual(ALERT_ONLY);
  });

  it("C7 (A3): installment count 0 shows the alert and no result", async () => {
    simulateWith({ ...rfcExample, installmentCount: "0" });

    expect(await alertOutcome()).toEqual(ALERT_ONLY);
  });

  it("C8 (A3): first due date equal to disbursement date shows the alert", async () => {
    simulateWith({ ...rfcExample, firstDueDate: "2026-11-14" });

    expect(await alertOutcome()).toEqual(ALERT_ONLY);
  });

  it("C9 (A3): empty first due date shows the alert", async () => {
    simulateWith({ ...rfcExample, firstDueDate: "" });

    expect(await alertOutcome()).toEqual(ALERT_ONLY);
  });
});
