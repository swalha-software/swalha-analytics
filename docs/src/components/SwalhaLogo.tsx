import Image from "next/image";

export const BRAND_NAME = "SWALHA Analytics";

export const MARK_SRC = "/swalha/mark-256.png";

/**
 * Mark + product name lockup. Sized by mark height so the wordmark stays
 * legible at every scale; the gold mark is never recoloured or inverted.
 */
export function SwalhaTextLogo({
  height = 28,
  className,
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={`inline-flex items-center ${className ?? ""}`} style={{ gap: Math.round(height * 0.35) }}>
      <Image
        src={MARK_SRC}
        alt=""
        aria-hidden="true"
        width={height}
        height={height}
        priority={priority}
        style={{ width: height, height, objectFit: "contain" }}
      />
      <span
        className="whitespace-nowrap font-semibold leading-none tracking-tight text-neutral-950 dark:text-neutral-50"
        style={{ fontSize: Math.round(height * 0.62) }}
      >
        {BRAND_NAME}
      </span>
    </span>
  );
}
