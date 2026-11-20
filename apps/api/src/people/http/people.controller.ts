import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Res } from "@nestjs/common";
import {
  createPersonRequest,
  idSchema,
  personListQuery,
  updatePersonRequest,
  type CreatePersonRequest,
  type PersonListQuery,
  type PersonListResponse,
  type PersonResponse,
  type UpdatePersonRequest,
} from "@pilla/schemas";
import { PeopleValidationPipe } from "./people-validation.pipe";
import { PeopleService } from "../application/people.service";

type HeaderSetter = { setHeader(name: string, value: string): unknown };

// Só valida a entrada e traduz HTTP; as regras ficam em PeopleService.
@Controller("people")
export class PeopleController {
  private readonly service: PeopleService;

  constructor(@Inject(PeopleService) service: PeopleService) {
    this.service = service;
  }

  @Post()
  async create(
    @Body(new PeopleValidationPipe<CreatePersonRequest>(createPersonRequest)) body: CreatePersonRequest,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<PersonResponse> {
    const person = await this.service.create(body);
    response.setHeader("Location", `/api/v1/people/${person.id}`);
    return person;
  }

  @Get()
  list(
    @Query(new PeopleValidationPipe<PersonListQuery>(personListQuery)) query: PersonListQuery,
  ): Promise<PersonListResponse> {
    return this.service.list(query);
  }

  @Get(":id")
  get(@Param("id", new PeopleValidationPipe<string>(idSchema)) id: string): Promise<PersonResponse> {
    return this.service.get(id);
  }

  @Patch(":id")
  update(
    @Param("id", new PeopleValidationPipe<string>(idSchema)) id: string,
    @Body(new PeopleValidationPipe<UpdatePersonRequest>(updatePersonRequest)) body: UpdatePersonRequest,
  ): Promise<PersonResponse> {
    return this.service.update(id, body);
  }
}
