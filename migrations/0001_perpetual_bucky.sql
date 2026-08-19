CREATE TABLE "processed_mutation" (
	"id" serial PRIMARY KEY NOT NULL,
	"mutation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "processed_mutation_mutation_id_idx" ON "processed_mutation" USING btree ("mutation_id");