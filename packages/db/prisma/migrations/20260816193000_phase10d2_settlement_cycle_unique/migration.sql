-- One active settlement per owner per cycle window (cancelled rows may be regenerated).
CREATE UNIQUE INDEX "OwnerSettlement_owner_period_active_key"
  ON "OwnerSettlement"("ownerId", "periodStart", "periodEnd")
  WHERE "status" IN ('draft', 'ready', 'paid');
