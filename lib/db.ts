import { sql } from "@vercel/postgres";

// Tum sorgular @vercel/postgres uzerinden gidiyor.
// POSTGRES_URL env degiskeni Vercel projesine Postgres storage eklendiginde
// otomatik olarak tanimlanir (bkz. .env.example).
export { sql };

export type User = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  joined_at: string;
  name: string;
  email: string;
};

export type Vote = {
  id: string;
  group_id: string;
  voter_id: string;
  target_id: string;
  skill: string;
  score: number;
};
