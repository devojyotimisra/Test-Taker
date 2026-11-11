import { Play, Pause, RotateCcw, Clock } from "lucide-react"
import { Button } from "./ui/button"

interface TimerProps {
  seconds: number
  isRunning: boolean
  onToggle: () => void
  onReset: () => void
}

export function Timer({ seconds, isRunning, onToggle, onReset }: TimerProps) {
  const formatTime = (total: number) => {
    const hrs = Math.floor(total / 3600)
    const mins = Math.floor((total % 3600) / 60)
    const secs = total % 60

    const pad = (n: number) => n.toString().padStart(2, "0")

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    }
    return `${pad(mins)}:${pad(secs)}`
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card/80 backdrop-blur-sm px-3.5 py-1.5 shadow-xs">
      <div className="flex items-center gap-2 pr-1">
        <Clock className={`h-4 w-4 ${isRunning ? "text-primary animate-pulse" : "text-amber-500"}`} />
        <span className="font-mono text-base font-semibold tracking-wider text-foreground select-none">
          {formatTime(seconds)}
        </span>
      </div>

      <div className="h-4 w-[1px] bg-border mx-1" />

      <div className="flex items-center gap-1">
        <Button
          variant={isRunning ? "secondary" : "default"}
          size="sm"
          onClick={onToggle}
          title={isRunning ? "Pause timer" : "Start timer"}
          className="h-7 px-2 text-xs"
        >
          {isRunning ? (
            <>
              <Pause className="h-3 w-3" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current" />
              <span>{seconds === 0 ? "Start" : "Resume"}</span>
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          title="Reset timer to 0"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </Button>
      </div>
    </div>
  )
}

