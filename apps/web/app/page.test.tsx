import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

// Modelo de teste de tela: renderiza o componente e consulta pelo papel acessível (como o usuário vê).
describe("HomePage", () => {
  it("shows the pilla title as the main heading", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1, name: "pilla" })).toBeInTheDocument();
  });
});
