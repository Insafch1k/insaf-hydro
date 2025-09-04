import { Component, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';

import * as L from 'leaflet';

type Point = [number, number];

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements AfterViewInit {
  selectedTool: 'well' | 'pipe' | null = null;
  svg: any;

  wells: Point[] = [];
  users: Point[] = [];
  isDrawingPipe = false;
  skipNextSamePointCheck = false;

  pipes: {
    vertices: Point[];
    userConnections: { from: Point; to: Point }[];
  }[] = [];
  currentPipe: Point[] = [];
  currentPipeUsers: { from: Point; to: Point }[] = [];

  contextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  contextTarget: { type: 'well' | 'user' | 'pipe'; data: any } | null = null;

  map!: L.Map;
  svgLayer!: d3.Selection<SVGSVGElement, unknown, null, undefined>;

  ngAfterViewInit() {
    // Инициализация карты
    this.map = L.map('map').setView([55.751244, 37.618423], 13); // Москва по умолчанию

    // Добавляем спутниковый слой (например, Esri World Imagery)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 18,
      }
    ).addTo(this.map);

    // Создаем SVG слой на карте
    L.svg().addTo(this.map);

    // Получаем SVG через D3
    this.svg = d3.select(this.map.getPanes().overlayPane).select('svg');

    // Вешаем обработчик клика
    this.svg.on('click', (event: any) => {
      const coords = this.map.mouseEventToLatLng(event);
      const point: Point = [coords.lng, coords.lat];
      this.handleClickOnMap(event, point);
    });

    // Перерисовать всё при движении карты
    this.map.on('move', () => this.redrawAll());
  }

  selectTool(tool: 'well' | 'pipe') {
    if (this.selectedTool === tool) {
      this.selectedTool = null;
      this.isDrawingPipe = false;
      this.currentPipe = [];
      this.currentPipeUsers = [];
    } else {
      this.selectedTool = tool;
      this.isDrawingPipe = false;
      this.currentPipe = [];
      this.currentPipeUsers = [];
    }
  }

  handleClick(event: MouseEvent) {
    const [x, y] = d3.pointer(event);

    if (this.selectedTool === 'pipe' && !this.isDrawingPipe) return;

    if (this.selectedTool === 'pipe' && this.isDrawingPipe) {
      this.handlePipeClick([x, y]);
    }

    if (this.selectedTool === 'well') {
      this.addWell([x, y]);
    }
  }

  addWell(point: Point) {
    this.wells.push(point);

    const wellSize = 30;
    const radius = wellSize / 2;

    const group = this.svg
      .append('g')
      .attr('class', 'well')
      .attr('transform', `translate(${point[0]}, ${point[1]})`)
      .on('click', (event: MouseEvent) => {
        event.stopPropagation();
        this.startPipeFromWell(point);
      })
      .on('contextmenu', (event: MouseEvent) => {
        this.showContextMenu(event, 'well', point);
      });

    group.append('circle').attr('r', radius).attr('fill', 'blue');

    group
      .append('image')
      .attr('xlink:href', 'assets/data/icon/well2.png')
      .attr('x', -radius)
      .attr('y', -radius)
      .attr('width', wellSize)
      .attr('height', wellSize);
  }

  startPipeFromWell(point: Point) {
    if (this.selectedTool === 'pipe' && !this.isDrawingPipe) {
      this.isDrawingPipe = true;
      this.currentPipe = [point];
      this.currentPipeUsers = [];
      this.drawPipeVertex(point, false);
      this.skipNextSamePointCheck = true;
    }
  }

  handlePipeClick(point: Point) {
    if (!this.isDrawingPipe) return;

    const lastPoint = this.currentPipe[this.currentPipe.length - 1];

    if (this.skipNextSamePointCheck) {
      this.skipNextSamePointCheck = false;
    } else if (this.isSamePoint(point, lastPoint)) {
      this.finalizePipe();
      return;
    }

    this.currentPipe.push(point);
    this.redrawAllPipes();
  }

  finalizePipe() {
    this.isDrawingPipe = false;

    this.pipes.push({
      vertices: [...this.currentPipe],
      userConnections: [...this.currentPipeUsers],
    });

    this.currentPipe = [];
    this.currentPipeUsers = [];

    this.redrawAllPipes();
  }

  handleVertexRightClick(point: Point) {
    if (!this.isDrawingPipe) return;

    const lastIndex = this.currentPipe.length - 1;
    const lastPoint = this.currentPipe[lastIndex];

    if (this.isSamePoint(point, lastPoint) && this.currentPipe.length > 1) {
      this.users.push(point);

      this.svg
        .append('image')
        .attr('xlink:href', 'assets/data/icon/user.png')
        .attr('x', point[0] - 10)
        .attr('y', point[1] - 10)
        .attr('width', 20)
        .attr('height', 20)
        .on('contextmenu', (event: MouseEvent) => {
          this.showContextMenu(event, 'user', point);
        });

      this.currentPipeUsers.push({
        from: this.currentPipe[this.currentPipe.length - 2],
        to: point,
      });

      this.currentPipe.pop();
      this.redrawAllPipes();
    }
  }

  isSamePoint(a: Point, b: Point): boolean {
    return Math.abs(a[0] - b[0]) < 5 && Math.abs(a[1] - b[1]) < 5;
  }

  drawPipeVertex(point: Point, finalized: boolean) {
    const size = 10;

    this.svg
      .append('rect')
      .attr('class', 'pipe-temp')
      .attr('x', point[0] - size / 2)
      .attr('y', point[1] - size / 2)
      .attr('width', size)
      .attr('height', size)
      .attr('fill', finalized ? 'yellow' : 'black')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
        this.handleVertexRightClick(point);
      });
  }

  drawLineSegment(from: Point, to: Point) {
    this.svg
      .append('line')
      .attr('class', 'pipe-temp')
      .attr('x1', from[0])
      .attr('y1', from[1])
      .attr('x2', to[0])
      .attr('y2', to[1])
      .attr('stroke', 'black')
      .attr('stroke-width', 2);
  }

  redrawAllPipes() {
    this.svg.selectAll('.pipe-temp').remove();

    this.pipes.forEach((pipe) => {
      pipe.vertices.forEach((pt, i) => {
        this.drawPipeVertex(pt, true);
        if (i > 0) {
          this.drawLineSegment(pipe.vertices[i - 1], pt);
        }
      });

      pipe.userConnections.forEach((conn) => {
        this.drawLineSegment(conn.from, conn.to);
        this.svg
          .append('image')
          .attr('xlink:href', 'assets/data/icon/user.png')
          .attr('x', conn.to[0] - 10)
          .attr('y', conn.to[1] - 10)
          .attr('width', 20)
          .attr('height', 20)
          .on('contextmenu', (event: MouseEvent) => {
            this.showContextMenu(event, 'user', conn.to);
          });
      });

      // contextmenu на трубе
      const group = this.svg
        .append('g')
        .attr('class', 'pipe')
        .on('contextmenu', (event: MouseEvent) => {
          this.showContextMenu(event, 'pipe', pipe);
        });

      group
        .append('path')
        .attr('d', d3.line<Point>()(pipe.vertices)!)
        .attr('fill', 'none')
        .attr('stroke', 'transparent') // сделаем кликабельной
        .attr('stroke-width', 10);
    });

    this.currentPipe.forEach((pt, i) => {
      this.drawPipeVertex(pt, false);
      if (i > 0) {
        this.drawLineSegment(this.currentPipe[i - 1], pt);
      }
    });

    this.currentPipeUsers.forEach((conn) => {
      this.drawLineSegment(conn.from, conn.to);
      this.svg
        .append('image')
        .attr('xlink:href', 'assets/data/icon/user.png')
        .attr('x', conn.to[0] - 10)
        .attr('y', conn.to[1] - 10)
        .attr('width', 20)
        .attr('height', 20);
    });
  }

  showContextMenu(
    event: MouseEvent,
    type: 'well' | 'user' | 'pipe',
    data: any
  ) {
    event.preventDefault();
    this.contextMenuVisible = true;
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.contextTarget = { type, data };

    setTimeout(() => {
      const handler = () => {
        this.contextMenuVisible = false;
        window.removeEventListener('click', handler);
      };
      window.addEventListener('click', handler);
    });
  }

  onDelete() {
    if (!this.contextTarget) return;
    const { type, data } = this.contextTarget;

    if (type === 'well') {
      this.wells = this.wells.filter((w) => !this.isSamePoint(w, data));
    } else if (type === 'user') {
      this.users = this.users.filter((u) => !this.isSamePoint(u, data));
      this.pipes.forEach((p) => {
        p.userConnections = p.userConnections.filter(
          (conn) => !this.isSamePoint(conn.to, data)
        );
      });
    } else if (type === 'pipe') {
      this.pipes = this.pipes.filter((p) => p !== data);
    }

    this.contextMenuVisible = false;
    this.redrawAll();
  }

  redrawAll() {
    this.svg.selectAll('*').remove();
    this.wells.forEach((well) => this.addWell(well));
    this.redrawAllPipes();
  }

  handleClickOnMap(event: MouseEvent, point: Point) {
    if (this.selectedTool === 'pipe' && !this.isDrawingPipe) return;

    if (this.selectedTool === 'pipe' && this.isDrawingPipe) {
      this.handlePipeClick(point);
    }

    if (this.selectedTool === 'well') {
      this.addWell(point);
    }
  }
}
