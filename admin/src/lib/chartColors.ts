/**
 * Categorical chart palette (multi-series: the classroom donut, status
 * breakdowns, anything with more than one differently-named slice).
 *
 * The brand green ramp is one hue at different lightness steps, so two
 * adjacent brand shades read as near-identical on a chart — it was never
 * validated for series distinguishability. This 8-hue set was checked with
 * dataviz's palette validator (adjacent-pair CVD deltaE and lightness band,
 * both light and dark surfaces) and passes clean. Use colors in this
 * declared order — the ordering is the CVD-safety mechanism, not cosmetic.
 *
 * Past 8 series, fold the smallest into "Other" rather than adding a color.
 */
export const CHART_CATEGORICAL_LIGHT = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

export const CHART_CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
] as const;

/** Single-series marks (one line, one bar family) stay on the brand ramp. */
export const CHART_BRAND = {
  line: "#5b9c34",
  fillFrom: "rgba(91, 156, 52, 0.20)",
  fillTo: "rgba(91, 156, 52, 0.01)",
} as const;
