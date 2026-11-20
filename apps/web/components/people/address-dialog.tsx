"use client";

import type { SyntheticEvent, ReactElement } from "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { brazilianStates, type BrazilianStateCode } from "./brazilian-states";
import type { Address, CreateAddressRequest } from "@pilla/schemas";

type FieldErrors = Partial<Record<keyof CreateAddressRequest, string>>;

interface AddressDialogProps {
  /** Present when editing; the dialog is mounted fresh (keyed) for each target. */
  initialData?: Address;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAddressRequest) => void;
  isSubmitting: boolean;
}

function isStateCode(value: string): value is BrazilianStateCode {
  return brazilianStates.some((s) => s.code === value);
}

function errorProps(message: string | undefined): { error?: string } {
  return message === undefined ? {} : { error: message };
}

export function AddressDialog({ initialData, onOpenChange, onSubmit, isSubmitting }: AddressDialogProps): ReactElement {
  const [street, setStreet] = useState(initialData?.street ?? "");
  const [number, setNumber] = useState(initialData?.number ?? "");
  const [complement, setComplement] = useState(initialData?.complement ?? "");
  const [district, setDistrict] = useState(initialData?.district ?? "");
  const [city, setCity] = useState(initialData?.city ?? "");
  const [state, setState] = useState(initialData?.state ?? "SP");
  const [postalCode, setPostalCode] = useState(initialData?.postalCode ?? "");
  const [isPrimary, setIsPrimary] = useState(initialData?.isPrimary ?? false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!street.trim()) next.street = "Rua é obrigatória";
    if (!number.trim()) next.number = "Número é obrigatório";
    if (!district.trim()) next.district = "Bairro é obrigatório";
    if (!city.trim()) next.city = "Cidade é obrigatória";
    if (!isStateCode(state)) next.state = "Estado é obrigatório";
    if (!/^\d{8}$/.test(postalCode)) next.postalCode = "CEP deve ter 8 dígitos";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (!validate()) return;
    const trimmedComplement = complement.trim();
    onSubmit({
      street: street.trim(),
      number: number.trim(),
      ...(trimmedComplement ? { complement: trimmedComplement } : {}),
      district: district.trim(),
      city: city.trim(),
      state,
      postalCode,
      isPrimary,
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar endereço" : "Novo endereço"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField id="street" label="Rua" {...errorProps(errors.street)}>
            <Input
              value={street}
              onChange={(e) => {
                setStreet(e.target.value);
              }}
              placeholder="Rua, avenida, etc."
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="number" label="Número" {...errorProps(errors.number)}>
              <Input
                value={number}
                onChange={(e) => {
                  setNumber(e.target.value);
                }}
                placeholder="Nº"
              />
            </FormField>
            <FormField id="complement" label="Complemento">
              <Input
                value={complement}
                onChange={(e) => {
                  setComplement(e.target.value);
                }}
                placeholder="Apto, bloco, etc."
              />
            </FormField>
          </div>
          <FormField id="district" label="Bairro" {...errorProps(errors.district)}>
            <Input
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
              }}
              placeholder="Bairro"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="city" label="Cidade" {...errorProps(errors.city)}>
              <Input
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                }}
                placeholder="Cidade"
              />
            </FormField>
            <FormField id="state" label="Estado" {...errorProps(errors.state)}>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {brazilianStates.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField id="postalCode" label="CEP" {...errorProps(errors.postalCode)}>
            <Input
              value={postalCode}
              onChange={(e) => {
                setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 8));
              }}
              placeholder="00000000"
              inputMode="numeric"
              maxLength={8}
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
              Endereço principal
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
