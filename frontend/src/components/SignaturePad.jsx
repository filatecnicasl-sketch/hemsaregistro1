import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

/**
 * Lienzo de firma manuscrita con soporte para ratón y táctil.
 * Props:
 *  - onChange(dataUrl|null): se invoca con la imagen base64 al terminar un trazo.
 *  - height: alto del lienzo (px). Default 180.
 *  - testid
 */
export default function SignaturePad({ onChange, height = 180, testid = "signature-pad" }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f172a";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPos(e);
  }

  function move(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setHasContent(true);
    onChange?.(dataUrl);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasContent(false);
    onChange?.(null);
  }

  return (
    <div data-testid={testid}>
      <div className="border border-border bg-white rounded-sm relative">
        <canvas
          ref={canvasRef}
          style={{ height: `${height}px`, width: "100%", touchAction: "none", display: "block" }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          data-testid={`${testid}-canvas`}
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-slate-400 uppercase tracking-[0.2em]">
            Firme aquí
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="text-[11px] text-slate-500">
          La firma se asociará a tu identidad y la fecha actual.
        </div>
        <button
          type="button"
          data-testid={`${testid}-clear`}
          onClick={clear}
          className="text-xs text-slate-600 hover:text-black inline-flex items-center gap-1.5 px-2 py-1 border border-border bg-white rounded-sm"
        >
          <Eraser className="w-3.5 h-3.5" /> Limpiar
        </button>
      </div>
    </div>
  );
}
