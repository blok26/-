import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  RotateCcw,
  Trash2,
  Eraser,
  Eye,
  Sparkles,
} from 'lucide-react';
import { FullStroke, StrokePoint } from '../types/game';

interface DrawingCanvasProps {
  strokes: FullStroke[];
  isDrawer: boolean;
  secretWord?: string;
  category?: string;
  onStartStroke: (color: string, size: number, isEraser: boolean, pt: StrokePoint) => void;
  onAppendPoint: (pt: StrokePoint) => void;
  onEndStroke: () => void;
  onUndo: () => void;
  onClear: () => void;
}

const PALETTE = [
  { name: 'أسود', color: '#1e293b' },
  { name: 'أحمر', color: '#ef4444' },
  { name: 'أزرق', color: '#2563eb' },
  { name: 'أخضر', color: '#16a34a' },
  { name: 'أصفر', color: '#eab308' },
  { name: 'بني', color: '#854d0e' },
  { name: 'وردي', color: '#ec4899' },
  { name: 'أبيض', color: '#ffffff' },
];

const SIZES = [
  { label: 'رفيع', size: 3, dotSize: 'w-2 h-2' },
  { label: 'متوسط', size: 7, dotSize: 'w-3.5 h-3.5' },
  { label: 'عريض', size: 14, dotSize: 'w-5 h-5' },
];

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  strokes,
  isDrawer,
  secretWord,
  category,
  onStartStroke,
  onAppendPoint,
  onEndStroke,
  onUndo,
  onClear,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedColor, setSelectedColor] = useState<string>('#1e293b');
  const [selectedSize, setSelectedSize] = useState<number>(7);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isDrawingLocal, setIsDrawingLocal] = useState<boolean>(false);
  const lastPointRef = useRef<StrokePoint | null>(null);

  // Redraw all strokes cleanly using 1:1 canvas buffer coordinates
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width <= 0 || height <= 0) return;

    // Reset transform to identity (1:1 with buffer pixels)
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear background to clean white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const scaleFactor = width / 500;

    strokes.forEach((stroke) => {
      if (stroke.meta.deleted || stroke.points.length === 0) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.meta.color;
      ctx.lineWidth = Math.max(2, stroke.meta.size * scaleFactor);

      const firstPoint = stroke.points[0];
      const startX = firstPoint.x * width;
      const startY = firstPoint.y * height;
      ctx.moveTo(startX, startY);

      if (stroke.points.length === 1) {
        // Single dot
        ctx.arc(startX, startY, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.meta.color;
        ctx.fill();
        return;
      }

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo(pt.x * width, pt.y * height);
      }
      ctx.stroke();
    });
  }, [strokes]);

  // Adjust canvas size to fit container and devicePixelRatio without transform skew
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const displayWidth = Math.max(200, Math.floor(rect.width));
      const displayHeight = Math.max(200, Math.floor(Math.min(rect.width * 0.85, window.innerHeight * 0.52)));

      canvas.width = Math.round(displayWidth * dpr);
      canvas.height = Math.round(displayHeight * dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      redrawCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [redrawCanvas]);

  // Redraw when strokes change
  useEffect(() => {
    redrawCanvas();
  }, [strokes, redrawCanvas]);

  // Map touch/mouse client coordinates precisely to normalized [0, 1] relative to rendered canvas
  const getRelativePoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const clientX = e.clientX;
    const clientY = e.clientY;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return { x, y };
  };

  // Immediate 60fps local stroke segment rendering under finger
  const drawImmediateSegment = (
    p1: StrokePoint,
    p2: StrokePoint,
    color: string,
    size: number,
    isEraserMode: boolean
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const scaleFactor = width / 500;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isEraserMode ? '#ffffff' : color;
    ctx.lineWidth = Math.max(2, size * scaleFactor);

    ctx.beginPath();
    ctx.moveTo(p1.x * width, p1.y * height);
    ctx.lineTo(p2.x * width, p2.y * height);
    ctx.stroke();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const pt = getRelativePoint(e);
    if (!pt) return;

    setIsDrawingLocal(true);
    lastPointRef.current = pt;

    // Draw immediate dot right at touch location
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const width = canvas.width;
        const height = canvas.height;
        const scaleFactor = width / 500;
        const lineWidth = Math.max(2, selectedSize * scaleFactor);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = isEraser ? '#ffffff' : selectedColor;
        ctx.fill();
      }
    }

    onStartStroke(selectedColor, selectedSize, isEraser, pt);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingLocal) return;
    e.preventDefault();

    const pt = getRelativePoint(e);
    if (!pt) return;

    if (lastPointRef.current) {
      drawImmediateSegment(lastPointRef.current, pt, selectedColor, selectedSize, isEraser);
    }
    lastPointRef.current = pt;
    onAppendPoint(pt);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingLocal) return;
    e.preventDefault();
    setIsDrawingLocal(false);
    lastPointRef.current = null;
    onEndStroke();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className="flex flex-col w-full max-w-lg mx-auto bg-white rounded-3xl shadow-sm border border-amber-200 overflow-hidden">
      {/* Top Banner for Drawer or Guesser */}
      {isDrawer ? (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-200 animate-spin" />
            <div>
              <span className="text-[11px] text-amber-100 block font-medium">دورك في الرسم! الكلمة السرية:</span>
              <span className="text-base font-black tracking-wide text-white drop-shadow-xs">
                {secretWord || '...'}
              </span>
            </div>
          </div>
          {category && (
            <span className="text-xs bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-full font-bold">
              {category}
            </span>
          )}
        </div>
      ) : (
        <div className="bg-slate-100 px-4 py-2 text-slate-600 flex items-center justify-between text-xs font-medium border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600 animate-pulse" />
            <span>راقب الرسم المباشر وخمّن الكلمة!</span>
          </div>
          {category && (
            <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
              الفئة: {category}
            </span>
          )}
        </div>
      )}

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="w-full relative bg-white touch-none select-none flex items-center justify-center p-1.5"
        style={{ minHeight: '260px' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full rounded-2xl border border-slate-200 bg-white touch-none ${
            isDrawer ? 'cursor-crosshair' : 'cursor-default pointer-events-none'
          }`}
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Drawing Toolbar (Drawer Only) */}
      {isDrawer && (
        <div className="bg-slate-50 border-t border-slate-200 p-2.5 flex flex-col gap-2">
          {/* Colors Palette & Eraser */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto py-1 scrollbar-none">
            <div className="flex items-center gap-1.5">
              {PALETTE.map((item) => {
                const isSelected = !isEraser && selectedColor === item.color;
                return (
                  <button
                    key={item.color}
                    onClick={() => {
                      setSelectedColor(item.color);
                      setIsEraser(false);
                    }}
                    className={`w-7 h-7 rounded-full transition-transform border-2 flex items-center justify-center ${
                      isSelected
                        ? 'scale-115 ring-2 ring-indigo-500 ring-offset-1 border-white shadow-xs'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: item.color }}
                    title={item.name}
                    aria-label={`اختيار لون ${item.name}`}
                  />
                );
              })}

              {/* Eraser */}
              <button
                onClick={() => setIsEraser(!isEraser)}
                className={`p-1.5 rounded-xl border transition-all ${
                  isEraser
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title="ممحاة"
                aria-label="ممحاة"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>

            {/* Brush Sizes */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              {SIZES.map((s) => (
                <button
                  key={s.size}
                  onClick={() => setSelectedSize(s.size)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                    selectedSize === s.size ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-50'
                  }`}
                  title={`فرشاة ${s.label}`}
                  aria-label={`حجم فرشاة ${s.label}`}
                >
                  <span
                    className={`rounded-full bg-current ${s.dotSize}`}
                  />
                </button>
              ))}
            </div>

            {/* Actions: Undo & Clear */}
            <div className="flex items-center gap-1">
              <button
                onClick={onUndo}
                className="p-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                title="تراجع عن آخر خط"
                aria-label="تراجع عن آخر خط"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-colors"
                title="مسح اللوحة بالكامل"
                aria-label="مسح اللوحة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full mx-auto flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">مسح اللوحة؟</h3>
              <p className="text-xs text-slate-500 mt-1">
                سيتم مسح جميع الخطوط المرسومة في هذه الجولة نهائيًا.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  onClear();
                }}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm"
              >
                نعم، امسح
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
