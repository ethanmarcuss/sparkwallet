import { animate } from "animejs";
import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as React from "react";
import * as QrCode from "@/lib/qr";

/**
 * Renders a QR code with a finder pattern, cells, and an `arena` (if provided).
 *
 * @params {@link Cuer.Props}
 * @returns A {@link React.ReactNode}
 */
export function Cuer(props: Cuer.Props) {
  const { arena, size, ...rest } = props;
  return (
    <Cuer.Root {...rest}>
      <Cuer.Finder />
      <Cuer.Cells />
      {arena && (
        <Cuer.Arena>
          {typeof arena === "string" ? (
            <Image
              alt="Arena"
              src={arena}
              style={{
                borderRadius: 1,
                height: "100%",
                objectFit: "cover",
                width: "100%",
              }}
            />
          ) : (
            arena
          )}
        </Cuer.Arena>
      )}
    </Cuer.Root>
  );
}

export namespace Cuer {
  export type Props = React.PropsWithChildren<
    QrCode.QrCode.Options & {
      /**
       * Arena to display in the center of the QR code.
       *
       * - `string`: will be rendered as an image.
       * - `ReactNode`: will be rendered as a node.
       */
      arena?: React.ReactNode | string | undefined;
      /**
       * Class name for the root element.
       */
      className?: string | undefined;
      /**
       * Foreground color for the QR code.
       *
       * @default "currentColor"
       */
      color?: string | undefined;
      /**
       * Size for the QR code.
       *
       * @default "100%"
       */
      size?: React.CSSProperties["width"] | undefined;
      /**
       * Value to encode in the QR code.
       */
      value: string;
    }
  >;

  export const Context = React.createContext<{
    arenaSize: number;
    cellSize: number;
    edgeSize: number;
    finderSize: number;
    qrcode: QrCode.QrCode;
    mousePos: { x: number; y: number } | null;
    hoverEffect?: boolean;
    hoverColor?: string;
    hoverRadius?: number;
    fill?: string;
  }>(null as never);

  /**
   * Root component for the QR code.
   *
   * @params {@link Root.Props}
   * @returns A {@link React.ReactNode}
   */
  export function Root(props: Root.Props) {
    const {
      children,
      size = "100%",
      value,
      version,
      hoverEffect = false,
      hoverColor,
      hoverRadius = 30,
      ...rest
    } = props;
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
      null
    );
    const svgRef = useRef<SVGSVGElement>(null);
    const mouseMoveRef = useRef<number | null>(null);

    // Check if the children contain an `Arena` component.
    const hasArena = React.useMemo(
      () =>
        (
          React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) return null;
            if (typeof child.type === "string") return null;
            if (
              "displayName" in child.type &&
              child.type.displayName === "Arena"
            )
              return true;
            return null;
          }) ?? []
        ).some(Boolean),
      [children]
    );

    // Create the QR code.
    const qrcode = React.useMemo(() => {
      let errorCorrection = props.errorCorrection;
      // If the QR code has an arena, use a higher error correction level.
      if (hasArena && errorCorrection === "low") errorCorrection = "medium";
      return QrCode.create(value, {
        errorCorrection,
        version,
      });
    }, [value, hasArena, props.errorCorrection, version]);

    const cellSize = 1;
    const edgeSize = qrcode.edgeLength * cellSize;
    const finderSize = (qrcode.finderLength * cellSize) / 2;
    const arenaSize = hasArena ? Math.floor(edgeSize / 4) : 0;

    // Track mouse position for hover effects with throttling for smoother performance
    useEffect(() => {
      if (!hoverEffect || !svgRef.current) return;

      // Capture the current value of the ref
      const currentSvgRef = svgRef.current;

      const handleMouseMove = (e: MouseEvent) => {
        // Cancel any pending RAF to prevent jumpy updates
        if (mouseMoveRef.current) {
          cancelAnimationFrame(mouseMoveRef.current);
        }

        // Use requestAnimationFrame for smoother updates aligned with browser rendering
        mouseMoveRef.current = requestAnimationFrame(() => {
          const svgRect = currentSvgRef?.getBoundingClientRect();
          if (!svgRect) return;

          // Calculate relative mouse position in SVG coordinate space
          const x = (e.clientX - svgRect.left) * (edgeSize / svgRect.width);
          const y = (e.clientY - svgRect.top) * (edgeSize / svgRect.height);

          setMousePos({ x, y });
          mouseMoveRef.current = null;
        });
      };

      const handleMouseLeave = () => {
        if (mouseMoveRef.current) {
          cancelAnimationFrame(mouseMoveRef.current);
          mouseMoveRef.current = null;
        }
        setMousePos(null);
      };

      currentSvgRef.addEventListener("mousemove", handleMouseMove);
      currentSvgRef.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        if (mouseMoveRef.current) {
          cancelAnimationFrame(mouseMoveRef.current);
        }
        currentSvgRef.removeEventListener("mousemove", handleMouseMove);
        currentSvgRef.removeEventListener("mouseleave", handleMouseLeave);
      };
    }, [hoverEffect, edgeSize]);

    const context = React.useMemo(
      () => ({
        arenaSize,
        cellSize,
        edgeSize,
        qrcode,
        finderSize,
        mousePos,
        hoverEffect,
        hoverColor,
        hoverRadius,
        fill: props.fill ?? "currentColor",
      }),
      [
        arenaSize,
        edgeSize,
        qrcode,
        finderSize,
        mousePos,
        hoverEffect,
        hoverColor,
        hoverRadius,
        props.fill,
      ]
    );

    return (
      <Context.Provider value={context}>
        <svg
          {...rest}
          ref={svgRef}
          width={size}
          height={size}
          viewBox={`0 0 ${edgeSize} ${edgeSize}`}
          xmlns="http://www.w3.org/2000/svg">
          <title>QR Code</title>
          {children}
        </svg>
      </Context.Provider>
    );
  }

  export namespace Root {
    export const displayName = "Root";

    export type Props = React.PropsWithChildren<
      QrCode.QrCode.Options &
        Omit<
          React.SVGProps<SVGSVGElement>,
          "children" | "width" | "height" | "version"
        > & {
          /**
           * Size for the QR code.
           *
           * @default "100%"
           */
          size?: React.CSSProperties["width"] | undefined;
          /**
           * Value to encode in the QR code.
           */
          value: string;
          /**
           * Enable hover effect on QR code
           *
           * @default false
           */
          hoverEffect?: boolean;
          /**
           * Color to use for hover effect
           */
          hoverColor?: string;
          /**
           * Radius in SVG units within which cells respond to hover
           *
           * @default 30
           */
          hoverRadius?: number;
        }
    >;
  }

  /**
   * Finder component for the QR code. The finder pattern is the squares
   * on the top left, top right, and bottom left of the QR code.
   *
   * @params {@link Finder.Props}
   * @returns A {@link React.ReactNode}
   */
  export function Finder(props: Finder.Props) {
    const { className, fill: propFill, innerClassName, radius = 0.25 } = props;
    const {
      cellSize,
      edgeSize,
      finderSize,
      fill: contextFill,
    } = React.useContext(Context);

    const baseFill = propFill ?? contextFill;

    const getInnerPosition = (position: string) => {
      let innerX = finderSize - cellSize * 1.5;
      if (position === "top-right")
        innerX = edgeSize - finderSize - cellSize * 1.5;

      let innerY = finderSize - cellSize * 1.5;
      if (position === "bottom-left")
        innerY = edgeSize - finderSize - cellSize * 1.5;

      return { x: innerX, y: innerY };
    };

    const getOuterPosition = (position: string) => {
      let outerX = finderSize - (finderSize - cellSize) - cellSize / 2;
      if (position === "top-right")
        outerX = edgeSize - finderSize - (finderSize - cellSize) - cellSize / 2;

      let outerY = finderSize - (finderSize - cellSize) - cellSize / 2;
      if (position === "bottom-left")
        outerY = edgeSize - finderSize - (finderSize - cellSize) - cellSize / 2;

      return { x: outerX, y: outerY };
    };

    function Inner({ position }: { position: string }) {
      const { x: innerX, y: innerY } = getInnerPosition(position);
      const { x: outerX, y: outerY } = getOuterPosition(position);

      return (
        <>
          <rect
            className={className}
            stroke={baseFill}
            fill="transparent"
            x={outerX}
            y={outerY}
            width={cellSize + (finderSize - cellSize) * 2}
            height={cellSize + (finderSize - cellSize) * 2}
            rx={2 * radius * (finderSize - cellSize)}
            ry={2 * radius * (finderSize - cellSize)}
            strokeWidth={cellSize}
          />
          <rect
            className={innerClassName}
            fill={baseFill}
            x={innerX}
            y={innerY}
            width={cellSize * 3}
            height={cellSize * 3}
            rx={2 * radius * cellSize}
            ry={2 * radius * cellSize}
          />
        </>
      );
    }

    return (
      <>
        <Inner position="top-left" />
        <Inner position="top-right" />
        <Inner position="bottom-left" />
      </>
    );
  }

  export namespace Finder {
    export const displayName = "Finder";

    export type Props = Pick<
      React.SVGProps<SVGRectElement>,
      "className" | "stroke" | "fill"
    > & {
      /**
       * Class name for the inner rectangle.
       */
      innerClassName?: string | undefined;
      /**
       * Radius scale (between 0 and 1) for the finder.
       *
       * @default 0.25
       */
      radius?: number | undefined;
    };
  }

  /**
   * Cells for the QR code.
   *
   * @params {@link Cells.Props}
   * @returns A {@link React.ReactNode}
   */
  export function Cells(props: Cells.Props) {
    const {
      className,
      fill: propFill,
      inset: inset_ = true,
      radius = 1,
    } = props;
    const {
      arenaSize,
      cellSize,
      qrcode,
      mousePos,
      hoverEffect,
      hoverColor,
      hoverRadius,
      fill: contextFill,
    } = React.useContext(Context);

    const baseFill = propFill ?? contextFill;
    const { edgeLength, finderLength } = qrcode;
    const cellsRef = useRef<SVGPathElement[]>([]);

    // Calculate cells to render
    const cells = useMemo(() => {
      const cells: {
        x: number;
        y: number;
        path: string;
        inFinderArea: boolean;
      }[] = [];

      for (let i = 0; i < qrcode.grid.length; i++) {
        const row = qrcode.grid[i];
        if (!row) continue;
        for (let j = 0; j < row.length; j++) {
          const cell = row[j];
          if (!cell) continue;

          // Skip rendering dots in arena area.
          const start = edgeLength / 2 - arenaSize / 2;
          const end = start + arenaSize;
          if (i >= start && i <= end && j >= start && j <= end) continue;

          // Check if in finder pattern areas
          const topLeftFinder = i < finderLength && j < finderLength;
          const topRightFinder =
            i < finderLength && j >= edgeLength - finderLength;
          const bottomLeftFinder =
            i >= edgeLength - finderLength && j < finderLength;

          // Skip rendering dots in the finder pattern areas
          if (topLeftFinder || topRightFinder || bottomLeftFinder) continue;

          // Add inset for padding
          const inset = inset_ ? cellSize * 0.1 : 0;
          const innerSize = (cellSize - inset * 2) / 2;

          // Calculate center positions
          const cx = j * cellSize + cellSize / 2;
          const cy = i * cellSize + cellSize / 2;

          // Calculate edge positions
          const left = cx - innerSize;
          const right = cx + innerSize;
          const top = cy - innerSize;
          const bottom = cy + innerSize;

          // Apply corner radius (clamped to maximum of innerSize)
          const r = radius * innerSize;

          const path = [
            `M ${left + r},${top}`,
            `L ${right - r},${top}`,
            `A ${r},${r} 0 0,1 ${right},${top + r}`,
            `L ${right},${bottom - r}`,
            `A ${r},${r} 0 0,1 ${right - r},${bottom}`,
            `L ${left + r},${bottom}`,
            `A ${r},${r} 0 0,1 ${left},${bottom - r}`,
            `L ${left},${top + r}`,
            `A ${r},${r} 0 0,1 ${left + r},${top}`,
            "z",
          ].join(" ");

          // Track if cell is near finder area for excluding from hover
          const inFinderArea = false;

          cells.push({ x: cx, y: cy, path, inFinderArea });
        }
      }

      return cells;
    }, [
      arenaSize,
      cellSize,
      edgeLength,
      finderLength,
      qrcode.grid,
      inset_,
      radius,
    ]);

    // Parse colors for AnimeJS animations
    const parseColor = React.useCallback((color: string) => {
      let colorValue = color;
      if (colorValue === "currentColor") colorValue = "#000000";
      if (colorValue === "transparent") colorValue = "#000000";

      // Handle CSS variables and hsl values
      if (colorValue.startsWith("hsl")) {
        // Convert hsl to hex for simplicity
        // This is a simple fallback to avoid the hslToRgba error
        return { r: 0, g: 0, b: 0 };
      }

      if (colorValue.startsWith("#")) {
        const hex = colorValue.slice(1);
        // Ensure valid hex pattern
        if (!/^([0-9A-F]{3}){1,2}$/i.test(hex)) {
          return { r: 0, g: 0, b: 0 };
        }

        let r, g, b;
        if (hex.length === 3) {
          // For 3 char hex (#RGB)
          r =
            Number.parseInt(hex.substring(0, 1) + hex.substring(0, 1), 16) || 0;
          g =
            Number.parseInt(hex.substring(1, 2) + hex.substring(1, 2), 16) || 0;
          b =
            Number.parseInt(hex.substring(2, 3) + hex.substring(2, 3), 16) || 0;
        } else {
          // For 6 char hex (#RRGGBB)
          r = Number.parseInt(hex.substring(0, 2), 16) || 0;
          g = Number.parseInt(hex.substring(2, 4), 16) || 0;
          b = Number.parseInt(hex.substring(4, 6), 16) || 0;
        }
        return { r, g, b };
      }

      // Fallback for any other color format
      return { r: 0, g: 0, b: 0 };
    }, []);

    // AnimeJS effect for smooth hover
    useEffect(() => {
      if (!hoverEffect || cellsRef.current.length === 0) return;

      // If mousePos is null (mouse left the component), fade out all cells
      if (!mousePos || !hoverColor) {
        for (const cell of cellsRef.current) {
          if (cell) {
            try {
              // Ensure baseFill is a string before animating
              animate(cell, {
                fill: baseFill ?? "#000000", // Provide default if baseFill is undefined
                duration: 800, // Longer duration for fade-out
                easing: "easeOutExpo", // Smoother exponential ease out
              });
            } catch (err) {
              console.error("Animation error:", err);
              // Fallback - set fill directly if animation fails
              if (cell.setAttribute) {
                cell.setAttribute("fill", baseFill ?? "#000000");
              }
            }
          }
        }
        return;
      }

      // Ensure baseFill and hoverColor are valid strings
      const safeBaseFill = baseFill ?? "#000000";
      const safeHoverColor = hoverColor ?? "#000000"; // Default hover color if undefined
      const safeHoverRadius = hoverRadius ?? 30; // Default radius if undefined

      const baseColor = parseColor(safeBaseFill);
      const targetColor = parseColor(safeHoverColor);

      const animations = cellsRef.current
        .map((cellEl, idx) => {
          if (!cellEl) return null;

          const cell = cells[idx];
          if (!cell) return null;

          const distance = Math.sqrt(
            (cell.x - mousePos.x) ** 2 + (cell.y - mousePos.y) ** 2
          );

          // Calculate intensity based on distance
          const normalizedDistance = Math.min(1, distance / safeHoverRadius); // Use safeHoverRadius
          const intensity = (1 - normalizedDistance) ** 2;

          // Target color values
          const r = Math.round(
            baseColor.r + (targetColor.r - baseColor.r) * intensity
          );
          const g = Math.round(
            baseColor.g + (targetColor.g - baseColor.g) * intensity
          );
          const b = Math.round(
            baseColor.b + (targetColor.b - baseColor.b) * intensity
          );

          try {
            return animate(cellEl, {
              fill: `rgb(${r}, ${g}, ${b})`,
              duration: 350,
              easing: "easeOutQuint",
            });
          } catch (err) {
            console.error("Animation error:", err);
            // Fallback - set fill directly if animation fails
            if (cellEl.setAttribute) {
              cellEl.setAttribute("fill", `rgb(${r}, ${g}, ${b})`);
            }
            return null;
          }
        })
        .filter(Boolean);

      return () => {
        for (const anim of animations) {
          if (anim && typeof anim.pause === "function") {
            anim.pause();
          }
        }
      };
    }, [
      mousePos,
      hoverEffect,
      hoverColor,
      hoverRadius,
      baseFill,
      cells,
      parseColor,
    ]);

    // Ensure refs array matches cells length
    useEffect(() => {
      cellsRef.current = cellsRef.current.slice(0, cells.length);
    }, [cells.length]);

    return (
      <g className={className}>
        {cells.map((cell, idx) => (
          <path
            key={`cell-${cell.x}-${cell.y}`}
            ref={(el) => {
              if (el) cellsRef.current[idx] = el;
            }}
            d={cell.path}
            fill={baseFill}
          />
        ))}
      </g>
    );
  }

  export namespace Cells {
    export const displayName = "Cells";

    export type Props = Pick<
      React.SVGProps<SVGPathElement>,
      "className" | "filter" | "fill"
    > & {
      /**
       * @deprecated @internal
       */
      hasArena?: boolean | undefined;
      /**
       * Whether to add an inset to the cells.
       *
       * @default true
       */
      inset?: boolean | undefined;
      /**
       * Radius scale (between 0 and 1) for the cells.
       *
       * - `0`: no radius
       * - `1`: full radius
       *
       * @default 1
       */
      radius?: number | undefined;
    };
  }

  /**
   * Arena component for the QR code. The arena is the area in the center
   * of the QR code that is not part of the finder pattern.
   *
   * @params {@link Arena.Props}
   * @returns A {@link React.ReactNode}
   */
  export function Arena(props: Arena.Props) {
    const { children } = props;
    const { arenaSize, cellSize, edgeSize } = React.useContext(Context);

    const start = Math.ceil(edgeSize / 2 - arenaSize / 2);
    const size = arenaSize + (arenaSize % 2);
    const padding = cellSize / 2;

    return (
      <foreignObject x={start} y={start} width={size} height={size}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 1,
            justifyContent: "center",
            height: "100%",
            overflow: "hidden",
            width: "100%",
            padding,
            boxSizing: "border-box",
          }}>
          {children}
        </div>
      </foreignObject>
    );
  }

  export namespace Arena {
    export const displayName = "Arena";

    export type Props = {
      children: React.ReactNode;
    };
  }
}

export interface QRCodeProps {
  /**
   * The value to encode in the QR code
   */
  value: string;
  /**
   * The size of the QR code in pixels
   */
  size?: number;
  /**
   * The icon to display in the center
   */
  icon?: string;
  /**
   * The color of the QR code
   */
  fill?: string;
  /**
   * Custom class name
   */
  className?: string;
  /**
   * Custom center content (replaces icon)
   */
  centerContent?: ReactNode;
  /**
   * Enable hover effect on QR code dots
   */
  hoverEffect?: boolean;
  /**
   * Color to use for hover effect
   */
  hoverColor?: string;
  /**
   * Radius of hover effect in pixels
   */
  hoverRadius?: number;
}

/**
 * Custom QR code component built on top of cuer
 */
export function QRCodeComponent({
  value,
  size = 200,
  icon,
  fill = "#F9F9F9",
  className,
  centerContent,
  hoverEffect = false,
  hoverColor = "#FFFFFF",
  hoverRadius = 30,
}: QRCodeProps) {
  return (
    <div className={className}>
      <Cuer.Root
        value={value}
        size={size}
        hoverEffect={hoverEffect}
        hoverColor={hoverColor}
        hoverRadius={hoverRadius}
        fill={fill}>
        <Cuer.Finder />
        <Cuer.Cells />
      </Cuer.Root>
    </div>
  );
}

export default QRCodeComponent;
