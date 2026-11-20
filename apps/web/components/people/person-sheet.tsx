"use client";

import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AddressList } from "./address-list";
import { PixList } from "./pix-list";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { FileTextIcon } from "lucide-react";
import { formatCpf, formatPhone } from "./format";
import type {
  CreateAddressRequest,
  CreatePixKeyRequest,
  PersonDetailResponse,
  UpdateAddressRequest,
  UpdatePixKeyRequest,
} from "@pilla/schemas";

interface PersonSheetProps {
  person: PersonDetailResponse;
  onAddAddress: (data: CreateAddressRequest) => Promise<unknown>;
  onUpdateAddress: (id: string, data: UpdateAddressRequest) => Promise<unknown>;
  onDeleteAddress: (id: string) => Promise<unknown>;
  onSetPrimaryAddress: (id: string) => Promise<unknown>;
  onAddPixKey: (data: CreatePixKeyRequest) => Promise<unknown>;
  onUpdatePixKey: (id: string, data: UpdatePixKeyRequest) => Promise<unknown>;
  onDeletePixKey: (id: string) => Promise<unknown>;
  onSetPrimaryPixKey: (id: string) => Promise<unknown>;
}

export function PersonSheet({
  person,
  onAddAddress,
  onUpdateAddress,
  onDeleteAddress,
  onSetPrimaryAddress,
  onAddPixKey,
  onUpdatePixKey,
  onDeletePixKey,
  onSetPrimaryPixKey,
}: PersonSheetProps): ReactElement {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados da pessoa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Nome completo</dt>
              <dd className="font-medium">{person.fullName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">CPF</dt>
              <dd className="font-mono text-sm">{formatCpf(person.cpf)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Telefone</dt>
              <dd>{formatPhone(person.phone)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">E-mail</dt>
              <dd>{person.email ?? <span className="text-muted-foreground">—</span>}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Data de nascimento</dt>
              <dd>{person.birthDate ?? <span className="text-muted-foreground">—</span>}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Situação</dt>
              <dd>
                <Badge variant={person.active ? "success" : "secondary"}>{person.active ? "Ativa" : "Inativa"}</Badge>
              </dd>
            </div>
          </dl>
          {person.notes && (
            <div>
              <dt className="text-sm text-muted-foreground">Observações</dt>
              <dd className="whitespace-pre-wrap mt-1">{person.notes}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indicações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <dt className="text-sm text-muted-foreground">Indicado por</dt>
            <dd className="mt-1">
              {person.referrer ? (
                <Link href={`/pessoas/${person.referrer.id}`} className="text-primary hover:underline">
                  {person.referrer.fullName} ({formatCpf(person.referrer.cpf)})
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Indicações feitas ({person.referrals.length})</dt>
            <dd className="mt-1">
              {person.referrals.length > 0 ? (
                <ul className="space-y-1">
                  {person.referrals.map((referral) => (
                    <li key={referral.id}>
                      <Link href={`/pessoas/${referral.id}`} className="text-primary hover:underline">
                        {referral.fullName} ({formatCpf(referral.cpf)})
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">Nenhuma indicação feita.</span>
              )}
            </dd>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={FileTextIcon}
            text="Nenhum contrato cadastrado para esta pessoa."
            action={
              <Button asChild variant="outline">
                <Link href="/emprestimos/novo">Criar contrato</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="addresses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="addresses">Endereços</TabsTrigger>
          <TabsTrigger value="pix">Chaves PIX</TabsTrigger>
        </TabsList>
        <TabsContent value="addresses">
          <AddressList
            addresses={person.addresses}
            onAddAddress={onAddAddress}
            onUpdateAddress={onUpdateAddress}
            onDeleteAddress={onDeleteAddress}
            onSetPrimaryAddress={onSetPrimaryAddress}
          />
        </TabsContent>
        <TabsContent value="pix">
          <PixList
            pixKeys={person.pixKeys}
            onAddPixKey={onAddPixKey}
            onUpdatePixKey={onUpdatePixKey}
            onDeletePixKey={onDeletePixKey}
            onSetPrimaryPixKey={onSetPrimaryPixKey}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
