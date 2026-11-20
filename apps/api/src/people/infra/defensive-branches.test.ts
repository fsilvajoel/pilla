import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProblemException } from "../../core/http/problem-exception";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { createAddress, updateAddress } from "../application/address-service";
import { getPersonSheet } from "../application/get-person-sheet";
import { PeopleService } from "../application/people.service";
import { createPixKey, updatePixKey } from "../application/pix-key-service";
import { addressRepository } from "./address-repository";
import { listPersons } from "./person-list";
import { pixKeyRepository } from "./pix-key-repository";

const PERSON = "01970000-0000-7000-8000-000000000a01";
const ADDRESS = "01970000-0000-7000-8000-000000000a02";
const PIX = "01970000-0000-7000-8000-000000000a03";
const NEW_ID = "01970000-0000-7000-8000-000000000a04";

function errorOf(error: unknown): unknown {
  return error;
}

describe("ramos defensivos de pessoas, endereços e chaves Pix", () => {
  let handle: MigratedTestDb;

  beforeAll(async () => {
    handle = await migratedTestDb();
    await handle.client.query(
      "insert into people.persons (id, full_name, cpf, phone, birth_date) values ($1, 'Ana Costa', '11144477735', '+5511987654321', '1990-05-17')",
      [PERSON],
    );
    await handle.client.query(
      "insert into people.addresses (id, person_id, street, number, district, city, state, postal_code, is_primary) values ($1, $2, 'Rua A', '1', 'Centro', 'Recife', 'PE', '50000000', true)",
      [ADDRESS, PERSON],
    );
    await handle.client.query(
      "insert into people.pix_keys (id, owner_person_id, type, value, is_primary) values ($1, $2, 'EMAIL', 'ana@x.com', true)",
      [PIX, PERSON],
    );
  });

  afterAll(async () => {
    await handle.close();
  });

  it("ficha com data de nascimento a devolve no formato do banco", async () => {
    const sheet = await getPersonSheet(handle.db, PERSON);
    expect(sheet?.birthDate).toBe("1990-05-17");
  });

  it("busca só de pontuação (sem dígitos) vale como nome e não casa CPF", async () => {
    const page = await listPersons(handle.db, { search: "...", limit: 20, cursor: null, active: null });
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it("insert que não devolve linha lança erro de endereço", async () => {
    await handle.client.exec(`
      create function people.skip_row() returns trigger language plpgsql as $$ begin return null; end $$;
      create trigger skip_address_insert before insert on people.addresses for each row execute function people.skip_row();
    `);
    await expect(
      createAddress(addressRepository(handle.db), PERSON, NEW_ID, {
        street: "Rua B",
        number: "2",
        district: "Centro",
        city: "Recife",
        state: "PE",
        postalCode: "50000000",
      }),
    ).rejects.toThrow("address insert returned no row");
    await handle.client.exec("drop trigger skip_address_insert on people.addresses");
  });

  it("update que não altera linha devolve null no endereço", async () => {
    await handle.client.exec(
      "create trigger skip_address_update before update on people.addresses for each row execute function people.skip_row()",
    );
    expect(await updateAddress(addressRepository(handle.db), ADDRESS, { street: "Rua Nova" })).toBeNull();
    await handle.client.exec("drop trigger skip_address_update on people.addresses");
  });

  it("insert que não devolve linha lança erro de chave Pix", async () => {
    await handle.client.exec(
      "create trigger skip_pix_insert before insert on people.pix_keys for each row execute function people.skip_row()",
    );
    await expect(
      createPixKey(pixKeyRepository(handle.db), PERSON, NEW_ID, { type: "EMAIL", value: "b@x.com" }),
    ).rejects.toThrow("pix key insert returned no row");
    await handle.client.exec("drop trigger skip_pix_insert on people.pix_keys");
  });

  it("update que não altera linha devolve null na chave Pix", async () => {
    await handle.client.exec(
      "create trigger skip_pix_update before update on people.pix_keys for each row execute function people.skip_row()",
    );
    expect(await updatePixKey(pixKeyRepository(handle.db), PIX, { value: "novo@x.com" })).toBeNull();
    await handle.client.exec("drop trigger skip_pix_update on people.pix_keys");
  });

  it("erros que não são de escrita ou cursor passam intactos pelo serviço", async () => {
    const closed = await migratedTestDb();
    const service = new PeopleService(closed.db);
    await closed.close();
    await expect(closed.close()).resolves.toBeUndefined();
    const failures = await Promise.all([
      service.create({ fullName: "Bia Lima", cpf: "52998224725", phone: "+5511987654322" }).catch(errorOf),
      service.list({ limit: 20 }).catch(errorOf),
      service.update(PERSON, { version: 1, fullName: "Outro" }).catch(errorOf),
    ]);
    for (const failure of failures) {
      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(ProblemException);
    }
  });

  it("pessoa removida entre a escrita e a leitura devolve NOT_FOUND", async () => {
    const racing = await migratedTestDb();
    await racing.client.exec(`
      create function people.drop_own_row() returns trigger language plpgsql as $$ begin delete from people.persons where id = new.id; return null; end $$;
      create trigger drop_after_insert after insert on people.persons for each row execute function people.drop_own_row();
    `);
    const failure = await new PeopleService(racing.db)
      .create({ fullName: "Caio Dias", cpf: "52998224725", phone: "+5511987654323" })
      .catch(errorOf);
    await racing.close();
    expect(failure).toBeInstanceOf(ProblemException);
    expect(failure).toMatchObject({ code: "NOT_FOUND" });
  });
});
