import * as d3 from 'd3';
import * as L from 'leaflet';
import { Well, User } from '../services/object.service';

export type Point = [number, number];

export class MapRender {
  private map: L.Map;
  private svg: any;
  private g: any;

  constructor(map: L.Map) {
    this.map = map;

    // Создание SVG-слоя
    L.svg().addTo(this.map);
    this.svg = d3.select(this.map.getPanes().overlayPane).select('svg');
    this.g = this.svg.append('g').attr('class', 'leaflet-objects');

    this.g
      .attr('pointer-events', 'all')
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0')
      .style('width', '100%')
      .style('height', '100%');
  }

  getLayer() {
    return this.g;
  }

  updateSvgTransform() {
    const bounds = this.map.getBounds();
    const topLeft = this.map.latLngToLayerPoint(bounds.getNorthWest());
    this.svg.attr('transform', `translate(${topLeft.x}, ${topLeft.y})`);
  }

  updateObjectPositions() {
    // wells
    this.g.selectAll('g.well').attr('transform', (d: Well) => {
      const p = this.map.latLngToLayerPoint(
        L.latLng(d.position[1], d.position[0])
      );
      return `translate(${p.x}, ${p.y})`;
    });

    // users
    this.g
      .selectAll('image.user-icon')
      .attr(
        'x',
        (d: User) =>
          this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0]))
            .x - 10
      )
      .attr(
        'y',
        (d: User) =>
          this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0]))
            .y - 10
      );

    // временные линии, трубы и другие объекты
    this.g
      .selectAll('line.pipe-temp, line.pipe-temp-dash, line.pipe-temp-overlay')
      .each((d: [Point, Point], i: number, nodes: any[]) => {
        const node = d3.select(nodes[i]);

        node
          .attr(
            'x1',
            () => this.map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).x
          )
          .attr(
            'y1',
            () => this.map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).y
          )
          .attr(
            'x2',
            () => this.map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).x
          )
          .attr(
            'y2',
            () => this.map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).y
          );
      });
  }
}
