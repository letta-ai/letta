CREATE UNIQUE INDEX "unique_user_agent" ON "ade_preferences" USING btree ("user_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_name" ON "agent_templates" USING btree ("name","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_version" ON "deployed_agent_templates" USING btree ("version","organization_id","agent_template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_key" ON "deployed_agents" USING btree ("key","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_embedding_model_name" ON "embedding_models_metadata" USING btree ("model_name","model_endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_inference_model_name" ON "inference_models_metadata" USING btree ("model_name","model_endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_slug" ON "projects" USING btree ("slug","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_provider_id" ON "tool_metadata" USING btree ("provider","provider_id");