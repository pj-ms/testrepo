import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { dummyTable } from './db/schema';
import { usersTable } from './db/schema';
import { hashPassword, verifyPassword } from './utils/password-hash';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
// We lazily create the missing tables in our D1 instance. D1 supports the
// "IF NOT EXISTS" syntax so these statements are safe to run multiple times. We
// could also implement migrations via Drizzle Kit but for a toy application the
// overhead isn't worthwhile.
let tablesInitialized = false;
async function ensureSchema(env) {
    if (tablesInitialized)
        return;
    // Using prepare/run instead of Drizzle here because the D1 API doesn't allow
    // multiple statements in a single call. If you find yourself adding more
    // schema operations you should consider bundling them into a user-defined
    // migration.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, username TEXT NOT NULL UNIQUE, description TEXT, profile_photo TEXT)`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tweets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, text TEXT, created_at INTEGER NOT NULL)`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS photos (id INTEGER PRIMARY KEY AUTOINCREMENT, tweet_id INTEGER NOT NULL, url TEXT NOT NULL)`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, tweet_id INTEGER NOT NULL)`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, tweet_id INTEGER NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL)`).run();
    tablesInitialized = true;
}
/**
 * Read the currently authenticated user based on the `session` cookie. If no
 * session exists or it's expired we return `null`. On success we return the
 * complete user record. This helper is used on all endpoints that require
 * authentication.
 */
async function getUserFromSession(c) {
    const token = getCookie(c, 'session');
    if (!token)
        return null;
    const { results: sessions } = await c.env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').bind(token).all();
    if (!sessions || sessions.length === 0)
        return null;
    const session = sessions[0];
    // Expire the session if it's past its expiry time and clean it up.
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds >= session.expires_at) {
        await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
        return null;
    }
    const userId = session.user_id;
    const { results: users } = await c.env.DB.prepare('SELECT id, email, username, description, profile_photo FROM users WHERE id = ?').bind(userId).all();
    if (!users || users.length === 0)
        return null;
    const user = users[0];
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        description: user.description,
        profilePhoto: user.profile_photo,
    };
}
const app = new Hono();
app.use('*', cors({
    origin: (_origin, c) => c.env.CORS_ORIGIN,
    credentials: true,
}));
// Existing routes are provided for demonstration purposes only.
// API routes must ALWAYS be prefixed with /api, to differentiate them from routes that should serve the frontend's static assets.
const routes = app
    .get('/api', async (c) => {
    return c.text('Hello World!');
})
    // $ curl -X POST "http://localhost:8787/api/echo" -H "Content-Type: application/json" -d '{"field1": "value1", "field2": 5}'
    // {"field1":"value1","field2":5}
    .post('/api/echo', zValidator('json', z.object({
    field1: z.string(),
    field2: z.number(),
})), async (c) => {
    const { field1, field2 } = c.req.valid('json');
    return c.json({ field1, field2 });
})
    .get('/api/d1-demo', async (c) => {
    const db = drizzle(c.env.DB);
    await db.delete(dummyTable).where(eq(dummyTable.id, 'test_id'));
    // Should not typically write data in a GET route. This is for demonstration purposes only.
    await db.insert(dummyTable).values({ id: 'test_id', description: 'test description' });
    const result = await db.select().from(dummyTable);
    return c.json(result);
});
// -----------------------------------------------------------------------------
//  Authentication Endpoints
//
// The registration and login flows are modelled after the guidelines provided in
// the project description. We automatically create tables if they don't exist.
routes.post('/api/auth/register', zValidator('json', z.object({
    email: z.string().email(),
    password: z.string().min(6),
    username: z.string().min(1),
})), async (c) => {
    await ensureSchema(c.env);
    const { email, password, username } = await c.req.valid('json');
    const db = drizzle(c.env.DB);
    // Check if user already exists
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).all();
    if (existing.results && existing.results.length > 0) {
        return c.json({ error: 'User already exists' }, 400);
    }
    // Check username uniqueness
    const existingUsername = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).all();
    if (existingUsername.results && existingUsername.results.length > 0) {
        return c.json({ error: 'Username already taken' }, 400);
    }
    const hashed = await hashPassword(password);
    const insertedUser = (await db.insert(usersTable).values({ email, password: hashed, username }).returning())[0];
    const user = insertedUser;
    // Create session
    const token = crypto.randomUUID();
    const expiresAtDate = new Date();
    expiresAtDate.setDate(expiresAtDate.getDate() + 30);
    await c.env.DB.prepare('INSERT INTO sessions (user_id, token, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(user.id, token, Math.floor(Date.now() / 1000), Math.floor(expiresAtDate.getTime() / 1000)).run();
    setCookie(c, 'session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        expires: expiresAtDate,
    });
    return c.json({ id: user.id, email: user.email, username: user.username, description: user.description, profilePhoto: user.profilePhoto || null });
});
routes.post('/api/auth/login', zValidator('json', z.object({
    email: z.string().email(),
    password: z.string(),
})), async (c) => {
    await ensureSchema(c.env);
    const { email, password } = await c.req.valid('json');
    const { results: users } = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).all();
    if (!users || users.length === 0) {
        return c.json({ error: 'User not found' }, 404);
    }
    const user = users[0];
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }
    // Create session
    const token = crypto.randomUUID();
    const expiresAtDate = new Date();
    expiresAtDate.setDate(expiresAtDate.getDate() + 30);
    await c.env.DB.prepare('INSERT INTO sessions (user_id, token, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(user.id, token, Math.floor(Date.now() / 1000), Math.floor(expiresAtDate.getTime() / 1000)).run();
    setCookie(c, 'session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        expires: expiresAtDate,
    });
    return c.json({ id: user.id, email: user.email, username: user.username, description: user.description, profilePhoto: user.profilePhoto || null });
});
routes.post('/api/auth/logout', async (c) => {
    const token = getCookie(c, 'session');
    if (token) {
        await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
        deleteCookie(c, 'session', { expires: new Date(0) });
    }
    return c.json({ success: true });
});
routes.get('/api/auth/me', async (c) => {
    const user = await getUserFromSession(c);
    if (!user) {
        return c.json(null);
    }
    return c.json(user);
});
// -----------------------------------------------------------------------------
//  Tweet Endpoints
// Create a new tweet. Requires authentication.
routes.post('/api/tweets', zValidator('json', z.object({
    text: z.string().max(280),
    images: z.array(z.string()).optional(),
})), async (c) => {
    const user = await getUserFromSession(c);
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    await ensureSchema(c.env);
    const { text, images } = await c.req.valid('json');
    const createdAt = Math.floor(Date.now() / 1000);
    const { results: insertTweet } = await c.env.DB.prepare('INSERT INTO tweets (user_id, text, created_at) VALUES (?, ?, ?) RETURNING id').bind(user.id, text, createdAt).all();
    const insertedTweet = insertTweet[0];
    const tweetId = insertedTweet.id;
    if (images && images.length > 0) {
        // Limit images to 4
        const limitedImages = images.slice(0, 4);
        for (const url of limitedImages) {
            await c.env.DB.prepare('INSERT INTO photos (tweet_id, url) VALUES (?, ?)').bind(tweetId, url).run();
        }
    }
    return c.json({ id: tweetId, userId: user.id, text, images: images || [], createdAt });
});
// Get all tweets with associated user info and photos. Newest first.
routes.get('/api/tweets', async (c) => {
    await ensureSchema(c.env);
    const { results: tweets } = await c.env.DB.prepare(`SELECT t.id, t.text, t.created_at AS createdAt, u.id AS userId, u.username, u.profile_photo AS profilePhoto FROM tweets t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC`).all();
    const { results: photos } = await c.env.DB.prepare('SELECT tweet_id AS tweetId, url FROM photos').all();
    // Group photos by tweetId
    const photoMap = {};
    photos.forEach((p) => {
        const id = p.tweetId.toString();
        if (!photoMap[id])
            photoMap[id] = [];
        photoMap[id].push(p.url);
    });
    const output = tweets.map((t) => ({
        id: t.id,
        text: t.text,
        createdAt: t.createdAt,
        user: { id: t.userId, username: t.username, profilePhoto: t.profilePhoto },
        images: photoMap[t.id] || [],
    }));
    return c.json(output);
});
// Like a tweet. Requires authentication.
routes.post('/api/tweets/:id/like', async (c) => {
    const user = await getUserFromSession(c);
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    // Optionally check if tweet exists
    await c.env.DB.prepare('INSERT INTO likes (user_id, tweet_id) VALUES (?, ?)').bind(user.id, id).run();
    return c.json({ success: true });
});
// Comment on a tweet. Requires authentication.
routes.post('/api/tweets/:id/comment', zValidator('json', z.object({ text: z.string().min(1).max(280) })), async (c) => {
    const user = await getUserFromSession(c);
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { text } = await c.req.valid('json');
    const createdAt = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare('INSERT INTO comments (user_id, tweet_id, text, created_at) VALUES (?, ?, ?, ?)').bind(user.id, id, text, createdAt).run();
    return c.json({ success: true });
});
// Get comments for a specific tweet. Anyone can access.
routes.get('/api/tweets/:id/comments', async (c) => {
    const id = c.req.param('id');
    const { results } = await c.env.DB.prepare('SELECT c.id, c.text, c.created_at AS createdAt, u.id AS userId, u.username, u.profile_photo AS profilePhoto FROM comments c JOIN users u ON c.user_id = u.id WHERE c.tweet_id = ? ORDER BY c.created_at ASC').bind(id).all();
    return c.json(results.map((cmt) => ({ id: cmt.id, text: cmt.text, createdAt: cmt.createdAt, user: { id: cmt.userId, username: cmt.username, profilePhoto: cmt.profilePhoto } })));
});
// Get a user's profile and their tweets. Anyone can access.
routes.get('/api/users/:username', async (c) => {
    const username = c.req.param('username');
    const { results: users } = await c.env.DB.prepare('SELECT id, username, description, profile_photo FROM users WHERE username = ?').bind(username).all();
    if (!users || users.length === 0) {
        return c.json({ error: 'User not found' }, 404);
    }
    const user = users[0];
    const { results: tweets } = await c.env.DB.prepare('SELECT t.id, t.text, t.created_at AS createdAt FROM tweets t WHERE t.user_id = ? ORDER BY t.created_at DESC').bind(user.id).all();
    const { results: photos } = await c.env.DB.prepare('SELECT tweet_id AS tweetId, url FROM photos').all();
    const photoMap = {};
    photos.forEach((p) => {
        const id = p.tweetId.toString();
        if (!photoMap[id])
            photoMap[id] = [];
        photoMap[id].push(p.url);
    });
    const formattedTweets = tweets.map((t) => ({ id: t.id, text: t.text, createdAt: t.createdAt, images: photoMap[t.id] || [] }));
    return c.json({ id: user.id, username: user.username, description: user.description, profilePhoto: user.profile_photo, tweets: formattedTweets });
});
// Update currently authenticated user's profile. Only the provided fields will be updated.
routes.post('/api/users/update', zValidator('json', z.object({
    username: z.string().optional(),
    description: z.string().optional(),
    profilePhoto: z.string().optional(),
})), async (c) => {
    const user = await getUserFromSession(c);
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    const { username, description, profilePhoto } = await c.req.valid('json');
    const updates = [];
    const values = [];
    if (username !== undefined) {
        updates.push('username = ?');
        values.push(username);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
    }
    if (profilePhoto !== undefined) {
        updates.push('profile_photo = ?');
        values.push(profilePhoto);
    }
    if (updates.length === 0) {
        return c.json(user);
    }
    values.push(user.id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await c.env.DB.prepare(sql).bind(...values).run();
    return c.json({ success: true });
});
export default app;
