import { sql } from "@/lib/db";

export async function isGroupMember(groupId: string, userId: string) {
  const result = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return result.rows.length > 0;
}

export async function isGroupOwner(groupId: string, userId: string) {
  const result = await sql`
    SELECT 1 FROM groups WHERE id = ${groupId} AND owner_id = ${userId}
  `;
  return result.rows.length > 0;
}
