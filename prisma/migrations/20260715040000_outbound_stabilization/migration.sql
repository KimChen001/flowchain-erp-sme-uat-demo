ALTER TABLE "InventoryReservationEvent"
  ADD CONSTRAINT "InventoryReservationEvent_commandExecutionId_fkey"
  FOREIGN KEY ("commandExecutionId") REFERENCES "BusinessCommandExecution"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
