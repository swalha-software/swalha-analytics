CREATE TABLE "org_sync" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"version" bigint NOT NULL,
	"deactivated_at" timestamp,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_sync" ADD CONSTRAINT "org_sync_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;