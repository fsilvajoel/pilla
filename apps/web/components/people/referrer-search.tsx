"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from "react";
import type { PersonSummary } from "@pilla/schemas";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { searchReferrersAction } from "@/app/(admin)/pessoas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCpf } from "./format";

export interface ReferrerSearchProps {
  /** Indicador selecionado (null = nenhum). */
  value: PersonSummary | null;
  onChange: (person: PersonSummary | null) => void;
  /** Pessoa que não pode ser escolhida (a própria, na edição). */
  excludeId?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 300;

/** Campo "Indicado por": busca por nome ou CPF e seleciona uma pessoa (RF-03). */
export function ReferrerSearch({ value, onChange, excludeId, disabled = false }: ReferrerSearchProps): ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly PersonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const term = query.trim();
    const requestId = ++requestRef.current;
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      setLoading(true);
      searchReferrersAction(term)
        .then((items) => {
          if (requestId === requestRef.current) setResults(items.filter((p) => p.id !== excludeId));
        })
        .catch(() => {
          if (requestId === requestRef.current) setResults([]);
        })
        .finally(() => {
          if (requestId === requestRef.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [query, excludeId]);

  const select = (person: PersonSummary): void => {
    onChange(person);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="referrer-search">Indicado por</Label>
      {value ? (
        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span>
            {value.fullName} <span className="font-mono text-muted-foreground">{formatCpf(value.cpf)}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Remover indicador"
            onClick={() => {
              onChange(null);
            }}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <SearchIcon
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="referrer-search"
            type="search"
            className="pl-9"
            placeholder="Buscar por nome ou CPF"
            value={query}
            disabled={disabled}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setQuery(e.target.value);
            }}
          />
          {loading && query.trim().length >= 2 ? (
            <Loader2Icon
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
        </div>
      )}
      {!value && query.trim().length >= 2 && results.length > 0 ? (
        <ul className="rounded-md border" aria-label="Resultados da busca">
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent"
                onClick={() => {
                  select(person);
                }}
              >
                <span>{person.fullName}</span>
                <span className="font-mono text-muted-foreground">{formatCpf(person.cpf)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
