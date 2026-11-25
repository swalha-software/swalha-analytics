import BoringAvatar from "boring-avatars";
import { createElement } from "react";
// @ts-ignore - React 19 has built-in types
import { renderToStaticMarkup } from "react-dom/server";
import { AVATAR_COLORS } from "./avatarColors";

/**
 * Visitor avatars are neutral generated shapes. Upstream draws its frog mascot
 * here (lib/frogAvatar); this fork does not carry Rybbit's brand character, so
 * the same call sites get a boring-avatars "beam" instead.
 *
 * A standalone `<svg>` string, for the map markers and other places that build
 * DOM by hand instead of rendering React. Client-only: it pulls in
 * react-dom/server, which a Server Component may not import.
 */
export function visitorAvatarSVG(id: string, size: number): string {
  return renderToStaticMarkup(createElement(BoringAvatar, { size, name: id, variant: "beam", colors: AVATAR_COLORS }));
}
