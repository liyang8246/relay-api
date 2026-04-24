import { pgTable, text, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 用户表
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 供应商表
export const providers = pgTable("providers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // 显示名称
  baseUrl: text("base_url").notNull(), // API 基础 URL
  maxConcurrency: integer("max_concurrency").notNull().default(10), // 最大并发数
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 凭证表 (API Keys)
export const credentials = pgTable("credentials", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  apiKey: text("api_key").notNull(), // 加密存储
  name: text("name").notNull(), // 凭证名称
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 凭证关联的模型
export const credentialModels = pgTable("credential_models", {
  id: text("id").primaryKey(),
  credentialId: text("credential_id").notNull().references(() => credentials.id, { onDelete: "cascade" }),
  model: text("model").notNull(), // 实际模型名称，如 gpt-4o-mini
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 模型映射配置 (nano/base/pro -> 实际模型)
export const modelMappings = pgTable("model_mappings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(), // nano, base, pro
  credentialModelId: text("credential_model_id").notNull().references(() => credentialModels.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0), // 优先级，数字越小越优先
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 运行时状态 (用于故障转移)
export const credentialStates = pgTable("credential_states", {
  id: text("id").primaryKey(),
  credentialModelId: text("credential_model_id").notNull().references(() => credentialModels.id, { onDelete: "cascade" }).unique(),
  currentConcurrency: integer("current_concurrency").default(0).notNull(),
  isHealthy: boolean("is_healthy").default(true).notNull(),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  cooldownUntil: timestamp("cooldown_until"), // 冷却时间
});

// ============================================
// 关系定义
// ============================================

// 用户关系: has many providers
export const usersRelations = relations(users, ({ many }) => ({
  providers: many(providers),
}));

// 供应商关系: belongs to user, has many credentials
export const providersRelations = relations(providers, ({ one, many }) => ({
  user: one(users, {
    fields: [providers.userId],
    references: [users.id],
  }),
  credentials: many(credentials),
}));

// 凭证关系: belongs to provider, has many credentialModels
export const credentialsRelations = relations(credentials, ({ one, many }) => ({
  provider: one(providers, {
    fields: [credentials.providerId],
    references: [providers.id],
  }),
  models: many(credentialModels),
}));

// 凭证模型关系: belongs to credential
export const credentialModelsRelations = relations(credentialModels, ({ one }) => ({
  credential: one(credentials, {
    fields: [credentialModels.credentialId],
    references: [credentials.id],
  }),
}));

// 模型映射关系: belongs to credentialModel
export const modelMappingsRelations = relations(modelMappings, ({ one }) => ({
  credentialModel: one(credentialModels, {
    fields: [modelMappings.credentialModelId],
    references: [credentialModels.id],
  }),
}));

// 类型导出
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
export type CredentialModel = typeof credentialModels.$inferSelect;
export type NewCredentialModel = typeof credentialModels.$inferInsert;
export type ModelMapping = typeof modelMappings.$inferSelect;
export type NewModelMapping = typeof modelMappings.$inferInsert;
export type CredentialState = typeof credentialStates.$inferSelect;
