import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';

function Root({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>;
}

function Header({ title, backTo, backLabel }: { title: string; backTo: string; backLabel: string }) {
  return (
    <div className="space-y-1">
      <Link to={backTo} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    </div>
  );
}

function Content({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-10 w-24" />
    </div>
  );
}

export const FormPage = { Root, Header, Content, Footer, LoadingSkeleton };
