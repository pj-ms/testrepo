/**
 * Drizzle ORM definitions for our application's domain models.
 *
 * The tests in this project require that all API routes live under `/api` but make
 * no assumptions about your schema. With the introduction of a proper users
 * table we can lay the groundwork for authentication as well as persisting
 * application specific records like tweets, comments and likes. Should you need
 * to extend this schema further it's worth adding definitions here instead of
 * sprinkling raw SQL throughout your codebase.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// -----------------------------------------------------------------------------
//  Note: The following definitions are deliberately kept as plain objects and not
//  classes. Drizzle leverages TS's type inference on these descriptors to
//  generate safe query builders.

// Users are at the core of our Twitter clone. We store their email/password
// credentials alongside a public username, a short description and an optional
// profile picture. Passwords are hashed on the server and never exposed via the
// API.
export const usersTable = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    username: text('username').notNull().unique(),
    description: text('description'),
    profilePhoto: text('profile_photo'),
});

// Sessions enable cookie based authentication. Each successful login results in
// issuance of a new session token that references a specific user. Expiry isn't
// currently enforced by a background job but could easily be added.
export const sessionsTable = sqliteTable('sessions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => usersTable.id),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
});

// Tweets are the primary content of our app. A tweet belongs to a user and may
// optionally carry several attached photos.
export const tweetsTable = sqliteTable('tweets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => usersTable.id),
    text: text('text'),
    createdAt: integer('created_at').notNull(),
});

// Photos live on a separate table because SQLite doesn't support array types. For
// simplicity we store images as data URLs. In a production app you'd want to
// leverage Cloudflare's R2 instead!
export const photosTable = sqliteTable('photos', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tweetId: integer('tweet_id').notNull().references(() => tweetsTable.id),
    url: text('url').notNull(),
});

// Likes are a join table between users and tweets. We don't allow a user to like
// the same tweet multiple times but we don't enforce this constraint on the DB
// level for brevity.
export const likesTable = sqliteTable('likes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => usersTable.id),
    tweetId: integer('tweet_id').notNull().references(() => tweetsTable.id),
});

// Comments are also tied to a user and a tweet. Unlike likes comments carry text
// payloads.
export const commentsTable = sqliteTable('comments', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => usersTable.id),
    tweetId: integer('tweet_id').notNull().references(() => tweetsTable.id),
    text: text('text').notNull(),
    createdAt: integer('created_at').notNull(),
});

// Retained for testing purposes. Drizzle migration tests depend on the existence
// of at least one table in your schema (see `/backend/test/index.spec.ts`). Feel
// free to ignore this table or delete it once your tests pass.
export const dummyTable = sqliteTable('dummy', {
    id: text('id').primaryKey(),
    description: text('description').notNull(),
});
