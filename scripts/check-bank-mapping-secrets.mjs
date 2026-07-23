import { findBankMappingSecretPaths } from "../server/domain/bank-projection-policy.mjs";
import { createPrismaClient } from "../server/persistence/prisma-client.mjs";

const prisma = await createPrismaClient(process.env);
try {
  const mappings = await prisma.bankStatementMappingTemplate.findMany({
    select: { id: true, tenantId: true, templateCode: true, version: true, columnMapping: true, metadata: true },
    orderBy: [{ tenantId: "asc" }, { templateCode: "asc" }, { version: "asc" }],
  });
  const violations = mappings.flatMap((mapping) => {
    const paths = findBankMappingSecretPaths({ columnMapping: mapping.columnMapping, metadata: mapping.metadata });
    return paths.length ? [{ id: mapping.id, tenantId: mapping.tenantId, templateCode: mapping.templateCode, version: mapping.version, paths }] : [];
  });
  if (violations.length) {
    console.error(JSON.stringify({ code: "BANK_MAPPING_SECRET_FIELD_FORBIDDEN", message: "Bank mapping security scan failed. Values were not inspected in output.", violations }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: "passed", scannedMappings: mappings.length, violations: 0 }));
  }
} finally {
  await prisma.$disconnect();
}
