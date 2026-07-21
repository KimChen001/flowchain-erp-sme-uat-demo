import { createAttachmentService } from "../server/domain/attachment-service.mjs";
import { createPrismaClient } from "../server/persistence/prisma-client.mjs";

const prisma = await createPrismaClient(process.env);
try {
  const report = await createAttachmentService({ prisma, env: process.env }).orphanCheck();
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
