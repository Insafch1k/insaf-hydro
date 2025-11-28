import * as d3 from 'd3';
import * as L from 'leaflet';
import { Point, Well, User, Pipe } from './map-types';

export function createMap(containerId: string): L.Map {
  return L.map(containerId, {
    attributionControl: false,
    zoomControl: false,
  }).setView([55.827024, 49.132798], 15);
}

export function addGoogleLayer(map: L.Map) {
  L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 19,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '',
  }).addTo(map);
}

export function createSvgLayer(map: L.Map) {
  L.svg().addTo(map);
  const svg = d3.select(map.getPanes().overlayPane).select('svg');
  const g = svg.append('g').attr('class', 'leaflet-objects');

  g.attr('pointer-events', 'all')
    .style('position', 'absolute')
    .style('top', '0')
    .style('left', '0')
    .style('width', '100%')
    .style('height', '100%');

  return { svg, g };
}

export function updateSvgTransform(map: L.Map, svg: any) {
  const bounds = map.getBounds();
  const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
  svg.attr('transform', `translate(${topLeft.x}, ${topLeft.y})`);
}

export function updateObjectPositions(map: L.Map, g: any) {
  g.selectAll('g.well image')
    .attr(
      'x',
      (d: Well) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 12
    )
    .attr(
      'y',
      (d: Well) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 12
    );

  g.selectAll('rect.pipe-temp')
    .attr('x', (d: Point) => map.latLngToLayerPoint(L.latLng(d[1], d[0])).x - 6)
    .attr(
      'y',
      (d: Point) => map.latLngToLayerPoint(L.latLng(d[1], d[0])).y - 6
    );

  g.selectAll('line.pipe-temp, line.pipe-temp-dash')
    .attr(
      'x1',
      (d: [Point, Point]) =>
        map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).x
    )
    .attr(
      'y1',
      (d: [Point, Point]) =>
        map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).y
    )
    .attr(
      'x2',
      (d: [Point, Point]) =>
        map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).x
    )
    .attr(
      'y2',
      (d: [Point, Point]) =>
        map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).y
    );

  g.selectAll('line.pipe-temp-overlay')
    .attr(
      'x1',
      (d: [Point, Point]) =>
        map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).x
    )
    .attr(
      'y1',
      (d: [Point, Point]) =>
        map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).y
    )
    .attr(
      'x2',
      (d: [Point, Point]) =>
        map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).x
    )
    .attr(
      'y2',
      (d: [Point, Point]) =>
        map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).y
    );

  g.selectAll('image.user-icon')
    .attr(
      'x',
      (d: User) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 10
    )
    .attr(
      'y',
      (d: User) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 10
    );

  g.selectAll('image.capture-icon')
    .attr(
      'x',
      (d: any) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 12
    )
    .attr(
      'y',
      (d: any) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 12
    );

  g.selectAll('image.pump-icon')
    .attr(
      'x',
      (d: any) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 12
    )
    .attr(
      'y',
      (d: any) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 12
    );

  g.selectAll('image.reservoir-icon')
    .attr(
      'x',
      (d: any) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 12
    )
    .attr(
      'y',
      (d: any) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 12
    );

  g.selectAll('image.tower-icon')
    .attr(
      'x',
      (d: any) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 12
    )
    .attr(
      'y',
      (d: any) =>
        map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 12
    );
  g.selectAll('circle.pipe-circle')
    .attr('cx', (d: Point) => map.latLngToLayerPoint(L.latLng(d[1], d[0])).x)
    .attr('cy', (d: Point) => map.latLngToLayerPoint(L.latLng(d[1], d[0])).y);
}
