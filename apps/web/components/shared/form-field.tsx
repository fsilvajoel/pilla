import { cloneElement, type ReactElement } from "react";
import { Label } from "@/components/ui/label";

export type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  description?: string;
  children: ReactElement;
};

export function FormField({ id, label, error, description, children }: FormFieldProps): ReactElement {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const hasError = Boolean(error);
  const describedBy = [hasError && errorId, description && descriptionId].filter(Boolean).join(" ") || undefined;

  const additionalProps = {
    id,
    "aria-invalid": hasError,
    "aria-describedby": describedBy,
  };

  const childWithAria = cloneElement(children, additionalProps);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {childWithAria}
      {hasError && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {description && !hasError && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
