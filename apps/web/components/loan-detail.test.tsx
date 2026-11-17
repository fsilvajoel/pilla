import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { draftLoanDetail, exampleLoanDetail } from "@/lib/mock-data";
import { LoanDetail } from "./loan-detail";

describe("LoanDetail", () => {
  it("shows the summary", () => {
    render(<LoanDetail loan={exampleLoanDetail} />);

    expect(screen.getByRole("heading", { level: 1, name: "Contrato 2026-0012" })).toBeInTheDocument();
    expect(screen.getByText("R$ 5.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.900,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 6.900,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.300,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 4.600,00")).toBeInTheDocument();
  });

  it("shows the installments", () => {
    render(<LoanDetail loan={exampleLoanDetail} />);

    const row1 = screen.getByRole("row", { name: /14\/12\/2026/ });
    expect(within(row1).getByText("Paga")).toBeInTheDocument();

    const row3 = screen.getByRole("row", { name: /14\/02\/2027/ });
    const cells3 = within(row3);
    expect(cells3.getByText("1.150,00")).toBeInTheDocument();
    expect(cells3.getByText("Aberta")).toBeInTheDocument();
  });

  it("links the payment of an active loan", () => {
    render(<LoanDetail loan={exampleLoanDetail} />);

    const link = screen.getByRole("link", { name: "Registrar pagamento" });
    expect(link).toHaveAttribute("href", "/emprestimos/01936f8e-7b2c-7cde-8f00-000000000002/pagamento");
  });

  it("hides the payment link of a draft", () => {
    render(<LoanDetail loan={draftLoanDetail} />);

    expect(screen.queryByRole("link", { name: "Registrar pagamento" })).toBeNull();
  });
});
