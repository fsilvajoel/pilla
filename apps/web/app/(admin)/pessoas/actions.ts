"use server";

import { revalidatePath } from "next/cache";
import { addAddress, updateAddress, deleteAddress, addPixKey, updatePixKey, deletePixKey } from "@/lib/api/people";
import type {
  CreateAddressRequest,
  UpdateAddressRequest,
  CreatePixKeyRequest,
  UpdatePixKeyRequest,
} from "@pilla/schemas";

export async function addAddressAction(personId: string, data: CreateAddressRequest): Promise<void> {
  await addAddress(personId, data);
  revalidatePath(`/pessoas/${personId}`);
}

export async function updateAddressAction(addressId: string, data: UpdateAddressRequest): Promise<void> {
  await updateAddress(addressId, data);
  revalidatePath("/pessoas/[id]", "page");
}

export async function deleteAddressAction(addressId: string): Promise<void> {
  await deleteAddress(addressId);
  revalidatePath("/pessoas/[id]", "page");
}

export async function addPixKeyAction(personId: string, data: CreatePixKeyRequest): Promise<void> {
  await addPixKey(personId, data);
  revalidatePath(`/pessoas/${personId}`);
}

export async function updatePixKeyAction(pixKeyId: string, data: UpdatePixKeyRequest): Promise<void> {
  await updatePixKey(pixKeyId, data);
  revalidatePath("/pessoas/[id]", "page");
}

export async function deletePixKeyAction(pixKeyId: string): Promise<void> {
  await deletePixKey(pixKeyId);
  revalidatePath("/pessoas/[id]", "page");
}

// The API handles primary swap automatically when isPrimary=true is sent
// So we just call update with isPrimary=true
export async function setPrimaryAddressAction(personId: string, addressId: string): Promise<void> {
  await updateAddress(addressId, { isPrimary: true });
  revalidatePath(`/pessoas/${personId}`);
}

export async function setPrimaryPixKeyAction(personId: string, pixKeyId: string): Promise<void> {
  await updatePixKey(pixKeyId, { isPrimary: true });
  revalidatePath(`/pessoas/${personId}`);
}
