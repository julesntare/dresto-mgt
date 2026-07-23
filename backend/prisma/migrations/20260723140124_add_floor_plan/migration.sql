-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "floorId" TEXT,
ADD COLUMN     "posX" DOUBLE PRECISION,
ADD COLUMN     "posY" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landmarks" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "posX" DOUBLE PRECISION NOT NULL,
    "posY" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "landmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landmarks_floorId_idx" ON "landmarks"("floorId");

-- CreateIndex
CREATE INDEX "tables_floorId_idx" ON "tables"("floorId");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landmarks" ADD CONSTRAINT "landmarks_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
