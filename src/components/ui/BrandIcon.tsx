/// <reference types="vite/client" />
import React from "react";

// Canonical brand icon assets (copied verbatim from the handoff package).
// UI icons are single-color and inherit color via CSS mask + currentColor.
// Narrative icons carry baked brand colors and render as <img>.
import uiHome from "../../assets/brand/icons/ui-home.svg";
import uiMemorize from "../../assets/brand/icons/ui-memorize.svg";
import uiCards from "../../assets/brand/icons/ui-cards.svg";
import uiPaths from "../../assets/brand/icons/ui-paths.svg";
import uiSaved from "../../assets/brand/icons/ui-saved.svg";
import uiClue from "../../assets/brand/icons/ui-clue.svg";
import uiShare from "../../assets/brand/icons/ui-share.svg";
import uiDelete from "../../assets/brand/icons/ui-delete.svg";
import uiSearch from "../../assets/brand/icons/ui-search.svg";
import uiSettings from "../../assets/brand/icons/ui-settings.svg";
import uiLanguage from "../../assets/brand/icons/ui-language.svg";
import uiPrevious from "../../assets/brand/icons/ui-previous.svg";
import uiNext from "../../assets/brand/icons/ui-next.svg";
import uiCompletion from "../../assets/brand/icons/ui-completion.svg";
import uiProgress from "../../assets/brand/icons/ui-progress.svg";
import narrativePlant from "../../assets/brand/icons/narrative-plant.svg";
import narrativeTend from "../../assets/brand/icons/narrative-tend.svg";
import narrativeHarvest from "../../assets/brand/icons/narrative-harvest.svg";

const ICON_SOURCES = {
  "ui-home": uiHome,
  "ui-memorize": uiMemorize,
  "ui-cards": uiCards,
  "ui-paths": uiPaths,
  "ui-saved": uiSaved,
  "ui-clue": uiClue,
  "ui-share": uiShare,
  "ui-delete": uiDelete,
  "ui-search": uiSearch,
  "ui-settings": uiSettings,
  "ui-language": uiLanguage,
  "ui-previous": uiPrevious,
  "ui-next": uiNext,
  "ui-completion": uiCompletion,
  "ui-progress": uiProgress,
  "narrative-plant": narrativePlant,
  "narrative-tend": narrativeTend,
  "narrative-harvest": narrativeHarvest,
} as const;

export type BrandIconName = keyof typeof ICON_SOURCES;

export interface BrandIconProps {
  name: BrandIconName;
  /** Rendered box in px (icons scale 1:1, never re-stroked). */
  size?: number;
  /** Accessible name. When provided the icon is exposed as an image. */
  title?: string;
  /** Force color mode: masked (false, follows currentColor) vs baked <img> (true). */
  colored?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a canonical brand SVG asset. Monochrome UI icons use a CSS mask so
 * the parent's `color` drives the fill; narrative icons keep their baked colors
 * via <img>. No inline/duplicated SVG path data, no dangerouslySetInnerHTML.
 */
export function BrandIcon({
  name,
  size = 24,
  title,
  colored,
  className,
  style,
}: BrandIconProps) {
  const src = ICON_SOURCES[name];
  const isColored = colored ?? name.startsWith("narrative-");
  const decorative = !title;
  const dims: React.CSSProperties = { width: size, height: size };

  if (isColored) {
    return (
      <img
        src={src}
        alt={decorative ? "" : title}
        aria-hidden={decorative || undefined}
        width={size}
        height={size}
        draggable={false}
        className={className}
        style={{ display: "inline-block", ...dims, ...style }}
      />
    );
  }

  const maskValue = `url("${src}")`;
  return (
    <span
      className={["vbrand-icon", className].filter(Boolean).join(" ")}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
      style={{
        ...dims,
        WebkitMaskImage: maskValue,
        maskImage: maskValue,
        ...style,
      }}
    />
  );
}

export default BrandIcon;
