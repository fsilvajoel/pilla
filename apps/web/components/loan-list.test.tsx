import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { exampleLoanListItem, paidOffLoanListItem } from "@/lib/mock-data";
import { LoanList } from "./loan-list";

describe("LoanList", () => {
  it("shows the RFC-004 loan", () => {
    render(<LoanList loans={[exampleLoanListItem]} />);

    expect(screen.getByRole("columnheader", { name: "Contrato" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Cliente" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Valor emprestado" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Saldo devedor" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Próximo vencimento" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Situação" })).toBeInTheDocument();

    const row = screen.getByRole("row", { name: /2026-0012/ });
    const cells = within(row);

    const link = cells.getByRole("link", { name: "2026-0012" });
    expect(link).toHaveAttribute("href", "/emprestimos/01936f8e-7b2c-7cde-8f00-000000000002");
    expect(cells.getByText("Maria da Silva")).toBeInTheDocument();
    expect(cells.getByText("R$ 5.000,00")).toBeInTheDocument();
    expect(cells.getByText("R$ 4.600,00")).toBeInTheDocument();
    expect(cells.getByText("14/02/2027")).toBeInTheDocument();
    expect(cells.getByText("Em dia")).toBeInTheDocument();
  });

  it("shows a closed loan", () => {
    render(<LoanList loans={[exampleLoanListItem, paidOffLoanListItem]} />);

    const row = screen.getByRole("row", { name: /2026-0003/ });
    const cells = within(row);

    expect(cells.getByText("Quitado")).toBeInTheDocument();
    expect(cells.getByText("R$ 2.000,00")).toBeInTheDocument();
    expect(cells.getByText("R$ 0,00")).toBeInTheDocument();
    expect(cells.getByText("—")).toBeInTheDocument();
  });

  it("shows an empty list", () => {
    render(<LoanList loans={[]} />);

    expect(screen.getByText("Nenhum contrato.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    const newLink = screen.getByRole("link", { name: "Novo contrato" });
    expect(newLink).toHaveAttribute("href", "/emprestimos/novo");
  });
});
