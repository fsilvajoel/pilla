import { Body, Controller, Delete, HttpCode, Inject, Param, Patch, Post, Res } from "@nestjs/common";
import {
  createAddressRequest,
  idSchema,
  updateAddressRequest,
  type Address,
  type CreateAddressRequest,
  type UpdateAddressRequest,
} from "@pilla/schemas";
import { PeopleValidationPipe } from "./people-validation.pipe";
import { ProblemException } from "../../core/http/problem-exception";
import { newId } from "../../core/public/ids";
import { DATABASE, type Database } from "../../db/database";
import { createAddress, deleteAddress, updateAddress } from "../application/address-service";
import { addressRepository, type AddressRepository } from "../infra/address-repository";

type HeaderSetter = { setHeader(name: string, value: string): unknown };

const idPipe = new PeopleValidationPipe<string>(idSchema);

function notFound(): ProblemException {
  return new ProblemException("NOT_FOUND", "Recurso não encontrado.");
}

// Só valida a entrada e traduz HTTP; as regras de principal ficam em application/address-service.
@Controller()
export class AddressesController {
  private readonly repository: AddressRepository;

  constructor(@Inject(DATABASE) db: Database) {
    this.repository = addressRepository(db);
  }

  @Post("people/:id/addresses")
  async create(
    @Param("id", idPipe) personId: string,
    @Body(new PeopleValidationPipe<CreateAddressRequest>(createAddressRequest)) body: CreateAddressRequest,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<Address> {
    const address = await createAddress(this.repository, personId, newId(), body);
    if (address === null) throw notFound();
    response.setHeader("Location", `/api/v1/people/${personId}/addresses/${address.id}`);
    return address;
  }

  @Patch("addresses/:id")
  async update(
    @Param("id", idPipe) addressId: string,
    @Body(new PeopleValidationPipe<UpdateAddressRequest>(updateAddressRequest)) body: UpdateAddressRequest,
  ): Promise<Address> {
    const address = await updateAddress(this.repository, addressId, body);
    if (address === null) throw notFound();
    return address;
  }

  @Delete("addresses/:id")
  @HttpCode(204)
  async remove(@Param("id", idPipe) addressId: string): Promise<void> {
    if (!(await deleteAddress(this.repository, addressId))) throw notFound();
  }
}
