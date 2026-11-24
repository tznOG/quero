import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    createdAt: integer('created_at').notNull(),
    passwordHash: text('password_hash').notNull(),
    salt: text('salt').notNull(),
  },
  (t) => [uniqueIndex('profiles_email').on(t.email)],
);
export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    lastSeen: integer('last_seen').notNull().default(0),
  },
  (t) => [index('sessions_expiry').on(t.expiresAt), index('sessions_user').on(t.userId)],
);
export const rateLimits = sqliteTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('rate_limits_expiry').on(t.expiresAt)],
);
export const passwordResets = sqliteTable(
  'password_resets',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [
    index('password_resets_user').on(t.userId),
    index('password_resets_expiry').on(t.expiresAt),
  ],
);
export const wishlists = sqliteTable(
  'wishlists',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    emoji: text('emoji').notNull().default('♡'),
    shareToken: text('share_token'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('wishlists_owner').on(t.userId), uniqueIndex('wishlists_share').on(t.shareToken)],
);
export const categories = sqliteTable(
  'categories',
  {
    id: text('id')
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
  },
  (t) => [uniqueIndex('categories_owner_name').on(t.userId, t.nameKey)],
);
export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    wishlistId: text('wishlist_id')
      .notNull()
      .references(() => wishlists.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    price: integer('price').notNull(),
    targetPrice: integer('target_price'),
    image: text('image').notNull().default(''),
    category: text('category').notNull().default('Outros'),
    priority: text('priority').notNull().default('Quero'),
    notes: text('notes').notNull().default(''),
    purchased: integer('purchased').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('items_list').on(t.wishlistId)],
);
export const reservations = sqliteTable(
  'reservations',
  {
    itemId: text('item_id')
      .primaryKey()
      .references(() => items.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('reservations_user').on(t.userId)],
);
export const follows = sqliteTable(
  'follows',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id),
    wishlistId: text('wishlist_id')
      .notNull()
      .references(() => wishlists.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('follows_unique').on(t.userId, t.wishlistId),
    index('follows_list').on(t.wishlistId),
  ],
);
export const offerCache = sqliteTable('offer_cache', {
  itemId: text('item_id')
    .primaryKey()
    .references(() => items.id, { onDelete: 'cascade' }),
  payload: text('payload').notNull(),
  checkedAt: integer('checked_at').notNull(),
});
