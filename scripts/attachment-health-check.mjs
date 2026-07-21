import { createLocalDurableAttachmentStorage } from "../server/domain/attachment-storage-provider.mjs";

const storage = createLocalDurableAttachmentStorage({ env: process.env });
console.log(JSON.stringify(await storage.healthCheck(), null, 2));
