import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Minus,
  Maximize2,
  HelpCircle,
  GripHorizontal,
  Calculator,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

interface ScientificCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

type AngleMode = "deg" | "rad";

export function ScientificCalculator({
  isOpen,
  onClose,
}: ScientificCalculatorProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasInitializedPos, setHasInitializedPos] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [angleMode, setAngleMode] = useState<AngleMode>("deg");

  const [inputVal, setInputVal] = useState("0");
  const [historyVal, setHistoryVal] = useState("");
  const [memory, setMemory] = useState<number>(0);
  const [hasMemory, setHasMemory] = useState(false);
  const [freshEntry, setFreshEntry] = useState(true);
  const [pendingBinaryOp, setPendingBinaryOp] = useState<string | null>(null);
  const [stackValue, setStackValue] = useState<number | null>(null);

  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  useEffect(() => {
    if (isOpen && !hasInitializedPos && typeof window !== "undefined") {
      const defaultX = Math.max(16, window.innerWidth - 480);
      const defaultY = Math.max(70, window.innerHeight * 0.1);
      setPosition({ x: defaultX, y: defaultY });
      setHasInitializedPos(true);
    }
  }, [isOpen, hasInitializedPos]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = Math.max(0, window.innerWidth - 300);
        const maxY = Math.max(0, window.innerHeight - 80);
        return {
          x: Math.min(prev.x, maxX),
          y: Math.min(prev.y, maxY),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const maxX = Math.max(0, window.innerWidth - (isMinimized ? 240 : 460));
    const maxY = Math.max(0, window.innerHeight - (isMinimized ? 50 : 250));
    setPosition({
      x: Math.min(maxX, Math.max(0, dragRef.current.posX + dx)),
      y: Math.min(maxY, Math.max(0, dragRef.current.posY + dy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.isDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const formatResult = (val: number): string => {
    if (isNaN(val)) return "Math Error";
    if (!isFinite(val)) return "Infinity";
    if (Math.abs(val) < 1e-12 && val !== 0) return "0";
    return parseFloat(val.toPrecision(12)).toString();
  };

  const cleanZero = (val: number): number => {
    return Math.abs(val) < 1e-12 ? 0 : val;
  };

  const toRad = (val: number): number => {
    return angleMode === "deg" ? (val * Math.PI) / 180 : val;
  };

  const fromRad = (val: number): number => {
    return angleMode === "deg" ? (val * 180) / Math.PI : val;
  };

  const handleNumber = (digit: string) => {
    if (inputVal === "Math Error" || inputVal === "Infinity") {
      setInputVal(digit === "." ? "0." : digit);
      setFreshEntry(false);
      return;
    }
    if (digit === ".") {
      if (freshEntry) {
        setInputVal("0.");
        setFreshEntry(false);
      } else if (!inputVal.includes(".")) {
        setInputVal((prev) => prev + ".");
      }
      return;
    }
    if (freshEntry || inputVal === "0") {
      setInputVal(digit);
      setFreshEntry(false);
    } else {
      setInputVal((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (freshEntry || inputVal === "Math Error" || inputVal === "Infinity") {
      setInputVal("0");
      setFreshEntry(true);
      return;
    }
    if (inputVal.length <= 1 || (inputVal.length === 2 && inputVal.startsWith("-"))) {
      setInputVal("0");
      setFreshEntry(true);
    } else {
      setInputVal((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setInputVal("0");
    setHistoryVal("");
    setPendingBinaryOp(null);
    setStackValue(null);
    setFreshEntry(true);
  };

  const handleToggleSign = () => {
    if (inputVal === "Math Error" || inputVal === "Infinity" || inputVal === "0") return;
    if (inputVal.startsWith("-")) {
      setInputVal(inputVal.slice(1));
    } else {
      setInputVal("-" + inputVal);
    }
  };

  const handleConstant = (name: "pi" | "e") => {
    const val = name === "pi" ? Math.PI : Math.E;
    setInputVal(formatResult(val));
    setFreshEntry(true);
  };

  const handleFactorial = (n: number): number => {
    if (n < 0 || isNaN(n)) return NaN;
    if (n === 0 || n === 1) return 1;
    if (n > 170) return Infinity;
    if (n % 1 !== 0) return NaN;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  };

  const handleUnaryOp = (op: string) => {
    const x = parseFloat(inputVal);
    if (isNaN(x)) return;
    let res = 0;
    let label = "";

    switch (op) {
      case "sin":
        if (angleMode === "deg" && x % 180 === 0) res = 0;
        else res = cleanZero(Math.sin(toRad(x)));
        label = `sin(${x})`;
        break;
      case "cos":
        if (angleMode === "deg" && (x - 90) % 180 === 0) res = 0;
        else res = cleanZero(Math.cos(toRad(x)));
        label = `cos(${x})`;
        break;
      case "tan":
        if (angleMode === "deg" && (x - 90) % 180 === 0) res = NaN;
        else if (angleMode === "deg" && x % 180 === 0) res = 0;
        else res = cleanZero(Math.tan(toRad(x)));
        label = `tan(${x})`;
        break;
      case "asin":
        if (x < -1 || x > 1) res = NaN;
        else res = fromRad(Math.asin(x));
        label = `asin(${x})`;
        break;
      case "acos":
        if (x < -1 || x > 1) res = NaN;
        else res = fromRad(Math.acos(x));
        label = `acos(${x})`;
        break;
      case "atan":
        res = fromRad(Math.atan(x));
        label = `atan(${x})`;
        break;
      case "sinh":
        res = Math.sinh(x);
        label = `sinh(${x})`;
        break;
      case "cosh":
        res = Math.cosh(x);
        label = `cosh(${x})`;
        break;
      case "tanh":
        res = Math.tanh(x);
        label = `tanh(${x})`;
        break;
      case "asinh":
        res = Math.asinh(x);
        label = `asinh(${x})`;
        break;
      case "acosh":
        if (x < 1) res = NaN;
        else res = Math.acosh(x);
        label = `acosh(${x})`;
        break;
      case "atanh":
        if (x <= -1 || x >= 1) res = NaN;
        else res = Math.atanh(x);
        label = `atanh(${x})`;
        break;
      case "ln":
        if (x <= 0) res = NaN;
        else res = Math.log(x);
        label = `ln(${x})`;
        break;
      case "log":
        if (x <= 0) res = NaN;
        else res = Math.log10(x);
        label = `log(${x})`;
        break;
      case "log2":
        if (x <= 0) res = NaN;
        else res = Math.log2(x);
        label = `log2(${x})`;
        break;
      case "exp":
        res = Math.exp(x);
        label = `e^(${x})`;
        break;
      case "10x":
        res = Math.pow(10, x);
        label = `10^(${x})`;
        break;
      case "sqr":
        res = x * x;
        label = `sqr(${x})`;
        break;
      case "cube":
        res = x * x * x;
        label = `cube(${x})`;
        break;
      case "sqrt":
        if (x < 0) res = NaN;
        else res = Math.sqrt(x);
        label = `sqrt(${x})`;
        break;
      case "cbrt":
        res = Math.cbrt(x);
        label = `cbrt(${x})`;
        break;
      case "recip":
        if (x === 0) res = NaN;
        else res = 1 / x;
        label = `1/(${x})`;
        break;
      case "fact":
        res = handleFactorial(x);
        label = `fact(${x})`;
        break;
      case "abs":
        res = Math.abs(x);
        label = `abs(${x})`;
        break;
      case "percent":
        res = x / 100;
        label = `${x}%`;
        break;
      default:
        return;
    }

    const formatted = formatResult(res);
    setInputVal(formatted);
    setHistoryVal(label);
    setFreshEntry(true);
  };

  const executeBinary = (a: number, op: string, b: number): number => {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return b === 0 ? Infinity : a / b;
      case "%":
      case "mod":
        return a % b;
      case "^":
        return Math.pow(a, b);
      case "yroot":
        return b === 0 ? NaN : a >= 0 ? Math.pow(a, 1 / b) : b % 2 !== 0 ? -Math.pow(-a, 1 / b) : NaN;
      case "logbase":
        return Math.log(b) === 0 ? NaN : Math.log(a) / Math.log(b);
      default:
        return b;
    }
  };

  const handleBinaryOp = (op: string) => {
    const current = parseFloat(inputVal);
    if (isNaN(current)) return;

    if (stackValue !== null && pendingBinaryOp !== null && !freshEntry) {
      const res = executeBinary(stackValue, pendingBinaryOp, current);
      const formatted = formatResult(res);
      setInputVal(formatted);
      setStackValue(res);
      setHistoryVal(`${formatted} ${op}`);
    } else {
      setStackValue(current);
      setHistoryVal(`${inputVal} ${op}`);
    }

    setPendingBinaryOp(op);
    setFreshEntry(true);
  };

  const handleExpEntry = () => {
    if (inputVal === "Math Error" || inputVal === "Infinity") return;
    if (!inputVal.includes("e")) {
      setInputVal((prev) => prev + "e+0");
      setFreshEntry(false);
    }
  };

  const handleEquals = () => {
    if (pendingBinaryOp === null || stackValue === null) return;
    const current = parseFloat(inputVal);
    if (isNaN(current)) return;

    const res = executeBinary(stackValue, pendingBinaryOp, current);
    const formatted = formatResult(res);
    setHistoryVal(`${stackValue} ${pendingBinaryOp} ${current} =`);
    setInputVal(formatted);
    setStackValue(null);
    setPendingBinaryOp(null);
    setFreshEntry(true);
  };

  const handleMemoryOp = (op: "MC" | "MR" | "MS" | "M+" | "M-") => {
    const current = parseFloat(inputVal) || 0;
    switch (op) {
      case "MC":
        setMemory(0);
        setHasMemory(false);
        break;
      case "MR":
        setInputVal(formatResult(memory));
        setFreshEntry(true);
        break;
      case "MS":
        setMemory(current);
        setHasMemory(current !== 0);
        setFreshEntry(true);
        break;
      case "M+":
        const nextAdd = memory + current;
        setMemory(nextAdd);
        setHasMemory(nextAdd !== 0);
        setFreshEntry(true);
        break;
      case "M-":
        const nextSub = memory - current;
        setMemory(nextSub);
        setHasMemory(nextSub !== 0);
        setFreshEntry(true);
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className={cn(
        "fixed z-50 rounded-xl border border-border shadow-2xl bg-card text-card-foreground select-none overflow-hidden transition-all duration-150 backdrop-blur-md",
        isMinimized ? "w-[240px]" : "w-[440px] sm:w-[464px]"
      )}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="px-3 py-2 bg-muted/80 border-b border-border flex items-center justify-between cursor-grab active:cursor-grabbing text-xs font-semibold text-foreground"
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          <Calculator className="h-4 w-4 text-primary" />
          <span>Scientific Calculator</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Calculator Instructions"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-2.5 sm:p-3 space-y-2.5">
          {showHelp ? (
            <div className="space-y-3 max-h-[360px] overflow-y-auto text-xs pr-1">
              <div className="flex items-center justify-between border-b border-border pb-1.5 font-bold text-foreground">
                <span>Calculator Instructions (TCS iON)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs cursor-pointer"
                  onClick={() => setShowHelp(false)}
                >
                  Back to Keypad
                </Button>
              </div>

              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <div>
                  <h4 className="font-semibold text-foreground">Overview</h4>
                  <p>
                    Performs basic and scientific mathematical operations
                    including modulo, square root, cube root, trigonometric,
                    exponential, logarithmic, and hyperbolic functions.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Do&apos;s
                  </h4>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Press [C] before beginning a new calculation.</li>
                    <li>
                      Select angle unit (Deg or Rad) before calculating
                      trigonometric values.
                    </li>
                    <li>
                      Use memory buttons ([M+], [M-], [MR], [MC]) for cumulative
                      totals.
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-rose-600 dark:text-rose-400">
                    Don&apos;ts
                  </h4>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Do not perform division by zero.</li>
                    <li>
                      Do not switch angle mode midway through an active
                      expression.
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground">Memory Keys</h4>
                  <p>
                    [MS] Store to memory · [MR] Recall memory · [MC] Clear
                    memory · [M+] Add to memory · [M-] Subtract from memory.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden bg-background shadow-inner">
                <div className="h-5 px-2.5 bg-muted/40 font-mono text-[11px] text-muted-foreground flex items-center justify-end truncate">
                  {historyVal || "\u00A0"}
                </div>
                <div className="h-10 px-2.5 flex items-center justify-between font-mono">
                  {hasMemory ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                      M
                    </span>
                  ) : (
                    <span className="w-4" />
                  )}
                  <span className="text-xl font-bold text-foreground truncate select-all">
                    {inputVal}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-11 gap-1">
                <button
                  type="button"
                  onClick={() => handleBinaryOp("mod")}
                  className="h-7 text-[11px] font-medium rounded border border-border/80 bg-secondary/60 hover:bg-secondary text-secondary-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  mod
                </button>

                <div className="col-span-3 flex items-center justify-center gap-1 px-1 bg-muted/50 rounded border border-border/60">
                  <label className="flex items-center gap-1 text-[10px] font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="angleMode"
                      value="deg"
                      checked={angleMode === "deg"}
                      onChange={() => setAngleMode("deg")}
                      className="accent-primary h-3 w-3"
                    />
                    <span>Deg</span>
                  </label>
                  <label className="flex items-center gap-1 text-[10px] font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="angleMode"
                      value="rad"
                      checked={angleMode === "rad"}
                      onChange={() => setAngleMode("rad")}
                      className="accent-primary h-3 w-3"
                    />
                    <span>Rad</span>
                  </label>
                </div>

                <div className="col-span-2" />

                <button
                  type="button"
                  onClick={() => handleMemoryOp("MC")}
                  className="h-7 text-[10px] font-semibold rounded border border-border/80 bg-secondary/60 hover:bg-secondary text-secondary-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  MC
                </button>
                <button
                  type="button"
                  onClick={() => handleMemoryOp("MR")}
                  className="h-7 text-[10px] font-semibold rounded border border-border/80 bg-secondary/60 hover:bg-secondary text-secondary-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  MR
                </button>
                <button
                  type="button"
                  onClick={() => handleMemoryOp("MS")}
                  className="h-7 text-[10px] font-semibold rounded border border-border/80 bg-secondary/60 hover:bg-secondary text-secondary-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  MS
                </button>
                <button
                  type="button"
                  onClick={() => handleMemoryOp("M+")}
                  className="h-7 text-[10px] font-semibold rounded border border-border/80 bg-secondary/60 hover:bg-secondary text-secondary-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  M+
                </button>
                <button
                  type="button"
                  onClick={() => handleMemoryOp("M-")}
                  className="h-7 text-[10px] font-semibold rounded border border-border/80 bg-secondary/60 hover:bg-secondary text-secondary-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  M-
                </button>

                <button
                  type="button"
                  onClick={() => handleUnaryOp("sinh")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  sinh
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("cosh")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  cosh
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("tanh")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  tanh
                </button>
                <button
                  type="button"
                  onClick={handleExpEntry}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  Exp
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryVal((prev) => prev + " ( ")}
                  className="h-7 text-xs font-semibold rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  (
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryVal((prev) => prev + " ) ")}
                  className="h-7 text-xs font-semibold rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  )
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="col-span-2 h-7 text-xs font-bold rounded border border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-7 text-xs font-bold rounded border border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={handleToggleSign}
                  className="h-7 text-xs font-bold rounded border border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  +/-
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("sqrt")}
                  className="h-7 text-xs font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  √
                </button>

                <button
                  type="button"
                  onClick={() => handleUnaryOp("asinh")}
                  className="h-7 text-[10px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  sinh⁻¹
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("acosh")}
                  className="h-7 text-[10px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  cosh⁻¹
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("atanh")}
                  className="h-7 text-[10px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  tanh⁻¹
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("log2")}
                  className="h-7 text-[10px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  log₂x
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("ln")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  ln
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("log")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  log
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("7")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("8")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("9")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => handleBinaryOp("/")}
                  className="h-7 text-xs font-semibold rounded border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  /
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("percent")}
                  className="h-7 text-xs font-semibold rounded border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  %
                </button>

                <button
                  type="button"
                  onClick={() => handleConstant("pi")}
                  className="h-7 text-xs font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  π
                </button>
                <button
                  type="button"
                  onClick={() => handleConstant("e")}
                  className="h-7 text-xs font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  e
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("fact")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  n!
                </button>
                <button
                  type="button"
                  onClick={() => handleBinaryOp("logbase")}
                  className="h-7 text-[10px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  logᵧx
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("exp")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  eˣ
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("10x")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  10ˣ
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("4")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("5")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("6")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => handleBinaryOp("*")}
                  className="h-7 text-xs font-semibold rounded border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  *
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("recip")}
                  className="h-7 text-[10px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  1/x
                </button>

                <button
                  type="button"
                  onClick={() => handleUnaryOp("sin")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  sin
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("cos")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  cos
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("tan")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  tan
                </button>
                <button
                  type="button"
                  onClick={() => handleBinaryOp("^")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  xʸ
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("cube")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  x³
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("sqr")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  x²
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("1")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("2")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("3")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => handleBinaryOp("-")}
                  className="h-7 text-xs font-semibold rounded border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={handleEquals}
                  className="row-span-2 h-[60px] text-lg font-bold rounded border border-emerald-600 bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm"
                >
                  =
                </button>

                <button
                  type="button"
                  onClick={() => handleUnaryOp("asin")}
                  className="h-7 text-[10px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  sin⁻¹
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("acos")}
                  className="h-7 text-[10px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  cos⁻¹
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("atan")}
                  className="h-7 text-[10px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  tan⁻¹
                </button>
                <button
                  type="button"
                  onClick={() => handleBinaryOp("yroot")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  ʸ√x
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("cbrt")}
                  className="h-7 text-xs font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  ∛
                </button>
                <button
                  type="button"
                  onClick={() => handleUnaryOp("abs")}
                  className="h-7 text-[11px] font-medium rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  |x|
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber("0")}
                  className="col-span-2 h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleNumber(".")}
                  className="h-7 text-xs font-bold rounded border border-border bg-background hover:bg-muted/70 text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={() => handleBinaryOp("+")}
                  className="h-7 text-xs font-semibold rounded border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
