CREATE TABLE "delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text NOT NULL,
	"message" text NOT NULL,
	"location" text,
	"actor_email" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_rating_valid" CHECK ("product_reviews"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "review_content_valid" CHECK (length("product_reviews"."title") BETWEEN 3 AND 120 AND length("product_reviews"."body") BETWEEN 10 AND 1500)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_status" text DEFAULT 'awaiting_payment' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "estimated_delivery_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_events_order_idx" ON "delivery_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_customer_product_unique" ON "product_reviews" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "reviews_product_created_idx" ON "product_reviews" USING btree ("product_id","created_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "order_delivery_status_valid" CHECK ("orders"."delivery_status" IN ('awaiting_payment', 'payment_review', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'exception'));