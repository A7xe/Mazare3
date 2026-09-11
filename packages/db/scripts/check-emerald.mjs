import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const row = await p.property.findFirst({ where: { slug: "chalet-emerald-dead-sea" }, select: { id: true, slug: true, status: true } });
console.log(JSON.stringify(row));
await p.$disconnect();
