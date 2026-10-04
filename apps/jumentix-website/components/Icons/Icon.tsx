/**
 * A component for rendering static icons in Next.js apps.
 *
 * Usage:
 * ```tsx
 * import myIcon from './myIcon.svg';
 *
 * // Render with current text color
 * <Icon src={myIcon} width={32} height={32} />
 *
 * // Render with original icon colors
 * <Icon src={myIcon} noFill width={32} height={32} />
 * ```
 */
import type { StaticImageData } from 'next/image';
import type { ComponentProps } from 'react';

type IconProps = Omit<ComponentProps<'img'>, 'src'> & {
  /* Icon path and dimensions */
  src: StaticImageData;
  /* Disables filling with the current color and renders the original icon colors */
  noFill?: boolean;
};

const EMPTY_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E`;

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const Icon = ({ src, noFill, width, height, alt, style, ...props }: IconProps) => {
  const mainSrc = noFill ? src.src : EMPTY_SVG;
  const finalWidth = width ?? src.width;
  const finalHeight = height ?? src.height;
  const finalAlt = alt ?? 'icon';
  const finalStyle = noFill
    ? style
    : {
        ...style,
        backgroundColor: `currentcolor`,
        mask: `url("${src.src}") no-repeat center / contain`
      };

  return (
    // eslint-disable-next-line @next/next/no-img-element -- renders an empty SVG whose visible pixels come from a CSS mask; next/image would break the mask-based icon pattern
    <img
      alt={finalAlt}
      height={finalHeight}
      src={mainSrc}
      style={finalStyle}
      width={finalWidth}
      {...props}
    />
  );
};
