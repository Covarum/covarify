export const DISPLAY_SEPARATOR = "\u2022";

type DisplayPart = string | number | null | undefined | false;

export function displaySeparated(...parts: DisplayPart[]) {
  return parts
    .filter(
      (part): part is string | number =>
        part !== null && part !== undefined && part !== false && part !== "",
    )
    .join(` ${DISPLAY_SEPARATOR} `);
}
