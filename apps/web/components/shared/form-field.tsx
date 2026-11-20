import type { ReactElement } from "react";

export type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  description?: string;
  children: ReactElement;
};

export function FormField(_props: FormFieldProps): ReactElement {
  throw new Error("esboço: não implementado");
}
