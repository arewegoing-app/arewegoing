import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DroppedPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>You&apos;ve dropped out</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            We&apos;ve let the buyer know and posted your ticket for resale to the rest of the crew. If
            someone takes it, you&apos;re off the hook.
          </p>
          <p>
            If nobody claims it before the deadline, you still owe the buyer for your share. They&apos;ll
            be in touch.
          </p>
          <p>
            <Link href="/" className="text-foreground underline">
              ← back to calendar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
