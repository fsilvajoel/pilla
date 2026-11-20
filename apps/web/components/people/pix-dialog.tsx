"use client";

import type { SyntheticEvent, ReactElement } from "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import type { CreatePixKeyRequest, PixKey, PixKeyType } from "@pilla/schemas";

type FieldErrors = Partial<Record<keyof CreatePixKeyRequest, string>>;

interface PixDialogProps {
  /** Present when editing; the dialog is mounted fresh (keyed) for each target. */
  initialData?: PixKey;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreatePixKeyRequest) => void;
  isSubmitting: boolean;
}

const pixKeyTypes: readonly { value: PixKeyType; label: string }[] = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "RANDOM", label: "Chave aleatória" },
];

function isPixKeyType(value: string): value is PixKeyType {
  return pixKeyTypes.some((t) => t.value === value);
}

function errorProps(message: string | undefined): { error?: string } {
  return message === undefined ? {} : { error: message };
}

export function PixDialog({ initialData, onOpenChange, onSubmit, isSubmitting }: PixDialogProps): ReactElement {
  const [type, setType] = useState<PixKeyType>(initialData?.type ?? "CPF");
  const [value, setValue] = useState(initialData?.value ?? "");
  const [isPrimary, setIsPrimary] = useState(initialData?.isPrimary ?? false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!value.trim()) next.value = "Valor é obrigatório";
    else if (value.trim().length > 140) next.value = "Valor deve ter no máximo 140 caracteres";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ type, value: value.trim(), isPrimary });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar chave PIX" : "Nova chave PIX"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField id="type" label="Tipo" {...errorProps(errors.type)}>
            <Select
              value={type}
              onValueChange={(v) => {
                if (isPixKeyType(v)) setType(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {pixKeyTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            id="value"
            label="Valor"
            description="CPF/CNPJ apenas números; e-mail ou telefone no formato padrão; chave aleatória gerada pelo banco."
            {...errorProps(errors.value)}
          >
            <Input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
              }}
              placeholder="Valor da chave"
              maxLength={140}
            />
          </FormField>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={isPrimary}
              onChange={(e) => {
                setIsPrimary(e.target.checked);
              }}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="isPrimary" className="text-sm">
              Chave principal
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {initialData ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
