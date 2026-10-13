import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui';

/** Cartão de secção das definições: ícone colorido, título, descrição e conteúdo. */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  color = 'var(--accent)',
  children,
  className,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  color?: string;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <section className={cn('shadow-soft rounded-2xl border border-line bg-surface', className)}>
      <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
        </div>
        {aside}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}
