'use client';

import { useEffect, useRef } from 'react';

type IconKind = 'gold' | 'jewelry' | 'contact';

interface Props {
  kind: IconKind;
}

const DPR_CAP = 2;

export default function ServiceIconCanvas({ kind }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const size = 64;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawBase(ctx);

    if (kind === 'gold') drawGold(ctx);
    if (kind === 'jewelry') drawJewelry(ctx);
    if (kind === 'contact') drawContact(ctx);
  }, [kind]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-16 w-16"
    />
  );
}

function drawBase(ctx: CanvasRenderingContext2D) {
  const ring = ctx.createLinearGradient(10, 8, 54, 56);
  ring.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  ring.addColorStop(0.46, 'rgba(245, 239, 226, 0.94)');
  ring.addColorStop(1, 'rgba(215, 196, 147, 0.72)');

  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(143, 108, 6, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(32, 32, 27.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(32, 32, 21.5, Math.PI * 1.08, Math.PI * 1.76);
  ctx.stroke();
}

function drawGold(ctx: CanvasRenderingContext2D) {
  const gold = ctx.createLinearGradient(17, 18, 47, 47);
  gold.addColorStop(0, '#ffe58a');
  gold.addColorStop(0.42, '#d9a928');
  gold.addColorStop(1, '#9c7107');

  ctx.fillStyle = 'rgba(38, 28, 6, 0.12)';
  roundedPath(ctx, 19, 32, 30, 12, 3);
  ctx.fill();

  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(21, 24);
  ctx.lineTo(43, 24);
  ctx.lineTo(49, 37);
  ctx.lineTo(16, 37);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(97, 70, 3, 0.42)';
  ctx.lineWidth = 1.25;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 250, 219, 0.78)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(23, 27);
  ctx.lineTo(38, 27);
  ctx.stroke();

  ctx.fillStyle = '#fff6c9';
  ctx.beginPath();
  ctx.arc(42, 29, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawJewelry(ctx: CanvasRenderingContext2D) {
  const gold = ctx.createLinearGradient(17, 16, 48, 50);
  gold.addColorStop(0, '#f8d86b');
  gold.addColorStop(0.5, '#c49215');
  gold.addColorStop(1, '#805e08');

  ctx.strokeStyle = gold;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.ellipse(32, 37, 12.5, 9.5, -0.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(32, 16);
  ctx.lineTo(40, 25);
  ctx.lineTo(35, 31);
  ctx.lineTo(29, 31);
  ctx.lineTo(24, 25);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(143, 108, 6, 0.42)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(185, 137, 12, 0.42)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 25);
  ctx.lineTo(40, 25);
  ctx.moveTo(29, 31);
  ctx.lineTo(32, 16);
  ctx.moveTo(35, 31);
  ctx.lineTo(32, 16);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(36, 21, 1.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawContact(ctx: CanvasRenderingContext2D) {
  const gold = ctx.createLinearGradient(20, 17, 46, 46);
  gold.addColorStop(0, '#f7d873');
  gold.addColorStop(1, '#a97a08');

  ctx.strokeStyle = 'rgba(143, 108, 6, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(32, 32, 17, -0.72, 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(32, 32, 23, -0.58, 0.58);
  ctx.stroke();

  ctx.strokeStyle = gold;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(23, 22);
  ctx.bezierCurveTo(21, 29, 25, 39, 36, 43);
  ctx.stroke();

  ctx.fillStyle = '#fffaf0';
  roundedPath(ctx, 19, 17, 10, 11, 3);
  ctx.fill();
  roundedPath(ctx, 36, 38, 11, 9, 3);
  ctx.fill();

  ctx.strokeStyle = 'rgba(126, 88, 4, 0.36)';
  ctx.lineWidth = 1;
  roundedPath(ctx, 19, 17, 10, 11, 3);
  ctx.stroke();
  roundedPath(ctx, 36, 38, 11, 9, 3);
  ctx.stroke();
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
