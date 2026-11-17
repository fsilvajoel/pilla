// Matchers de DOM (toBeInTheDocument etc.) e limpeza do DOM entre testes (sem globals do vitest).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
