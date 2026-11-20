// Semeia a conta base e 6 pessoas fictícias (RNF-02) em DATABASE_URL local. Idempotente, numa única transação.
// Recusa host que não seja 127.0.0.1 ou localhost, para nunca misturar dado de teste com produção.
import pg from "pg";
import { BASE_ACCOUNT_ID, BASE_ACCOUNT_NAME } from "../src/treasury/infra/account-repository.ts";

type PixType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

interface PersonSeed {
  readonly id: string;
  readonly fullName: string;
  readonly cpf: string;
  readonly phone: string;
  readonly referredById?: string;
}
interface AddressSeed {
  readonly id: string;
  readonly personId: string;
  readonly street: string;
  readonly number: string;
  readonly district: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly isPrimary: boolean;
}
interface PixSeed {
  readonly id: string;
  readonly ownerId: string;
  readonly type: PixType;
  readonly value: string;
  readonly isPrimary: boolean;
}

const ANA = "00000000-0000-7000-8000-000000000001";
const BRUNO = "00000000-0000-7000-8000-000000000002";
const CARLA = "00000000-0000-7000-8000-000000000003";
const DIEGO = "00000000-0000-7000-8000-000000000004";
const ELISA = "00000000-0000-7000-8000-000000000005";
const FABIO = "00000000-0000-7000-8000-000000000006";

// O indicador (Ana) vem antes do indicado (Bruno) por causa da FK persons_referred_by_id_fkey.
const persons: readonly PersonSeed[] = [
  { id: ANA, fullName: "Ana Souza", cpf: "12345678909", phone: "+5511999990001" },
  { id: BRUNO, fullName: "Bruno Lima", cpf: "11144477735", phone: "+5511999990002", referredById: ANA },
  { id: CARLA, fullName: "Carla Dias", cpf: "10020030088", phone: "+5511999990003" },
  { id: DIEGO, fullName: "Diego Rocha", cpf: "21436587107", phone: "+5511999990004" },
  { id: ELISA, fullName: "Elisa Prado", cpf: "31415926590", phone: "+5511999990005" },
  { id: FABIO, fullName: "Fábio Nunes", cpf: "27182818205", phone: "+5511999990006" },
];

const addresses: readonly AddressSeed[] = [
  {
    id: "00000000-0000-7000-8001-000000000001",
    personId: ANA,
    street: "Rua das Flores",
    number: "100",
    district: "Centro",
    city: "São Paulo",
    state: "SP",
    postalCode: "01001000",
    isPrimary: true,
  },
  {
    id: "00000000-0000-7000-8001-000000000002",
    personId: ANA,
    street: "Avenida Brasil",
    number: "2000",
    district: "Jardins",
    city: "São Paulo",
    state: "SP",
    postalCode: "01430000",
    isPrimary: false,
  },
  {
    id: "00000000-0000-7000-8001-000000000003",
    personId: BRUNO,
    street: "Rua do Sol",
    number: "45",
    district: "Savassi",
    city: "Belo Horizonte",
    state: "MG",
    postalCode: "30140000",
    isPrimary: true,
  },
  {
    id: "00000000-0000-7000-8001-000000000004",
    personId: CARLA,
    street: "Rua da Paz",
    number: "7",
    district: "Centro",
    city: "Curitiba",
    state: "PR",
    postalCode: "80010000",
    isPrimary: true,
  },
  {
    id: "00000000-0000-7000-8001-000000000005",
    personId: CARLA,
    street: "Rua Nova",
    number: "320",
    district: "Batel",
    city: "Curitiba",
    state: "PR",
    postalCode: "80420000",
    isPrimary: false,
  },
  {
    id: "00000000-0000-7000-8001-000000000006",
    personId: DIEGO,
    street: "Travessa Azul",
    number: "12",
    district: "Boa Viagem",
    city: "Recife",
    state: "PE",
    postalCode: "51020000",
    isPrimary: true,
  },
  {
    id: "00000000-0000-7000-8001-000000000007",
    personId: ELISA,
    street: "Rua Verde",
    number: "88",
    district: "Moinhos",
    city: "Porto Alegre",
    state: "RS",
    postalCode: "90570000",
    isPrimary: true,
  },
  {
    id: "00000000-0000-7000-8001-000000000008",
    personId: FABIO,
    street: "Alameda Central",
    number: "5",
    district: "Asa Sul",
    city: "Brasília",
    state: "DF",
    postalCode: "70070000",
    isPrimary: true,
  },
];

const pixKeys: readonly PixSeed[] = [
  { id: "00000000-0000-7000-8002-000000000001", ownerId: ANA, type: "CPF", value: "12345678909", isPrimary: true },
  {
    id: "00000000-0000-7000-8002-000000000002",
    ownerId: ANA,
    type: "EMAIL",
    value: "ana.souza@example.com",
    isPrimary: false,
  },
  {
    id: "00000000-0000-7000-8002-000000000003",
    ownerId: BRUNO,
    type: "PHONE",
    value: "+5511999990002",
    isPrimary: true,
  },
  { id: "00000000-0000-7000-8002-000000000004", ownerId: CARLA, type: "CPF", value: "10020030088", isPrimary: true },
  {
    id: "00000000-0000-7000-8002-000000000005",
    ownerId: CARLA,
    type: "RANDOM",
    value: "5f3c9a52-0b1e-4c77-9a21-3d7e1f0a6b11",
    isPrimary: false,
  },
  {
    id: "00000000-0000-7000-8002-000000000006",
    ownerId: DIEGO,
    type: "EMAIL",
    value: "diego.rocha@example.com",
    isPrimary: true,
  },
  {
    id: "00000000-0000-7000-8002-000000000007",
    ownerId: ELISA,
    type: "PHONE",
    value: "+5511999990005",
    isPrimary: true,
  },
  { id: "00000000-0000-7000-8002-000000000008", ownerId: FABIO, type: "CPF", value: "27182818205", isPrimary: true },
];

const ALLOWED_HOSTS: readonly string[] = ["127.0.0.1", "localhost"];

function readDatabaseUrl(): URL {
  const raw = process.env["DATABASE_URL"]?.trim() ?? "";
  if (raw === "") throw new Error("DATABASE_URL ausente ou vazia");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL inválida: esperado postgres://usuario:senha@host:porta/banco");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL inválida: o protocolo deve ser postgres://");
  }
  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    throw new Error("o seed só roda em banco local: o host deve ser 127.0.0.1 ou localhost");
  }
  return url;
}

async function seed(client: pg.PoolClient): Promise<void> {
  await client.query(`INSERT INTO treasury.accounts (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
    BASE_ACCOUNT_ID,
    BASE_ACCOUNT_NAME,
  ]);
  for (const p of persons) {
    await client.query(
      `INSERT INTO people.persons (id, full_name, cpf, phone, referred_by_id)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.fullName, p.cpf, p.phone, p.referredById ?? null],
    );
  }
  for (const a of addresses) {
    await client.query(
      `INSERT INTO people.addresses (id, person_id, street, number, district, city, state, postal_code, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [a.id, a.personId, a.street, a.number, a.district, a.city, a.state, a.postalCode, a.isPrimary],
    );
  }
  for (const k of pixKeys) {
    await client.query(
      `INSERT INTO people.pix_keys (id, owner_person_id, type, value, is_primary)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [k.id, k.ownerId, k.type, k.value, k.isPrimary],
    );
  }
}

async function main(): Promise<void> {
  const url = readDatabaseUrl();
  const pool = new pg.Pool({ connectionString: url.href });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seed(client);
      await client.query("COMMIT");
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    process.stdout.write(
      `seed ok: ${String(persons.length)} pessoas, ${String(addresses.length)} endereços, ${String(pixKeys.length)} chaves PIX\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`db:seed falhou: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
