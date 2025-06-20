import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import * as d3 from 'd3';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { ObjectService, Well, Pipe, User } from '../services/object.service';

type Point = [number, number];

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit, OnDestroy {
  selectedTool: 'well' | 'pipe' | null = null;
  svg: any;
  g: any;
  isDrawingPipe = false;
  skipNextSamePointCheck = false;
  currentPipe: Point[] = [];
  currentPipeUsers: { from: Point; to: Point }[] = [];
  contextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  contextTarget: { type: 'well' | 'user' | 'pipe'; data: any } | null = null;
  map!: L.Map;
  private subscription: Subscription;
  private state: { wells: Well[]; pipes: Pipe[]; users: User[] } = { wells: [], pipes: [], users: [] };
  passports: { id: number; type: 'well' | 'pipe' | 'user'; data: any }[] = [];

  constructor(private objectService: ObjectService) {
    this.subscription = this.objectService.getState().subscribe(state => {
      this.state = state;
      this.redrawAll(state.wells, state.pipes, state.users);
    });
  }

  ngAfterViewInit() {
    this.map = L.map('map', {
      attributionControl: false,
      zoomControl: false
    }).setView([55.81773887844533, 49.12457564650256], 15);

    L.tileLayer(
      'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: ''
      }
    ).addTo(this.map);

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

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.selectedTool) return;
      const point: Point = [e.latlng.lng, e.latlng.lat];
      this.handleClickOnMap(e.originalEvent, point);
    });

    this.map.on('moveend zoomend', () => {
      this.updateSvgTransform();
      this.updateObjectPositions();
    });

    this.updateSvgTransform();
    this.updateObjectPositions();
  }

  zoomIn() {
    this.map.zoomIn();
  }

  zoomOut() {
    this.map.zoomOut();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.map) {
      this.map.off('click');
      this.map.off('moveend zoomend');
    }
    console.log('ngOnDestroy: Map component destroyed');
  }

  updateSvgTransform() {
    const bounds = this.map.getBounds();
    const topLeft = this.map.latLngToLayerPoint(bounds.getNorthWest());
    this.svg.attr('transform', `translate(${topLeft.x}, ${topLeft.y})`);
  }

  updateObjectPositions() {
    this.g.selectAll('g.well').attr('transform', (d: Well) => {
      const p = this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0]));
      return `translate(${p.x}, ${p.y})`;
    });

    this.g.selectAll('rect.pipe-temp').attr('x', (d: Point) => this.map.latLngToLayerPoint(L.latLng(d[1], d[0])).x - 5)
      .attr('y', (d: Point) => this.map.latLngToLayerPoint(L.latLng(d[1], d[0])).y - 5);

    this.g.selectAll('line.pipe-temp')
      .attr('x1', (d: [Point, Point]) => this.map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).x)
      .attr('y1', (d: [Point, Point]) => this.map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).y)
      .attr('x2', (d: [Point, Point]) => this.map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).x)
      .attr('y2', (d: [Point, Point]) => this.map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).y);

    this.g.selectAll('line.pipe-temp-overlay')
      .attr('x1', (d: [Point, Point]) => this.map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).x)
      .attr('y1', (d: [Point, Point]) => this.map.latLngToLayerPoint(L.latLng(d[0][1], d[0][0])).y)
      .attr('x2', (d: [Point, Point]) => this.map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).x)
      .attr('y2', (d: [Point, Point]) => this.map.latLngToLayerPoint(L.latLng(d[1][1], d[1][0])).y);

    this.g.selectAll('image.user-icon').attr('x', (d: User) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 10)
      .attr('y', (d: User) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 10);
  }

  selectTool(tool: 'well' | 'pipe') {
    if (this.selectedTool === tool) {
      this.selectedTool = null;
      this.isDrawingPipe = false;
      this.currentPipe = [];
      this.currentPipeUsers = [];
      this.redrawAllPipes(this.state.pipes, this.state.users);
      this.map.dragging.enable();
      this.map.getContainer().style.cursor = '';
      console.log('selectTool: Deselected tool, reset drawing state');
    } else {
      this.selectedTool = tool;
      this.isDrawingPipe = false;
      this.currentPipe = [];
      this.currentPipeUsers = [];
      this.map.dragging.disable();
      this.map.getContainer().style.cursor = 'crosshair';
      console.log(`selectTool: Selected tool=${tool}`);
    }
  }

  handleClickOnMap(event: MouseEvent, point: Point) {
    if (this.selectedTool === 'pipe' && !this.isDrawingPipe) return;

    if (this.selectedTool === 'pipe' && this.isDrawingPipe) {
      this.handlePipeClick(point);
    }

    if (this.selectedTool === 'well') {
      this.objectService.addWell(point);
    }
  }

  addWell(well: Well) {
    const wellSize = 30;
    const radius = wellSize / 2;

    const group = this.g.append('g')
      .attr('class', 'well')
      .datum(well)
      .on('click', (event: MouseEvent, d: Well) => {
        event.stopPropagation();
        this.startPipeFromWell(well.position);
      })
      .on('contextmenu', (event: MouseEvent, d: Well) => {
        this.showContextMenu(event, 'well', d);
      })
      .on('mouseover', (event: MouseEvent, d: Well) => {
        console.log(`addWell: Hover on well id=${d.id}`);
      });

    group.append('circle')
      .attr('r', radius)
      .attr('fill', 'blue');

    group.append('image')
      .attr('xlink:href', 'assets/data/icon/well2.png')
      .attr('x', -radius)
      .attr('y', -radius)
      .attr('width', wellSize)
      .attr('height', wellSize);

    this.updateObjectPositions();
    console.log(`addWell: Added well id=${well.id}, position=`, well.position);
  }

  handlePipeClick(point: Point) {
    if (!this.isDrawingPipe) {
      console.log('handlePipeClick: Drawing pipe not active');
      return;
    }

    console.log('handlePipeClick: Click for pipe, point:', point, 'currentPipe:', this.currentPipe);

    if (this.currentPipe.length === 0) {
      console.log('handlePipeClick: Adding first vertex:', point);
      this.currentPipe.push(point);
      this.drawPipeVertex(point, false);
      return;
    }

    const lastPoint = this.currentPipe[this.currentPipe.length - 1];
    console.log('handlePipeClick: Last vertex:', lastPoint);

    if (this.skipNextSamePointCheck) {
      console.log('handlePipeClick: Skipping same point check (pipe start)');
      this.skipNextSamePointCheck = false;
    } else if (this.isSamePoint(point, lastPoint)) {
      console.log('handlePipeClick: Finalizing pipe due to click on last vertex');
      this.finalizePipe();
      return;
    }

    console.log('handlePipeClick: Adding vertex:', point);
    this.currentPipe.push(point);
    this.redrawAllPipes(this.state.pipes, this.state.users);
  }

  finalizePipe() {
    console.log('finalizePipe: Finalizing pipe, vertices:', this.currentPipe, 'users:', this.currentPipeUsers);
    this.isDrawingPipe = false;
    if (this.currentPipe.length > 1) {
      this.objectService.addPipe([...this.currentPipe], [...this.currentPipeUsers]);
      console.log('finalizePipe: Pipe saved');
    } else {
      console.log('finalizePipe: Pipe not saved: insufficient vertices');
    }
    this.currentPipe = [];
    this.currentPipeUsers = [];
    this.redrawAllPipes(this.state.pipes, this.state.users);
  }

  handleVertexRightClick(point: Point) {
    if (!this.isDrawingPipe) {
      console.log('handleVertexRightClick: Drawing pipe not active');
      return;
    }

    console.log('handleVertexRightClick: Right-click, point:', point, 'currentPipe:', this.currentPipe);

    const lastIndex = this.currentPipe.length - 1;
    const lastPoint = this.currentPipe[lastIndex];

    if (this.isSamePoint(point, lastPoint) && this.currentPipe.length > 1) {
      console.log('handleVertexRightClick: Right-click on last vertex');
      const userExists = this.state.users.some(u => this.isSamePoint(u.position, point));
      if (!userExists) {
        console.log('handleVertexRightClick: Adding user:', point);
        this.objectService.addUser(point);
        this.currentPipeUsers.push({
          from: this.currentPipe[this.currentPipe.length - 2],
          to: point
        });
        this.currentPipe.pop();
        this.redrawAllPipes(this.state.pipes, this.state.users);
      } else {
        console.log('handleVertexRightClick: User already exists at point');
      }
    }
  }

  isSamePoint(a: Point, b: Point | undefined): boolean {
    if (!b) {
      console.log('isSamePoint: Second point undefined, not same');
      return false;
    }
    const p1 = this.map.latLngToLayerPoint(L.latLng(a[1], a[0]));
    const p2 = this.map.latLngToLayerPoint(L.latLng(b[1], b[0]));
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    console.log('isSamePoint: Comparing points:', a, b, 'distance:', distance);
    return distance < 10;
  }

  drawPipeVertex(point: Point, finalized: boolean) {
    const size = 10;
    this.g.append('rect')
      .attr('class', 'pipe-temp')
      .datum(point)
      .attr('width', size)
      .attr('height', size)
      .attr('fill', finalized ? 'red' : 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
        this.handleVertexRightClick(point);
      })
      .on('mouseover', () => {
        console.log('drawPipeVertex: Hover on vertex', point);
      });
    this.updateObjectPositions();
  }

  drawLineSegment(from: Point, to: Point) {
    // Visible line
    this.g.append('line')
      .attr('class', 'pipe-temp')
      .datum([from, to])
      .attr('stroke', 'blue')
      .attr('stroke-width', 2)
      .attr('pointer-events', 'none')
      .call(() => this.updateObjectPositions());

    // Invisible overlay line for clicking
    this.g.append('line')
      .attr('class', 'pipe-temp-overlay')
      .datum([from, to])
      .attr('stroke', 'transparent')
      .attr('stroke-width', 10)
      .attr('pointer-events', 'all')
      .on('contextmenu', (event: MouseEvent, d: [Point, Point]) => {
        event.preventDefault();
        const pipe = this.state.pipes.find(p => p.vertices.some((v, i) => 
          i > 0 && this.isSamePoint(v, d[1]) && this.isSamePoint(p.vertices[i-1], d[0])
        ));
        if (pipe) {
          this.showContextMenu(event, 'pipe', pipe);
          console.log('drawLineSegment: Context menu triggered for pipe', pipe.id, 'segment:', d);
        } else {
          console.warn('drawLineSegment: No pipe found for segment:', d);
        }
      })
      .on('mouseover', (event: MouseEvent, d: [Point, Point]) => {
        console.log('drawLineSegment: Hover on pipe segment', d);
      })
      .call(() => this.updateObjectPositions());
  }

  redrawAllPipes(pipes: Pipe[], users: User[]) {
    console.log('redrawAllPipes: Redrawing pipes:', pipes, 'users:', users);
    this.g.selectAll('.pipe-temp, .pipe-temp-overlay, .user-icon').remove();

    pipes.forEach(pipe => {
      if (!pipe.visible) return;
      pipe.vertices.forEach((pt, i) => {
        this.drawPipeVertex(pt, true);
        if (i > 0) {
          this.drawLineSegment(pipe.vertices[i - 1], pt);
        }
      });
      pipe.userConnections.forEach(conn => {
        this.drawLineSegment(conn.from, conn.to);
      });
    });

    users.forEach(user => {
      if (!user.visible) return;
      const pixel = this.map.latLngToLayerPoint(L.latLng(user.position[1], user.position[0]));
      this.g.append('image')
        .attr('class', 'user-icon')
        .datum(user)
        .attr('xlink:href', 'assets/data/icon/user.png')
        .attr('x', pixel.x - 10)
        .attr('y', pixel.y - 10)
        .attr('width', 20)
        .attr('height', 20)
        .on('contextmenu', (event: MouseEvent, d: User) => {
          this.showContextMenu(event, 'user', d);
        })
        .on('mouseover', (event: MouseEvent, d: User) => {
          console.log('redrawAllPipes: Hover on user id=', d.id);
        });
    });

    this.currentPipe.forEach((pt, i) => {
      this.drawPipeVertex(pt, false);
      if (i > 0) {
        this.drawLineSegment(this.currentPipe[i - 1], pt);
      }
    });

    this.currentPipeUsers.forEach(conn => {
      this.drawLineSegment(conn.from, conn.to);
      const pixel = this.map.latLngToLayerPoint(L.latLng(conn.to[1], conn.to[0]));
      this.g.append('image')
        .attr('class', 'user-icon')
        .datum(conn.to)
        .attr('xlink:href', 'assets/data/icon/user.png')
        .attr('x', pixel.x - 10)
        .attr('y', pixel.y - 10)
        .attr('width', 20)
        .attr('height', 20);
    });

    this.updateObjectPositions();
  }

  showContextMenu(event: MouseEvent, type: 'well' | 'user' | 'pipe', data: any) {
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
    console.log(`showContextMenu: type=${type}, data.id=${data.id}, position=(${this.contextMenuPosition.x}, ${this.contextMenuPosition.y})`);
  }

  onPassportClosed(id: number) {
    this.passports = this.passports.filter(p => p.id !== id);
    console.log(`onPassportClosed: Removed passport id=${id}, passports=`, this.passports);
  }

  onDelete() {
    if (!this.contextTarget) return;
    const { type, data } = this.contextTarget;

    console.log('onDelete: Deleting:', type, 'id=', data.id);
    if (type === 'well') {
      this.objectService.deleteWell(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'well' && p.data.id === data.id));
    } else if (type === 'user') {
      this.objectService.deleteUser(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'user' && p.data.id === data.id));
    } else if (type === 'pipe') {
      this.objectService.deletePipe(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'pipe' && p.data.id === data.id));
    }

    this.contextMenuVisible = false;
    console.log('onDelete: Passports after deletion:', this.passports);
  }

  redrawAll(wells: Well[], pipes: Pipe[], users: User[]) {
    console.log('redrawAll: Redrawing all objects:', { wells, pipes, users });
    this.g.selectAll('*').remove();
    wells.forEach(well => {
      if (well.visible) {
        this.addWell(well);
      }
    });
    this.redrawAllPipes(pipes, users);
  }

  startPipeFromWell(point: Point) {
    if (this.selectedTool === 'pipe' && !this.isDrawingPipe) {
      console.log('startPipeFromWell: Starting pipe at:', point);
      this.isDrawingPipe = true;
      this.currentPipe = [point];
      this.currentPipeUsers = [];
      this.drawPipeVertex(point, false);
      this.skipNextSamePointCheck = true;
    }
  }

  openPassport(type: 'well' | 'pipe' | 'user' | null, data: any) {
    if (!type || !data || !data.id) {
      console.warn('openPassport: Invalid type or data', { type, data });
      return;
    }

    this.passports = this.passports.filter(p => !(p.type === type && p.data.id === data.id));
    this.passports.push({ id: data.id, type, data });
    this.contextMenuVisible = false;
    console.log(`openPassport: Added passport id=${data.id}, type=${type}, passports=`, this.passports);
  }
}