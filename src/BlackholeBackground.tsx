/*
 * Copyright 2024 Junho Yeo
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useCallback } from "react";
import { BlackholeRenderer, type BlackholeConfig } from "./BlackholeRenderer";

export interface BlackholeBackgroundProps
  extends Omit<BlackholeConfig, "canvas"> {
  className?: string;
  style?: React.CSSProperties;
  onReady?: (renderer: BlackholeRenderer) => void;
  onTexturesLoaded?: () => void;
}

export function BlackholeBackground({
  className,
  style,
  onReady,
  onTexturesLoaded,
  ...config
}: BlackholeBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BlackholeRenderer | null>(null);

  const initRenderer = useCallback(() => {
    if (!canvasRef.current || rendererRef.current) return;

    const renderer = new BlackholeRenderer({
      canvas: canvasRef.current,
      ...config,
      onTexturesLoaded,
    });

    rendererRef.current = renderer;
    renderer.start();
    onReady?.(renderer);
  }, []);

  useEffect(() => {
    initRenderer();

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [initRenderer]);

  useEffect(() => {
    rendererRef.current?.setConfig(config);
  }, [
    config.cameraDistance,
    config.orbitSpeed,
    config.enableOrbit,
    config.enableControls,
    config.mouseSensitivity,
    config.touchSensitivity,
    config.enableZoom,
    config.minDistance,
    config.maxDistance,
    config.fieldOfView,
    config.showAccretionDisk,
    config.enableLorentzTransform,
    config.enableDopplerShift,
    config.enableBeaming,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        cursor: config.enableControls ? 'grab' : 'default',
        ...style,
      }}
    />
  );
}

export function HeroSection({
  children,
  blackholeProps,
  className,
  style,
}: {
  children?: React.ReactNode;
  blackholeProps?: Omit<BlackholeBackgroundProps, "className" | "style">;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={className}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        overflow: "hidden",
        ...style,
      }}
    >
      <BlackholeBackground
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
        {...blackholeProps}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
        }}
      >
        {children}
      </div>
    </section>
  );
}

export { BlackholeRenderer, type BlackholeConfig };
