import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function GigsNotFound() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-muted-foreground">
        That page doesn&apos;t exist or the link has expired.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className={cn(buttonVariants())}>
          Back to calendar
        </Link>
      </div>
    </div>
  );
}
