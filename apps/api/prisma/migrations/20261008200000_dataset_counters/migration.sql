-- CreateTable
CREATE TABLE "dataset_counters" (
    "datasetId" TEXT NOT NULL,
    "shard" INTEGER NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dataset_counters_pkey" PRIMARY KEY ("datasetId","shard")
);

-- AddForeignKey
ALTER TABLE "dataset_counters" ADD CONSTRAINT "dataset_counters_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

