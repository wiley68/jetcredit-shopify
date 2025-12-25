-- CreateIndex
CREATE INDEX "Filters_jetProductId_idx" ON "Filters"("jetProductId");

-- CreateIndex
CREATE INDEX "Filters_jetProductStart_jetProductEnd_idx" ON "Filters"("jetProductStart", "jetProductEnd");
