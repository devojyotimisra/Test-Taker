import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { ThemeToggle } from "./ThemeToggle";

interface NotFoundPageProps {
  onHome: () => void;
}

export function NotFoundPage({ onHome }: NotFoundPageProps) {
  return (
    <div className="min-h-screen h-screen flex flex-col bg-background text-foreground transition-colors overflow-hidden">
      <header className="shrink-0 border-b border-border/80 bg-background/85 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-sm tracking-tight text-foreground">
          Assessment Portal
        </span>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border shadow-xl text-center p-6 sm:p-8">
          <CardContent className="flex flex-col items-center gap-4 p-0">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <span className="font-mono text-5xl sm:text-6xl font-extrabold text-primary tracking-tight block">
                404
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Page Not Found
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                The endpoint or page you requested does not exist or has been
                moved.
              </p>
            </div>

            <Button
              onClick={onHome}
              className="mt-2 w-full gap-2 text-xs sm:text-sm font-semibold bg-primary text-primary-foreground shadow-md h-10 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Assessment Home</span>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
