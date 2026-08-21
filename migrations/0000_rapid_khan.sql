CREATE TABLE "example_note" (
	"id" serial PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"mutation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "example_note_mutation_id_unique" UNIQUE("mutation_id")
);
