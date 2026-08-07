// V16-F. The illustrative map's world base, generated at build time from Natural Earth via the
// world-atlas package (public-domain data, a devDependency, never a runtime request). Owen on
// 2026-08-06: the map has to hold thirty-plus dealers and zoom from the whole world down to a
// region, so the hand-drawn western-states frame V15-E shipped becomes one overlay on a real
// world outline rather than the whole drawing.
//
// The projection is Web Mercator onto a 1000-unit square (latitude clipped at ±85.0511°), the
// projection every visitor already has in their hands, so nothing about the drawing reads as a
// distortion choice. Antarctica is dropped: no dealer can be there and in Mercator it would take
// a third of the drawing. 110m resolution is deliberate; this map is labelled illustrative, the
// list beside it carries the facts, and coarser coastlines keep the whole base under the size of
// one hero image rung.
import { createRequire } from "node:module";
import { feature, mesh } from "topojson-client";

const require = createRequire(import.meta.url);
const world = require("world-atlas/countries-110m.json");

export const WORLD_SIZE = 1000;
const MAX_LAT = 85.0511;

export const mercatorPoint = (lat, lng) => {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const radians = (clamped * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * WORLD_SIZE,
    y: ((1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2) * WORLD_SIZE,
  };
};

const ring = (coordinates) => `M${coordinates.map(([lng, lat]) => {
  const { x, y } = mercatorPoint(lat, lng);
  return `${x.toFixed(1)} ${y.toFixed(1)}`;
}).join("L")}`;

const geometryPath = (geometry, close) => {
  const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  return polygons.map((polygon) => polygon.map((coords) => `${ring(coords)}${close ? "Z" : ""}`).join("")).join("");
};

const countries = feature(world, world.objects.countries).features.filter((country) => country.properties.name !== "Antarctica");

// One filled path for every landmass and one stroked path for the shared interior borders. Two
// elements regardless of how many dealers arrive, so pin count is the only thing that grows.
export const worldLandPath = countries.map((country) => geometryPath(country.geometry, true)).join("");

const borders = mesh(world, world.objects.countries, (a, b) => a !== b && a.properties.name !== "Antarctica" && b.properties.name !== "Antarctica");
export const worldBordersPath = (borders.type === "MultiLineString" ? borders.coordinates : [borders.coordinates]).map((line) => ring(line)).join("");

// The world's own box in projected units, Antarctica excluded: the outer limit of every zoom-out.
const worldTop = mercatorPoint(84, 0).y;
const worldBottom = mercatorPoint(-56, 0).y;
export const WORLD_BOX = { x: 0, y: Number(worldTop.toFixed(1)), width: WORLD_SIZE, height: Number((worldBottom - worldTop).toFixed(1)) };
