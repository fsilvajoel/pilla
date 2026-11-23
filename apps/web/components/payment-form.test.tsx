import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { exampleLoanDetail } from "@/lib/mock-data";
import { PaymentForm } from "./payment-form";

const accounts = [{ id: "01936f8e-7b2c-7cde-8f00-000000000003", name: "Conta base", active: true, balanceCents: 0 }];

const payment = {
  loanId: "01936f8e-7b2c-7cde-8f00-000000000002",
  accountId: "01936f8e-7b2c-7cde-8f00-000000000003",
  paidAt: "2026-12-13",
  amountCents: 115000,
  method: "PIX",
};

function fillExample(): void {
  fireEvent.change(screen.getByLabelText("Conta de destino"), {
    target: { value: "01936f8e-7b2c-7cde-8f00-000000000003" },
  });
  fireEvent.change(screen.getByLabelText("Data do pagamento"), { target: { value: "2026-12-13" } });
  fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "1.150,00" } });
}

describe("PaymentForm", () => {
  it("shows the loan and the fields", () => {
    render(<PaymentForm accounts={accounts} loan={exampleLoanDetail} onSubmit={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Registrar pagamento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pagamento" })).toBeInTheDocument();
    expect(screen.getByText("Contrato 2026-0012")).toBeInTheDocument();
    expect(screen.getByText("Saldo devedor R$ 4.600,00")).toBeInTheDocument();
    expect(screen.getByLabelText("Conta de destino").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Data do pagamento")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toBeInTheDocument();
    expect(screen.getByLabelText("Método")).toHaveValue("PIX");
    expect(screen.getByRole("option", { name: "Espécie" })).toHaveValue("CASH");
    expect(screen.queryByLabelText("Comprovante")).toBeNull();
  });

  it("registers the RFC-004 payment", async () => {
    const onSubmit = vi.fn();
    render(<PaymentForm accounts={accounts} loan={exampleLoanDetail} onSubmit={onSubmit} />);

    fillExample();
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Pagamento registrado para conferência.");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(payment, expect.any(String));
  });

  it("accepts cash", async () => {
    const onSubmit = vi.fn();
    render(<PaymentForm accounts={accounts} loan={exampleLoanDetail} onSubmit={onSubmit} />);

    fillExample();
    fireEvent.change(screen.getByLabelText("Método"), { target: { value: "CASH" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Pagamento registrado para conferência.");
    expect(onSubmit).toHaveBeenCalledWith({ ...payment, method: "CASH" }, expect.any(String));
  });

  it("rejects a bad amount", async () => {
    const onSubmit = vi.fn();
    render(<PaymentForm accounts={accounts} loan={exampleLoanDetail} onSubmit={onSubmit} />);

    fillExample();
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "1150" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Confira os campos do pagamento.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an empty account", async () => {
    const onSubmit = vi.fn();
    render(<PaymentForm accounts={accounts} loan={exampleLoanDetail} onSubmit={onSubmit} />);

    fillExample();
    fireEvent.change(screen.getByLabelText("Conta de destino"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Confira os campos do pagamento.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks a paid off contract", () => {
    const onSubmit = vi.fn();
    render(<PaymentForm accounts={accounts} loan={{ ...exampleLoanDetail, status: "PAID_OFF" }} onSubmit={onSubmit} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Contrato encerrado");
    expect(screen.getByRole("alert")).toHaveTextContent("Este contrato já foi quitado e não aceita novos pagamentos.");
    expect(screen.queryByLabelText("Valor")).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks a renewed contract", () => {
    render(<PaymentForm accounts={accounts} loan={{ ...exampleLoanDetail, status: "RENEWED" }} onSubmit={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Contrato encerrado");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este contrato foi renovado. Registre o pagamento no contrato novo.",
    );
    expect(screen.queryByLabelText("Valor")).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).toBeNull();
  });

  it("blocks a renegotiated contract", () => {
    render(
      <PaymentForm accounts={accounts} loan={{ ...exampleLoanDetail, status: "RENEGOTIATED" }} onSubmit={vi.fn()} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Contrato encerrado");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este contrato foi renegociado. Registre o pagamento no contrato novo.",
    );
    expect(screen.queryByLabelText("Valor")).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).toBeNull();
  });

  it("blocks a cancelled contract", () => {
    render(<PaymentForm accounts={accounts} loan={{ ...exampleLoanDetail, status: "CANCELLED" }} onSubmit={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Contrato encerrado");
    expect(screen.getByRole("alert")).toHaveTextContent("Este contrato foi cancelado e não aceita pagamentos.");
    expect(screen.queryByLabelText("Valor")).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).toBeNull();
  });

  it("keeps the form for a written off contract", () => {
    render(
      <PaymentForm accounts={accounts} loan={{ ...exampleLoanDetail, status: "WRITTEN_OFF" }} onSubmit={vi.fn()} />,
    );

    expect(screen.getByLabelText("Valor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pagamento" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
