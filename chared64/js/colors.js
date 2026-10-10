// Sampled from commodore64-32x.png and stored in Commodore color-index order.
// The file lays the swatches out by appearance, not by index.
export const C64_COLORS = [
  "#000000",
  "#ffffff",
  "#9f4e44",
  "#6abfc6",
  "#a057a3",
  "#5cab5e",
  "#50459b",
  "#c9d487",
  "#a1683c",
  "#6d5412",
  "#cb7e75",
  "#626262",
  "#898989",
  "#9ae29b",
  "#887ecb",
  "#adadad",
];

export const C64_NAMES = [
  "Black",
  "White",
  "Red",
  "Cyan",
  "Purple",
  "Green",
  "Blue",
  "Yellow",
  "Orange",
  "Brown",
  "Light red",
  "Dark gray",
  "Gray",
  "Light green",
  "Light blue",
  "Light gray",
];

const RGB = C64_COLORS.map((hex) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]);

export function colorRgb(index) {
  return RGB[index & 15];
}
