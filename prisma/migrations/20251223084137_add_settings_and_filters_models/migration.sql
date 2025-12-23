-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "jetStatusIn" BOOLEAN NOT NULL DEFAULT true,
    "jetEmail" TEXT NOT NULL DEFAULT 'online.shop@pbpf.bg',
    "jetId" TEXT NOT NULL DEFAULT '',
    "jetPurcent" REAL NOT NULL DEFAULT 1.40,
    "jetVnoskiDefault" INTEGER NOT NULL DEFAULT 12,
    "jetCardIn" BOOLEAN NOT NULL DEFAULT true,
    "jetPurcentCard" REAL NOT NULL DEFAULT 1.00,
    "jetCount" TEXT NOT NULL DEFAULT '',
    "jetMinprice" INTEGER NOT NULL DEFAULT 150,
    "jetEur" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Filters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jetProductId" TEXT NOT NULL,
    "jetProductPercent" REAL NOT NULL DEFAULT 0.00,
    "jetProductMeseci" TEXT NOT NULL,
    "jetProductPrice" REAL NOT NULL DEFAULT 0,
    "jetProductStart" DATETIME NOT NULL,
    "jetProductEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
