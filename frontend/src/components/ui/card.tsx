import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl bg-white dark:bg-[#141622] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#272B40] overflow-hidden shadow-sm",
          "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          hoverable &&
            "hover:border-[#FF2D87] hover:shadow-[0_0_25px_rgba(255,45,135,0.22)] hover:-translate-y-1",
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-bold tracking-tight text-slate-900 dark:text-white font-sans",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm text-slate-600 dark:text-slate-400 leading-relaxed",
      className,
    )}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center p-6 pt-0 border-t border-slate-100 dark:border-[#272B40]/60 mt-auto",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
