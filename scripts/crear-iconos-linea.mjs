// Genera assets/iconos.svg con los iconos de línea (Lucide, licencia ISC)
// que usa la maqueta de rediseño. Uso: node scripts/crear-iconos-linea.mjs
import fs from "node:fs";

const ICONOS = [
  "clipboard-check", "wrench", "search", "zap", "circle-dot", "disc", "cog", "link", "snowflake",
  "battery", "activity", "fan", "droplet", "shield-check", "file-text", "car",
  "message-circle", "refresh-cw", "map-pin", "calendar", "bell", "wallet",
  "alarm-clock", "pen-line", "external-link", "gauge", "target", "check", "arrow-right",
  "camera", "phone", "id-card", "triangle-alert",
];

const dir = new URL("../../ven-travel-web/node_modules/lucide-static/icons/", import.meta.url);
const simbolos = ICONOS.map((n) => {
  const svg = fs.readFileSync(new URL(`${n}.svg`, dir), "utf8");
  const interior = svg.slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>")).trim();
  return `<symbol id="i-${n}" viewBox="0 0 24 24">${interior.replace(/\s*\n\s*/g, " ")}</symbol>`;
});
const sprite = `<!-- Iconos de Lucide (https://lucide.dev), licencia ISC -->\n<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${simbolos.join("\n")}\n</svg>\n`;
fs.writeFileSync(new URL("../assets/iconos.svg", import.meta.url), sprite);
console.log(`${ICONOS.length} iconos en assets/iconos.svg (${Math.round(sprite.length / 1024)} KB)`);
