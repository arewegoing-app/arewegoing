import { redirect } from 'next/navigation';
import { auth, signIn } from '../lib/auth/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect('/gigs');
  const devEnabled = process.env.NODE_ENV !== 'production';
  const googleEnabled = !!process.env.AUTH_GOOGLE_ID;
  return (
    <div className="mx-auto w-full max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            You only need an account if you&apos;re organising. Friends you invite respond from email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleEnabled && (
            <form
              action={async () => {
                'use server';
                await signIn('google', { redirectTo: '/gigs' });
              }}
            >
              <Button type="submit" className="w-full" size="lg">
                Sign in with Google
              </Button>
            </form>
          )}
          {devEnabled && (
            <form
              action={async (formData: FormData) => {
                'use server';
                const email = String(formData.get('email') ?? '');
                await signIn('dev', { email, redirectTo: '/gigs' });
              }}
              className="space-y-3"
              aria-label="Dev sign in"
            >
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email (dev mode)</Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" variant={googleEnabled ? 'outline' : 'default'}>
                Continue with email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
