import Image from "next/image";
import { useWhiteLabel } from "../hooks/useIsWhiteLabel";
import { cn } from "../lib/utils";

export const BRAND_NAME = "SWALHA Analytics";

const MARK_SRC = "/swalha/mark-256.png";

export function SwalhaLogo({ width = 32, height = 32 }: { width?: number; height?: number }) {
  const { whiteLabelImage, isPending } = useWhiteLabel();
  const imageStyle = { width, height, objectFit: "contain" as const };

  return (
    <Image
      src={!isPending && whiteLabelImage ? whiteLabelImage : MARK_SRC}
      alt={BRAND_NAME}
      width={width}
      height={height}
      style={imageStyle}
    />
  );
}

/**
 * Mark + product name lockup. Sized by mark height so the wordmark stays
 * legible at every scale; the gold mark is never recoloured or inverted.
 */
export function SwalhaTextLogo({ height = 32, className }: { height?: number; className?: string }) {
  const { whiteLabelImage, isPending } = useWhiteLabel();

  if (!isPending && whiteLabelImage) {
    return (
      <Image
        src={whiteLabelImage}
        alt={BRAND_NAME}
        width={Math.round(height * 5.5)}
        height={height}
        style={{ width: "auto", height, objectFit: "contain" }}
        loading="eager"
      />
    );
  }

  return (
    <div className={cn("flex items-center", className)} style={{ gap: Math.round(height * 0.35) }}>
      <Image
        src={MARK_SRC}
        alt=""
        aria-hidden
        width={height}
        height={height}
        style={{ width: height, height, objectFit: "contain" }}
        loading="eager"
      />
      <span
        className="font-semibold tracking-tight text-foreground whitespace-nowrap leading-none"
        style={{ fontSize: Math.round(height * 0.62) }}
      >
        {BRAND_NAME}
      </span>
    </div>
  );
}
