"use client";

import { useState, useTransition, type ReactElement } from "react";
import type { PersonSummary } from "@pilla/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCpf } from "./format";

export type ReferrerPickerProps = {
  selected: PersonSummary | null;
  onSelect: (person: PersonSummary | null) => void;
  search: (term: string) => Promise<readonly PersonSummary[]>;
};

/** "Indicado por": busca pessoas por nome ou CPF e escolhe uma. */
export function ReferrerPicker({ selected, onSelect, search }: ReferrerPickerProps): ReactElement {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<readonly PersonSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(value: string): void {
    setTerm(value);
    startTransition(async () => {
      const found = await search(value);
      setResults(found);
      setSearched(value.trim().length >= 2);
    });
  }

  if (selected) {
    return (
      <div className="space-y-1.5">
        <Label>Indicado por</Label>
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <span>
            {selected.fullName} <span className="text-muted-foreground">{formatCpf(selected.cpf)}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect(null);
            }}
          >
            Remover
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="referrer-search">Indicado por</Label>
      <Input
        id="referrer-search"
        type="search"
        value={term}
        placeholder="Buscar por nome ou CPF (opcional)"
        onChange={(event) => {
          run(event.target.value);
        }}
      />
      {pending && <p className="text-sm text-muted-foreground">Buscando…</p>}
      {!pending && searched && results.length === 0 && (
        <p className="text-sm text-muted-foreground">Ninguém encontrado.</p>
      )}
      {results.length > 0 && (
        <ul className="divide-y rounded-md border" aria-label="Resultados da busca">
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(person);
                  setResults([]);
                  setTerm("");
                }}
              >
                <span>{person.fullName}</span>
                <span className="text-muted-foreground">{formatCpf(person.cpf)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
