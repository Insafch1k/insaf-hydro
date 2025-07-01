import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import * as d3 from 'd3';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { ObjectService, Well, Pipe, User } from '../services/object.service';
import { DataSchemeService } from '../services/data-scheme.service';
import { Router } from '@angular/router';

type Point = [number, number];

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit, OnDestroy, AfterViewChecked {
  selectedTool: 'well' | 'pipe' | null = null;
  svg: any;
  g: any;
  isDrawingPipe = false;
  skipNextSamePointCheck = false;
  currentPipe: Point[] = [];
  currentPipeUsers: { from: Point; to: Point }[] = [];
  contextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  contextTarget: { type: 'well' | 'user' | 'pipe' | 'capture' | 'pump' | 'reservoir' | 'tower'; data: any } | null = null;
  map!: L.Map;
  private subscription: Subscription;
  private state: { wells: Well[]; pipes: Pipe[]; users: User[]; captures: any[]; pumps: any[]; reservoirs: any[]; towers: any[] } = { wells: [], pipes: [], users: [], captures: [], pumps: [], reservoirs: [], towers: [] };
  passports: { id: number; type: 'well' | 'pipe' | 'user' | 'pipe-segment' | 'capture' | 'pump' | 'reservoir' | 'tower'; data: any }[] = [];
  pipeDiameter: number | null = null;
  showDiameterDialog: boolean = false;
  pipeDiameterInput: number | null = null;
  editMode: boolean = false;
  private dragState: any = null;
  private _dragActive = false;
  private tempLine: { from: Point; to: Point } | null = null; // Для пунктирной линии до курсора
  @ViewChild('diameterInput') diameterInputRef?: ElementRef<HTMLInputElement>;
  private shouldFocusDiameterInput = false;
  private isMapReady = false;
  showObjectTypeDialog: boolean = false;
  objectTypeDialogPosition: { x: number; y: number } = { x: 0, y: 0 };
  objectTypeDialogPoint: Point | null = null;

  constructor(private objectService: ObjectService, private dataSchemeService: DataSchemeService, private router: Router) {
    this.subscription = this.objectService.getState().subscribe(state => {
      this.state = state as any;
      if (this.isMapReady) {
        this.redrawAll();
      }
    });
  }

  ngAfterViewInit() {
    this.map = L.map('map', {
      attributionControl: false,
      zoomControl: false
    }).setView([55.827024, 49.132798], 15);

    L.tileLayer(
      'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      {
        maxZoom: 19,
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

    let isMiddleDragging = false;
    let lastMousePos: { x: number; y: number } | null = null;
    const mapContainer = this.map.getContainer();

    mapContainer.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
    });

    mapContainer.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 1) {
        isMiddleDragging = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        mapContainer.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (isMiddleDragging && lastMousePos) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        lastMousePos = { x: e.clientX, y: e.clientY };
        const currentCenter = this.map.getCenter();
        const pixelCenter = this.map.latLngToContainerPoint(currentCenter);
        const newPixelCenter = L.point(pixelCenter.x - dx, pixelCenter.y - dy);
        const newCenter = this.map.containerPointToLatLng(newPixelCenter);
        this.map.panTo(newCenter, { animate: false });
      } else if (this.isDrawingPipe && this.currentPipe.length >= 1) {
        // Обновляем пунктирную линию до курсора
        const latlng = this.map.mouseEventToLatLng(e);
        this.tempLine = { from: this.currentPipe[this.currentPipe.length - 1], to: [latlng.lng, latlng.lat] };
        this.redrawAllPipes(this.state.pipes, this.state.users);
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 1 && isMiddleDragging) {
        isMiddleDragging = false;
        mapContainer.style.cursor = this.selectedTool ? 'crosshair' : this.editMode ? 'pointer' : '';
      }
    });

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.selectedTool || this.editMode) return;
      const point: Point = [e.latlng.lng, e.latlng.lat];
      this.handleClickOnMap(e.originalEvent, point);
    });

    this.map.on('moveend zoomend', () => {
      this.updateSvgTransform();
      this.updateObjectPositions();
    });

    this.updateSvgTransform();
    this.updateObjectPositions();

    this.isMapReady = true;
    this.redrawAll();
  }

  ngOnInit() {
    const id_scheme = history.state.id_scheme;
    if (id_scheme) {
      this.loadSchemeById(id_scheme);
    }
  }

  loadSchemeById(id_scheme: number) {
    this.dataSchemeService.getSchemeData(id_scheme).subscribe({
      next: (geojson) => {
        // Парсим объекты и добавляем их в ObjectService
        const wells = (geojson.features || [])
          .filter((f: any) => f.name_object_type === 'Скважина')
          .map((f: any) => ({
            id: f.id,
            position: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number],
            visible: true
          }));
        const users = (geojson.features || [])
          .filter((f: any) => f.name_object_type === 'Потребитель')
          .map((f: any) => ({
            id: f.id,
            position: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number],
            visible: true
          }));
        // Группируем отрезки труб по id и собираем их в одну трубу, если возможно
        const pipeSegments = (geojson.features || [])
          .filter((f: any) => f.name_object_type === 'Труба' && f.geometry.type === 'LineString');
        // Группировка по "Имя" трубы, если оно есть, иначе по id
        const pipesMap = new Map<string, [number, number][]>();
        pipeSegments.forEach((seg: any) => {
          const name = seg.properties?.Имя || String(seg.id);
          if (!pipesMap.has(name)) pipesMap.set(name, []);
          seg.geometry.coordinates.forEach((coord: [number, number]) => {
            pipesMap.get(name)!.push([coord[1], coord[0]]);
          });
        });
        const pipes = Array.from(pipesMap.entries()).map(([name, vertices], idx) => ({
          id: idx + 1,
          vertices,
          userConnections: [],
          visible: true,
          diameter: 0 // Можно добавить диаметр из properties, если нужно
        }));
        // Очищаем старое состояние и добавляем новые объекты
        this.objectService['state'].next({ wells, pipes, users, captures: [], pumps: [], reservoirs: [], towers: [] });
      },
      error: (err) => {
        console.error('Ошибка загрузки схемы:', err);
      }
    });
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
    window.removeEventListener('mousemove', this.onDragMove);
    window.removeEventListener('mouseup', this.onDragEnd);
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

    this.g.selectAll('rect.pipe-temp').attr('x', (d: Point) => this.map.latLngToLayerPoint(L.latLng(d[1], d[0])).x - 6)
      .attr('y', (d: Point) => this.map.latLngToLayerPoint(L.latLng(d[1], d[0])).y - 6);

    this.g.selectAll('line.pipe-temp, line.pipe-temp-dash')
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
    this.g.selectAll('image.capture-icon').attr('x', (d: any) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 12)
      .attr('y', (d: any) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 12);
    this.g.selectAll('image.pump-icon').attr('x', (d: any) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 12)
      .attr('y', (d: any) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 12);
    this.g.selectAll('image.reservoir-icon').attr('x', (d: any) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 12)
      .attr('y', (d: any) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 12);
    this.g.selectAll('image.tower-icon').attr('x', (d: any) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).x - 12)
      .attr('y', (d: any) => this.map.latLngToLayerPoint(L.latLng(d.position[1], d.position[0])).y - 12);
  }

  selectTool(tool: 'well' | 'pipe') {
    if (this.selectedTool === tool) {
      this.selectedTool = null;
      this.isDrawingPipe = false;
      this.currentPipe = [];
      this.currentPipeUsers = [];
      this.tempLine = null;
      this.redrawAllPipes(this.state.pipes, this.state.users);
      this.map.dragging.enable();
      this.map.getContainer().style.cursor = this.editMode ? 'pointer' : '';
    } else {
      this.selectedTool = tool;
      this.isDrawingPipe = false;
      this.currentPipe = [];
      this.currentPipeUsers = [];
      this.tempLine = null;
      this.map.dragging.disable();
      this.map.getContainer().style.cursor = 'crosshair';
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
        if (!this.editMode) {
          event.stopPropagation();
          this.startPipeFromWell(well.position);
        }
      })
      .on('mousedown', (event: MouseEvent, d: Well) => {
        if (this.editMode && event.button === 0) {
          event.preventDefault();
          event.stopPropagation();
          this.startDragWell(event, d);
        } else if (event.button === 2) {
          event.preventDefault();
          this.showContextMenu(event, 'well', d);
        }
      })
      .on('mouseover', (event: MouseEvent) => {
        if (this.editMode && event.currentTarget) {
          d3.select(event.currentTarget as SVGGElement).select('circle').attr('fill', 'lightblue');
        }
      })
      .on('mouseout', (event: MouseEvent) => {
        if (this.editMode && event.currentTarget) {
          d3.select(event.currentTarget as SVGGElement).select('circle').attr('fill', 'blue');
        }
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
  }

  handlePipeClick(point: Point) {
    if (!this.isDrawingPipe) return;

    if (this.currentPipe.length === 0) {
      this.currentPipe.push(point);
      this.drawPipeVertex(point, false);
      return;
    }

    const lastPoint = this.currentPipe[this.currentPipe.length - 1];
    if (this.skipNextSamePointCheck) {
      this.skipNextSamePointCheck = false;
    } else if (this.isSamePoint(point, lastPoint)) {
      if (this.currentPipe.length > 1) {
        this.showDiameterDialog = true;
        this.pipeDiameterInput = null;
        this.isDrawingPipe = false;
        this.tempLine = null;
        this.shouldFocusDiameterInput = true;
      }
      return;
    }
    this.currentPipe.push(point);
    this.redrawAllPipes(this.state.pipes, this.state.users);
  }

  finalizePipe() {
    if (this.currentPipe.length > 1 && this.currentPipeUsers.length === 0) {
      const lastIdx = this.currentPipe.length - 1;
      const lastPoint = this.currentPipe[lastIdx];
      const prevPoint = this.currentPipe[lastIdx - 1];
      this.objectService.addUser(lastPoint);
      this.currentPipeUsers.push({ from: prevPoint, to: lastPoint });
    }
    if (this.currentPipe.length > 1 && this.pipeDiameter != null) {
      this.objectService.addPipe([...this.currentPipe], [...this.currentPipeUsers], this.pipeDiameter);
    }
    this.currentPipe = [];
    this.currentPipeUsers = [];
    this.pipeDiameter = null;
    this.showDiameterDialog = false;
    this.isDrawingPipe = false;
    this.tempLine = null;
    this.redrawAllPipes(this.state.pipes, this.state.users);
  }

  handleVertexRightClick(point: Point) {
    if (!this.isDrawingPipe) return;

    const lastIndex = this.currentPipe.length - 1;
    const lastPoint = this.currentPipe[lastIndex];

    if (this.isSamePoint(point, lastPoint) && this.currentPipe.length > 1) {
      // Открываем диалог выбора типа объекта
      this.showObjectTypeDialog = true;
      this.objectTypeDialogPoint = point;
      // Позиция диалога — по последнему клику мыши (можно доработать)
      this.objectTypeDialogPosition = { x: window.event ? (window.event as MouseEvent).clientX : 0, y: window.event ? (window.event as MouseEvent).clientY : 0 };
      return;
    }
  }

  isSamePoint(a: Point, b: Point | undefined): boolean {
    if (!b) return false;
    const p1 = this.map.latLngToLayerPoint(L.latLng(a[1], a[0]));
    const p2 = this.map.latLngToLayerPoint(L.latLng(b[1], b[0]));
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < 10;
  }

  drawPipeVertex(point: Point, finalized: boolean) {
    if (this.state.wells.some(w => this.isSamePoint(w.position, point))) {
      return;
    }
    if (finalized && this.state.users.some(u => this.isSamePoint(u.position, point))) {
      return;
    }

    const size = 12;
    const vertexIndex = this.findPipeVertexIndex(point);
    const pipeId = this.findPipeIdByVertex(point);

    this.g.append('rect')
      .attr('class', 'pipe-temp')
      .datum(point)
      .attr('width', size)
      .attr('height', size)
      .attr('fill', finalized ? 'red' : 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .style('cursor', this.editMode ? 'grab' : 'pointer')
      .on('mousedown', (event: MouseEvent) => {
        if (this.editMode && event.button === 0 && pipeId !== null && vertexIndex !== null) {
          event.preventDefault();
          event.stopPropagation();
          this.startDragPipeVertex(event, pipeId, vertexIndex);
        } else if (event.button === 2) {
          event.preventDefault();
          this.handleVertexRightClick(point);
        }
      })
      .on('mouseover', (event: MouseEvent) => {
        if (this.editMode && event.currentTarget) {
          d3.select(event.currentTarget as SVGRectElement).attr('fill', finalized ? 'pink' : 'lightgray');
        }
      })
      .on('mouseout', (event: MouseEvent) => {
        if (this.editMode && event.currentTarget) {
          d3.select(event.currentTarget as SVGRectElement).attr('fill', finalized ? 'red' : 'white');
        }
      });

    this.updateObjectPositions();
  }

  drawLineSegment(from: Point, to: Point, isDashed: boolean = false) {
    const line = this.g.append('line')
      .attr('class', isDashed ? 'pipe-temp-dash' : 'pipe-temp')
      .datum([from, to])
      .attr('stroke', 'blue')
      .attr('stroke-width', 2)
      .attr('pointer-events', 'none');
    
    if (isDashed) {
      line.attr('stroke-dasharray', '5,5');
    }

    this.g.append('line')
      .attr('class', 'pipe-temp-overlay')
      .datum([from, to])
      .attr('stroke', 'transparent')
      .attr('stroke-width', 15)
      .attr('pointer-events', 'all')
      .on('mousedown', (event: MouseEvent, d: [Point, Point]) => {
        // Проверка: если мышь над вершиной — не начинать drag&drop отрезка
        const mouse = this.map.mouseEventToLatLng(event);
        const mousePoint: Point = [mouse.lng, mouse.lat];
        const distToFrom = this.isSamePoint(mousePoint, d[0]);
        const distToTo = this.isSamePoint(mousePoint, d[1]);
        if (distToFrom || distToTo) {
          // Не начинаем drag&drop отрезка, если мышь над вершиной
          return;
        }
        if (this.editMode && event.button === 0) {
          event.preventDefault();
          event.stopPropagation();
          const pipeId = this.findPipeIdBySegment(d[0], d[1]);
          const fromIndex = pipeId !== null ? this.findPipeVertexIndex(d[0], pipeId) : null;
          const toIndex = pipeId !== null ? this.findPipeVertexIndex(d[1], pipeId) : null;
          if (pipeId !== null && fromIndex !== null && toIndex !== null) {
            this.startDragPipeSegment(event, pipeId, fromIndex, toIndex);
          }
        } else if (event.button === 2) {
          event.preventDefault();
          const pipeId = this.findPipeIdBySegment(d[0], d[1]);
          const fromIndex = pipeId !== null ? this.findPipeVertexIndex(d[0], pipeId) : null;
          const toIndex = pipeId !== null ? this.findPipeVertexIndex(d[1], pipeId) : null;
          if (pipeId !== null && fromIndex !== null && toIndex !== null) {
            // Всегда открываем паспорт отрезка
            this.openPassport('pipe-segment', {
              pipeId,
              from: d[0],
              to: d[1],
              fromIndex,
              toIndex,
              id: `${pipeId}_${fromIndex}_${toIndex}`
            });
          }
        }
      })
      .on('mouseover', (event: MouseEvent) => {
        if (this.editMode && event.currentTarget) {
          d3.select(event.currentTarget as SVGLineElement).attr('stroke', 'lightgray');
        }
      })
      .on('mouseout', (event: MouseEvent) => {
        if (this.editMode && event.currentTarget) {
          d3.select(event.currentTarget as SVGLineElement).attr('stroke', 'transparent');
        }
      })
      .call(() => this.updateObjectPositions());
  }

  redrawAllPipes(pipes: Pipe[], users: User[]) {
    this.g.selectAll('.pipe-temp, .pipe-temp-overlay, .pipe-temp-dash, .user-icon, .capture-icon, .pump-icon, .reservoir-icon, .tower-icon').remove();

    // Сначала рисуем все линии труб
    pipes.forEach(pipe => {
      if (!pipe.visible) return;
      pipe.vertices.forEach((pt, i) => {
        if (i > 0) {
          this.drawLineSegment(pipe.vertices[i - 1], pt, false);
        }
      });
      pipe.userConnections.forEach(conn => {
        this.drawLineSegment(conn.from, conn.to, false);
      });
    });

    // Затем рисуем вершины труб (поверх линий)
    pipes.forEach(pipe => {
      if (!pipe.visible) return;
      pipe.vertices.forEach((pt) => {
        this.drawPipeVertex(pt, true);
      });
    });

    // Отрисовка пользователей
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
        .style('cursor', this.editMode ? 'grab' : 'pointer')
        .on('mousedown', (event: MouseEvent, d: User) => {
          if (this.editMode && event.button === 0) {
            event.preventDefault();
            event.stopPropagation();
            this.startDragUser(event, d);
          } else if (event.button === 2) {
            event.preventDefault();
            this.showContextMenu(event, 'user', d);
          }
        })
        .on('mouseover', (event: MouseEvent) => {
          if (this.editMode && event.currentTarget) {
            d3.select(event.currentTarget as SVGImageElement).attr('opacity', 0.7);
          }
        })
        .on('mouseout', (event: MouseEvent) => {
          if (this.editMode && event.currentTarget) {
            d3.select(event.currentTarget as SVGImageElement).attr('opacity', 1);
          }
        });
    });

    // Отрисовка текущей трубы (пунктирные линии)
    this.currentPipe.forEach((pt, i) => {
      if (i > 0) {
        this.drawLineSegment(this.currentPipe[i - 1], pt, true);
      }
    });
    this.currentPipe.forEach((pt) => {
      this.drawPipeVertex(pt, false);
    });

    // Отрисовка текущих соединений пользователей (пунктирные линии)
    this.currentPipeUsers.forEach(conn => {
      this.drawLineSegment(conn.from, conn.to, true);
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

    // Отрисовка пунктирной линии от последней вершины до курсора
    if (this.tempLine) {
      this.drawLineSegment(this.tempLine.from, this.tempLine.to, true);
    }

    // Отрисовка capture
    (this.state.captures || []).forEach((obj: any) => {
      if (!obj.visible) return;
      const pixel = this.map.latLngToLayerPoint(L.latLng(obj.position[1], obj.position[0]));
      this.g.append('image')
        .attr('class', 'capture-icon')
        .datum(obj)
        .attr('xlink:href', 'assets/data/images/Каптаж.png')
        .attr('x', pixel.x - 12)
        .attr('y', pixel.y - 12)
        .attr('width', 24)
        .attr('height', 24)
        .style('cursor', this.editMode ? 'grab' : 'pointer')
        .on('mousedown', (event: MouseEvent, d: any) => {
          if (this.editMode && event.button === 0) {
            event.preventDefault();
            event.stopPropagation();
            this.startDragSpecialObject(event, d, 'capture');
          } else if (event.button === 2) {
            event.preventDefault();
            this.showContextMenu(event, 'capture', d);
          }
        });
    });
    // Отрисовка pump
    (this.state.pumps || []).forEach((obj: any) => {
      if (!obj.visible) return;
      const pixel = this.map.latLngToLayerPoint(L.latLng(obj.position[1], obj.position[0]));
      this.g.append('image')
        .attr('class', 'pump-icon')
        .datum(obj)
        .attr('xlink:href', 'assets/data/images/Насос.png')
        .attr('x', pixel.x - 12)
        .attr('y', pixel.y - 12)
        .attr('width', 24)
        .attr('height', 24)
        .style('cursor', this.editMode ? 'grab' : 'pointer')
        .on('mousedown', (event: MouseEvent, d: any) => {
          if (this.editMode && event.button === 0) {
            event.preventDefault();
            event.stopPropagation();
            this.startDragSpecialObject(event, d, 'pump');
          } else if (event.button === 2) {
            event.preventDefault();
            this.showContextMenu(event, 'pump', d);
          }
        });
    });
    // Отрисовка reservoir
    (this.state.reservoirs || []).forEach((obj: any) => {
      if (!obj.visible) return;
      const pixel = this.map.latLngToLayerPoint(L.latLng(obj.position[1], obj.position[0]));
      this.g.append('image')
        .attr('class', 'reservoir-icon')
        .datum(obj)
        .attr('xlink:href', 'assets/data/images/контр-резервуар.png')
        .attr('x', pixel.x - 12)
        .attr('y', pixel.y - 12)
        .attr('width', 24)
        .attr('height', 24)
        .style('cursor', this.editMode ? 'grab' : 'pointer')
        .on('mousedown', (event: MouseEvent, d: any) => {
          if (this.editMode && event.button === 0) {
            event.preventDefault();
            event.stopPropagation();
            this.startDragSpecialObject(event, d, 'reservoir');
          } else if (event.button === 2) {
            event.preventDefault();
            this.showContextMenu(event, 'reservoir', d);
          }
        });
    });
    // Отрисовка tower
    (this.state.towers || []).forEach((obj: any) => {
      if (!obj.visible) return;
      const pixel = this.map.latLngToLayerPoint(L.latLng(obj.position[1], obj.position[0]));
      this.g.append('image')
        .attr('class', 'tower-icon')
        .datum(obj)
        .attr('xlink:href', 'assets/data/images/Водонапорная башня.png')
        .attr('x', pixel.x - 12)
        .attr('y', pixel.y - 12)
        .attr('width', 24)
        .attr('height', 24)
        .style('cursor', this.editMode ? 'grab' : 'pointer')
        .on('mousedown', (event: MouseEvent, d: any) => {
          if (this.editMode && event.button === 0) {
            event.preventDefault();
            event.stopPropagation();
            this.startDragSpecialObject(event, d, 'tower');
          } else if (event.button === 2) {
            event.preventDefault();
            this.showContextMenu(event, 'tower', d);
          }
        });
    });

    this.updateObjectPositions();
  }

  showContextMenu(event: MouseEvent, type: 'well' | 'user' | 'pipe' | 'capture' | 'pump' | 'reservoir' | 'tower', data: any) {
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

  onPassportClosed(id: number) {
    this.passports = this.passports.filter(p => p.id !== id);
  }

  onDelete() {
    if (!this.contextTarget) return;
    const { type, data } = this.contextTarget;

    if (type === 'well') {
      this.objectService.deleteWell(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'well' && p.data.id === data.id));
    } else if (type === 'user') {
      this.objectService.deleteUser(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'user' && p.data.id === data.id));
    } else if (type === 'pipe') {
      this.objectService.deletePipe(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'pipe' && p.data.id === data.id));
    } else if (type === 'capture') {
      this.objectService.deleteCapture(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'capture' && p.data.id === data.id));
    } else if (type === 'pump') {
      this.objectService.deletePump(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'pump' && p.data.id === data.id));
    } else if (type === 'reservoir') {
      this.objectService.deleteReservoir(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'reservoir' && p.data.id === data.id));
    } else if (type === 'tower') {
      this.objectService.deleteTower(data.id);
      this.passports = this.passports.filter(p => !(p.type === 'tower' && p.data.id === data.id));
    }

    this.contextMenuVisible = false;
  }

  redrawAll() {
    this.g.selectAll('*').remove();
    this.state.wells.forEach(well => {
      if (well.visible) {
        this.addWell(well);
      }
    });
    this.redrawAllPipes(this.state.pipes, this.state.users);
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

  openPassport(type: 'well' | 'pipe' | 'user' | 'pipe-segment' | 'capture' | 'pump' | 'reservoir' | 'tower' | null, data: any) {
    if (!type || !data) return;

    // Для pipe-segment используем уникальный id по трубе и индексам вершин
    let passportId = data.id;
    if (type === 'pipe-segment' && data.pipeId !== undefined && data.fromIndex !== undefined && data.toIndex !== undefined) {
      passportId = `${data.pipeId}_${data.fromIndex}_${data.toIndex}`;
    }

    this.passports = this.passports.filter(p => !(p.type === type && p.id === passportId));
    this.passports.push({ id: passportId, type, data });
    this.contextMenuVisible = false;
  }

  onDiameterSelected(diameter: number) {
    this.pipeDiameter = diameter;
    this.showDiameterDialog = false;
    this.finalizePipe();
    this.pipeDiameterInput = null;
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    if (this.editMode) {
      this.selectedTool = null;
      this.isDrawingPipe = false;
      this.currentPipe = [];
      this.currentPipeUsers = [];
      this.tempLine = null;
      this.map.dragging.disable();
      this.map.getContainer().style.cursor = 'pointer';
    } else {
      this.map.dragging.enable();
      this.map.getContainer().style.cursor = '';
    }
    this.redrawAll();
  }

  startDragWell(event: MouseEvent, well: Well) {
    event.stopPropagation();
    this.map.dragging.disable();
    this.dragState = { type: 'well', id: well.id };
    this._dragActive = true;
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
    if (event.currentTarget) {
      d3.select(event.currentTarget as SVGGElement).select('circle').attr('fill', 'lightblue');
    }
  }

  startDragUser(event: MouseEvent, user: User) {
    event.stopPropagation();
    this.map.dragging.disable();
    this.dragState = { type: 'user', id: user.id };
    this._dragActive = true;
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
    if (event.currentTarget) {
      d3.select(event.currentTarget as SVGImageElement).attr('opacity', 0.7);
    }
  }

  startDragPipeVertex(event: MouseEvent, pipeId: number, vertexIndex: number) {
    event.stopPropagation();
    this.map.dragging.disable();
    this.dragState = { type: 'vertex', pipeId, vertexIndex };
    this._dragActive = true;
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
    if (event.currentTarget) {
      d3.select(event.currentTarget as SVGRectElement).attr('fill', 'pink');
    }
  }

  startDragPipeSegment(event: MouseEvent, pipeId: number, fromIndex: number, toIndex: number) {
    event.stopPropagation();
    this.map.dragging.disable();
    const pipe = this.state.pipes.find(p => p.id === pipeId);
    if (pipe) {
      this.dragState = { 
        type: 'segment', 
        pipeId, 
        fromIndex, 
        toIndex, 
        initialCenter: this.calculateSegmentCenter(pipe.vertices[fromIndex], pipe.vertices[toIndex]) 
      };
      this._dragActive = true;
      window.addEventListener('mousemove', this.onDragMove);
      window.addEventListener('mouseup', this.onDragEnd);
      if (event.currentTarget) {
        d3.select(event.currentTarget as SVGLineElement).attr('stroke', 'lightgray');
      }
    }
  }

  onDragMove = (event: MouseEvent) => {
    if (!this.dragState || !this._dragActive) return;

    const latlng = this.map.mouseEventToLatLng(event);
    const newPos: Point = [latlng.lng, latlng.lat];

    const bounds = this.map.getBounds();
    if (latlng.lat < bounds.getSouth() || latlng.lat > bounds.getNorth() ||
        latlng.lng < bounds.getWest() || latlng.lng > bounds.getEast()) {
      return;
    }

    if (this.dragState.type === 'well') {
      this.objectService.moveWell(this.dragState.id, newPos);
      this.redrawAllPipes(this.state.pipes, this.state.users);
    } else if (this.dragState.type === 'user') {
      this.objectService.moveUser(this.dragState.id, newPos);
      this.redrawAllPipes(this.state.pipes, this.state.users);
    } else if (this.dragState.type === 'vertex') {
      const pipe = this.state.pipes.find(p => p.id === this.dragState.pipeId);
      if (pipe) {
        this.objectService.movePipeVertex(this.dragState.pipeId, this.dragState.vertexIndex, newPos);
        this.redrawAllPipes(this.state.pipes, this.state.users);
      }
    } else if (this.dragState.type === 'segment') {
      const pipe = this.state.pipes.find(p => p.id === this.dragState.pipeId);
      if (pipe) {
        const newCenter = newPos;
        const delta: Point = [
          newCenter[0] - this.dragState.initialCenter[0],
          newCenter[1] - this.dragState.initialCenter[1]
        ];
        this.objectService.movePipeSegment(this.dragState.pipeId, this.dragState.fromIndex, this.dragState.toIndex, delta);
        this.dragState.initialCenter = newCenter;
        this.redrawAllPipes(this.state.pipes, this.state.users);
      }
    } else if (this.dragState.type === 'capture') {
      this.objectService.moveCapture(this.dragState.id, newPos);
      this.redrawAllPipes(this.state.pipes, this.state.users);
    } else if (this.dragState.type === 'pump') {
      this.objectService.movePump(this.dragState.id, newPos);
      this.redrawAllPipes(this.state.pipes, this.state.users);
    } else if (this.dragState.type === 'reservoir') {
      this.objectService.moveReservoir(this.dragState.id, newPos);
      this.redrawAllPipes(this.state.pipes, this.state.users);
    } else if (this.dragState.type === 'tower') {
      this.objectService.moveTower(this.dragState.id, newPos);
      this.redrawAllPipes(this.state.pipes, this.state.users);
    }
  };

  onDragEnd = () => {
    if (this._dragActive) {
      this.g.selectAll('circle').attr('fill', 'blue');
      this.g.selectAll('rect.pipe-temp').attr('fill', (d: Point) => {
        const isFinalized = this.state.pipes.some(p => p.vertices.some(v => this.isSamePoint(v, d)));
        return isFinalized ? 'red' : 'white';
      });
      this.g.selectAll('image.user-icon').attr('opacity', 1);
      this.g.selectAll('line.pipe-temp-overlay').attr('stroke', 'transparent');

      this._dragActive = false;
      this.dragState = null;
      this.map.dragging.enable();
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
    }
  };

  findPipeIdByVertex(point: Point): number | null {
    for (const pipe of this.state.pipes) {
      const idx = pipe.vertices.findIndex(v => this.isSamePoint(v, point));
      if (idx !== -1) return pipe.id;
    }
    return null;
  }

  findPipeVertexIndex(point: Point, pipeId?: number): number | null {
    const pipes = pipeId ? this.state.pipes.filter(p => p.id === pipeId) : this.state.pipes;
    for (const pipe of pipes) {
      const idx = pipe.vertices.findIndex(v => this.isSamePoint(v, point));
      if (idx !== -1) return idx;
    }
    return null;
  }

  findPipeIdBySegment(from: Point, to: Point): number | null {
    for (const pipe of this.state.pipes) {
      for (let i = 1; i < pipe.vertices.length; i++) {
        if ((this.isSamePoint(pipe.vertices[i - 1], from) && this.isSamePoint(pipe.vertices[i], to)) ||
            (this.isSamePoint(pipe.vertices[i - 1], to) && this.isSamePoint(pipe.vertices[i], from))) {
          return pipe.id;
        }
      }
    }
    return null;
  }

  calculateSegmentCenter(from: Point, to: Point): Point {
    return [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  }

  ngAfterViewChecked() {
    if (this.showDiameterDialog && this.shouldFocusDiameterInput && this.diameterInputRef) {
      this.diameterInputRef.nativeElement.focus();
      this.shouldFocusDiameterInput = false;
    }
  }

  onObjectTypeSelected(type: 'user' | 'capture' | 'pump' | 'reservoir' | 'tower') {
    if (!this.objectTypeDialogPoint) return;
    const point = this.objectTypeDialogPoint;
    if (type === 'user') {
      this.objectService.addUser(point);
    } else if (type === 'capture') {
      this.objectService.addCapture(point);
    } else if (type === 'pump') {
      this.objectService.addPump(point);
    } else if (type === 'reservoir') {
      this.objectService.addReservoir(point);
    } else if (type === 'tower') {
      this.objectService.addTower(point);
    }
    // Добавляем соединение для текущей трубы, если нужно (только для user)
    if (type === 'user' && this.currentPipe.length > 1) {
      this.currentPipeUsers.push({ from: this.currentPipe[this.currentPipe.length - 2], to: point });
    }
    this.showObjectTypeDialog = false;
    this.objectTypeDialogPoint = null;
    this.redrawAllPipes(this.state.pipes, this.state.users);
  }

  startDragSpecialObject(event: MouseEvent, obj: any, type: 'capture' | 'pump' | 'reservoir' | 'tower') {
    event.stopPropagation();
    this.map.dragging.disable();
    this.dragState = { type, id: obj.id };
    this._dragActive = true;
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
    if (event.currentTarget) {
      d3.select(event.currentTarget as SVGImageElement).attr('opacity', 0.7);
    }
  }
}