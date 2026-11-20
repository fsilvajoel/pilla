import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { mockDefaultTerms, mockPeople } from "@/lib/mock-data";
import { NewLoanForm } from "./new-loan-form";

const request = {
  personId: "01936f8e-7b2c-7cde-8f00-000000000001",
  type: "INSTALLMENT",
  principalCents: 500000,
  monthlyInterestRateBps: 633,
  installmentCount: 6,
  frequency: { unit: "MONTH", interval: 1 },
  firstDueDate: "2026-12-14",
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
};

function fillExample(): void {
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "01936f8e-7b2c-7cde-8f00-000000000001" } });
  fireEvent.change(screen.getByLabelText("Valor emprestado"), { target: { value: "5.000,00" } });
  fireEvent.change(screen.getByLabelText("Nº de parcelas"), { target: { value: "6" } });
  fireEvent.change(screen.getByLabelText("1º vencimento"), { target: { value: "2026-12-14" } });
}

describe("NewLoanForm", () => {
  it("shows the labelled fields", () => {
    render(<NewLoanForm people={mockPeople} defaults={mockDefaultTerms} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Cliente")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor emprestado")).toBeInTheDocument();
    expect(screen.getByLabelText("Nº de parcelas")).toBeInTheDocument();
    expect(screen.getByLabelText("Periodicidade")).toBeInTheDocument();
    expect(screen.getByLabelText("1º vencimento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar contrato" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Conta")).toBeNull();
  });

  it("starts with the default terms", () => {
    render(<NewLoanForm people={mockPeople} defaults={mockDefaultTerms} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Taxa ao mês (%)")).toHaveValue("6,33");
    expect(screen.getByLabelText("Multa (%)")).toHaveValue("2,00");
    expect(screen.getByLabelText("Mora ao mês (%)")).toHaveValue("1,00");
    expect(screen.getByLabelText("Carência (dias)")).toHaveValue("0");
    expect(screen.getByLabelText("Periodicidade")).toHaveValue("MONTHLY");
    expect(screen.getByLabelText("Observações internas")).toHaveValue("");
  });

  it("creates the RFC-004 example", async () => {
    const onSubmit = vi.fn();
    render(<NewLoanForm people={mockPeople} defaults={mockDefaultTerms} onSubmit={onSubmit} />);

    fillExample();
    fireEvent.click(screen.getByRole("button", { name: "Criar contrato" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Contrato criado em rascunho.");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(request);
  });

  it("adjusts a default", async () => {
    const onSubmit = vi.fn();
    render(<NewLoanForm people={mockPeople} defaults={mockDefaultTerms} onSubmit={onSubmit} />);

    fillExample();
    fireEvent.change(screen.getByLabelText("Multa (%)"), { target: { value: "3,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar contrato" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Contrato criado em rascunho.");
    expect(onSubmit).toHaveBeenCalledWith({ ...request, lateFeeBps: 300 });
  });

  it("asks for the client", async () => {
    const onSubmit = vi.fn();
    render(<NewLoanForm people={mockPeople} defaults={mockDefaultTerms} onSubmit={onSubmit} />);

    fillExample();
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar contrato" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Confira os campos do contrato.");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
