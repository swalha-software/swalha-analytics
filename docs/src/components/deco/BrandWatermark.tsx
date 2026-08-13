import Image from "next/image";

/**
 * Oversized SWALHA mark used as a decorative watermark behind hero and CTA
 * sections. The artwork is the canonical gold mark, untouched; the enclosing
 * element supplies the low opacity and rotation that make it read as texture.
 */
export function BrandWatermark({ className }: { className?: string }) {
  return (
    <Image
      src="/swalha/mark-512.png"
      alt=""
      aria-hidden="true"
      width={512}
      height={512}
      className={className ?? "h-auto w-full"}
    />
  );
}
