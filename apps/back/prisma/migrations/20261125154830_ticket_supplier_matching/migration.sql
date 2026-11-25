-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "matchedSupplierId" TEXT,
ADD COLUMN     "matchedSupplierName" TEXT,
ADD COLUMN     "supplierRegistrationNumber" TEXT,
ADD COLUMN     "supplierVatNumber" TEXT;
