-- CreateTable
CREATE TABLE "restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "themeColor" TEXT DEFAULT '#000000',
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "dineInEnabled" BOOLEAN NOT NULL DEFAULT true,
    "takeawayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serviceChargePct" DECIMAL(5,2),
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vatPct" DECIMAL(5,2),
    "deliveryFee" DECIMAL(10,2),
    "deliveryMinOrder" DECIMAL(10,2),
    "momoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "airtelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cashEnabled" BOOLEAN NOT NULL DEFAULT true,
    "openingHours" JSONB,
    "orderingBaseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_pkey" PRIMARY KEY ("id")
);
