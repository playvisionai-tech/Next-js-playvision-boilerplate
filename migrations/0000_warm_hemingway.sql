CREATE TABLE "counter" (
	"id" serial PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_mutation" (
	"id" serial PRIMARY KEY NOT NULL,
	"counter_id" integer NOT NULL,
	"mutation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "processed_mutation_target_idx" ON "processed_mutation" USING btree ("counter_id","mutation_id");