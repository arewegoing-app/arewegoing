import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

const providers = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }));
}
if (process.env.NODE_ENV !== 'production') {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Dev login',
      credentials: { email: { label: 'Email', type: 'email' } },
      authorize: async (creds) => {
        const email = String(creds?.email ?? '').toLowerCase().trim();
        if (!email || !email.includes('@')) return null;
        const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
        let user = existing[0];
        if (!user) {
          const [created] = await db.insert(users).values({ email, name: email.split('@')[0] }).returning();
          user = created;
        }
        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) token.userId = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (token.userId) session.user.id = String(token.userId);
      return session;
    },
  },
  pages: { signIn: '/signin' },
});
