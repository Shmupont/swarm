"use client";
import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  hue: number;
  hueSpeed: number;
}

export default function NeuralNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas: HTMLCanvasElement = canvasRef.current;
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    let animationId: number;
    let mouseX = -9999;
    let mouseY = -9999;

    const NODE_COUNT = 180;
    const CONNECTION_DIST = 180;
    const MOUSE_ATTRACT_DIST = 250;
    const MOUSE_FORCE = 0.018;
    const MOUSE_REPEL_DIST = 60; // nodes too close get gently pushed away

    const nodes: Node[] = [];

    function initNodes(w: number, h: number) {
      nodes.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        const z = Math.random();
        const speed = 0.15 + (1 - z) * 0.35;
        const angle = Math.random() * Math.PI * 2;
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1.5 + z * 2.5,
          opacity: 0.4 + z * 0.6,
          hue: Math.random() * 360,
          hueSpeed: (Math.random() - 0.5) * 0.6, // slow color drift
        });
      }
    }

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initNodes(canvas.width, canvas.height);
    }

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const node of nodes) {
        // Drift hue
        node.hue = (node.hue + node.hueSpeed + 360) % 360;

        const dx = mouseX - node.x;
        const dy = mouseY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_REPEL_DIST && dist > 0) {
          // Push away when very close
          const force = (1 - dist / MOUSE_REPEL_DIST) * 0.04;
          node.vx -= (dx / dist) * force;
          node.vy -= (dy / dist) * force;
        } else if (dist < MOUSE_ATTRACT_DIST && dist > 0) {
          // Attract from medium range
          const force = (1 - dist / MOUSE_ATTRACT_DIST) * MOUSE_FORCE;
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }

        // Velocity cap + dampen
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const maxSpeed = 2.5;
        if (speed > maxSpeed) {
          node.vx = (node.vx / speed) * maxSpeed;
          node.vy = (node.vy / speed) * maxSpeed;
        }
        node.vx *= 0.994;
        node.vy *= 0.994;

        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges
        if (node.x < 0) { node.x = 0; node.vx = Math.abs(node.vx); }
        if (node.x > w) { node.x = w; node.vx = -Math.abs(node.vx); }
        if (node.y < 0) { node.y = 0; node.vy = Math.abs(node.vy); }
        if (node.y > h) { node.y = h; node.vy = -Math.abs(node.vy); }
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.45;
            // Blend hues of the two nodes for the line color
            const avgHue = (a.hue + b.hue) / 2;
            const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            gradient.addColorStop(0, `hsla(${a.hue}, 100%, 70%, ${alpha})`);
            gradient.addColorStop(1, `hsla(${b.hue}, 100%, 70%, ${alpha})`);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 0.6 + (1 - dist / CONNECTION_DIST) * 0.6;
            ctx.stroke();
            void avgHue;
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const dx = mouseX - node.x;
        const dy = mouseY - node.y;
        const mouseDist = Math.sqrt(dx * dx + dy * dy);
        const mouseBoost = mouseDist < MOUSE_ATTRACT_DIST
          ? (1 - mouseDist / MOUSE_ATTRACT_DIST) * 0.5
          : 0;

        const opacity = Math.min(1, node.opacity + mouseBoost);
        const radius = node.radius + (mouseBoost * 2);

        // Glow effect for nodes near cursor
        if (mouseBoost > 0.1) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${node.hue}, 100%, 70%, ${mouseBoost * 0.15})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${node.hue}, 100%, 75%, ${opacity})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const onMouseLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
