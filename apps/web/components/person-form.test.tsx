import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { mockPeople } from "@/lib/mock-data";
import { PersonForm } from "./person-form";

const REFERRER_ID = "01936f8e-7b2c-7cde-8f00-000000000003";
const ALERT_TEXT = "Confira os campos do cadastro.";

const validFields: Readonly<Record<string, string>> = {
  "Nome completo": "Maria da Silva",
  CPF: "52998224725",
  Telefone: "+5511987654321",
};

/** Renderiza uma vez, preenche os campos (válidos + sobrescritas) e clica em "Cadastrar". */
function fillAndSubmit(overrides: Readonly<Record<string, string>>): ReturnType<typeof vi.fn> {
  const onSubmit = vi.fn();
  render(<PersonForm people={mockPeople} onSubmit={onSubmit} />);
  const fields = { ...validFields, ...overrides };
  for (const [label, value] of Object.entries(fields)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));
  return onSubmit;
}

describe("PersonForm", () => {
  it("C4 (A2): shows the labelled fields and the Cadastrar button", () => {
    render(<PersonForm people={mockPeople} />);

    for (const label of ["Nome completo", "CPF", "Telefone", "E-mail", "Nascimento", "Indicado por", "Observações"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Cadastrar" })).toBeInTheDocument();
  });

  it("C4 (A2): sends only the filled fields and shows the status", async () => {
    const onSubmit = fillAndSubmit({});

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Pessoa cadastrada.");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      fullName: "Maria da Silva",
      cpf: "52998224725",
      phone: "+5511987654321",
    });
  });

  it("C5 (A3): sends the referrer id", async () => {
    const onSubmit = fillAndSubmit({ "Indicado por": REFERRER_ID });

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Pessoa cadastrada.");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      fullName: "Maria da Silva",
      cpf: "52998224725",
      phone: "+5511987654321",
      referredById: REFERRER_ID,
    });
  });

  it("C6 (A4): rejects a phone without +55", async () => {
    const onSubmit = fillAndSubmit({ Telefone: "11987654321" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ALERT_TEXT);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("C7 (A4): rejects an invalid CPF", async () => {
    const onSubmit = fillAndSubmit({ CPF: "52998224726" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ALERT_TEXT);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("C8 (A4): rejects an invalid email", async () => {
    const onSubmit = fillAndSubmit({ "E-mail": "maria@" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ALERT_TEXT);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("C9 (A4): rejects an invalid birth date", async () => {
    const onSubmit = fillAndSubmit({ Nascimento: "2026-13-01" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ALERT_TEXT);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("C10 (A4): rejects an empty name", async () => {
    const onSubmit = fillAndSubmit({ "Nome completo": "" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ALERT_TEXT);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("C12 (A4): rejects notes with only spaces", async () => {
    const onSubmit = fillAndSubmit({ Observações: "   " });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ALERT_TEXT);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
