import bcrypt from 'bcrypt';
import { db } from '../src/db/client';

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: npx tsx scripts/create-user.ts <email> <password>');
  process.exit(1);
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({ data: { email, passwordHash } });
  console.log(`Created user: ${user.email} (id=${user.id})`);
  await db.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
