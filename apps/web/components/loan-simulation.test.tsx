import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isoDate } from "@pilla/finance";
import { LoanSimulation } from "./loan-simulation";

describe("LoanSimulation", () => {
  const disbursementDate = isoDate("2026-11-14");

  function fillAndSubmit(values: {
    amount: string;
    monthlyRate: string;
    installmentCount: string;
    frequency: string;
    firstDueDate: string;
  }) {
    fireEvent.change(screen.getByLabelText("Valor emprestado"), {
      target: { value: values.amount },
    });
    fireEvent.change(screen.getByLabelText("Taxa ao mês (%)"), {
      target: { value: values.monthlyRate },
    });
    fireEvent.change(screen.getByLabelText("Nº de parcelas"), {
      target: { value: values.installmentCount },
    });
    fireEvent.change(screen.getByLabelText("Periodicidade"), {
      target: { value: values.frequency },
    });
    fireEvent.change(screen.getByLabelText("1º vencimento"), {
      target: { value: values.firstDueDate },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simular" }));
  }

  it("shows inputs labelled Valor emprestado, Taxa ao mês (%), Nº de parcelas, Periodicidade, 1º vencimento and a button Simular", () => {
    render(<LoanSimulation disbursementDate={disbursementDate} />);

    expect(screen.getByLabelText("Valor emprestado")).toBeInTheDocument();
    expect(screen.getByLabelText("Taxa ao mês (%)")).toBeInTheDocument();
    expect(screen.getByLabelText("Nº de parcelas")).toBeInTheDocument();
    expect(screen.getByLabelText("Periodicidade")).toBeInTheDocument();
    expect(screen.getByLabelText("1º vencimento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simular" })).toBeInTheDocument();
  });

  it("shows Total a receber, Juros and Parcela for the RFC-004 §5 example", async () => {
    render(<LoanSimulation disbursementDate={disbursementDate} />);

    fillAndSubmit({
      amount: "5.000,00",
      monthlyRate: "6,33",
      installmentCount: "6",
      frequency: "MONTHLY",
      firstDueDate: "2026-12-14",
    });

    expect(await screen.findByText("R$ 6.900,00")).toBeInTheDocument();
    expect(await screen.findByText("R$ 1.900,00")).toBeInTheDocument();
    expect(await screen.findByText("6 × R$ 1.150,00")).toBeInTheDocument();
  });

  it("shows the first installment row with 14/12/2026, 833,33, 316,67 and 1.150,00", async () => {
    render(<LoanSimulation disbursementDate={disbursementDate} />);

    fillAndSubmit({
      amount: "5.000,00",
      monthlyRate: "6,33",
      installmentCount: "6",
      frequency: "MONTHLY",
      firstDueDate: "2026-12-14",
    });

    const row = await screen.findByRole("row", { name: /14\/12\/2026/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("1");
    expect(cells[1]).toHaveTextContent("14/12/2026");
    expect(cells[2]).toHaveTextContent("833,33");
    expect(cells[3]).toHaveTextContent("316,67");
    expect(cells[4]).toHaveTextContent("1.150,00");
  });

  it("shows an alert when amount 5000 without comma is submitted", async () => {
    render(<LoanSimulation disbursementDate={disbursementDate} />);

    fillAndSubmit({
      amount: "5000",
      monthlyRate: "6,33",
      installmentCount: "6",
      frequency: "MONTHLY",
      firstDueDate: "2026-12-14",
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Confira os campos da simulação.");
  });
});
