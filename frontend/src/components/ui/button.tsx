import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "accent"
    | "success";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default:
        "bg-primary text-primary-foreground shadow hover:opacity-90 active:scale-[0.98]",
      destructive:
        "bg-destructive text-destructive-foreground shadow hover:opacity-90 active:scale-[0.98]",
      outline:
        "border border-border bg-card text-foreground shadow-sm hover:bg-muted hover:text-foreground active:scale-[0.98]",
      secondary:
        "bg-secondary text-secondary-foreground shadow-sm hover:opacity-90 active:scale-[0.98]",
      ghost: "hover:bg-muted hover:text-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      accent:
        "bg-accent text-accent-foreground shadow hover:opacity-90 active:scale-[0.98]",
      success:
        "bg-emerald-600 text-white shadow hover:bg-emerald-700 active:scale-[0.98]",
    };

    const sizes = {
      default: "h-9 px-4 py-2 text-sm",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-11 rounded-md px-8 text-base font-medium",
      icon: "h-9 w-9",
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
          variants[variant],
          sizes[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
