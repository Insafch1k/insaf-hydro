import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import * as d3 from 'd3';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { ObjectService } from '../services/object.service';
import { DataSchemeService } from '../services/data-scheme.service';
import { Router } from '@angular/router';

// Подключает карту (Leaflet), поверх неё рисует объекты (скважины, трубы, потребителей и др.) через D3.
// Реализует инструменты: добавление скважин, рисование труб, подключение пользователей.
// Позволяет редактировать объекты (перемещать, менять диаметр трубы, удалять).
// Работает с данными (подгружает схему через сервисы, хранит текущее состояние объектов).
// Обновляет позиции и перерисовывает объекты при зуме/перемещении карты.
// Управляет контекстным меню (ПКМ) и диалогами (например, выбор диаметра трубы).

import {
  Point,
  MapState,
  ContextTarget,
  TempLine,
  Passport,
  DialogPosition,
  Well,
  User,
  Pipe,
  Tower,
  Pump,
  Reservoir,
  Capture,
} from './map-types';
import {
  updateSvgTransform,
  updateObjectPositions,
  createMap,
  addGoogleLayer,
  createSvgLayer,
} from './map-render';

type MapTool =
  | 'well'
  | 'pipe'
  | 'user'
  | 'capture'
  | 'pump'
  | 'reservoir'
  | 'tower';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent
  implements AfterViewInit, OnDestroy, AfterViewChecked
{
  selectedTool: MapTool | null = null;
  svg: any; // SVG слой для D3
  g: any; // группа для отрисовки объектов

  isDrawingPipe = false;
  skipNextSamePointCheck = false;
  currentPipe: Point[] = []; // текущая труба (точки)

  contextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  contextTarget: ContextTarget | null = null;
  map!: L.Map;
  private subscription: Subscription;
  private state: MapState = {
    wells: [],
    pipes: [],
    users: [],
    captures: [],
    pumps: [],
    reservoirs: [],
    towers: [],
    deletedObjects: [],
  };
  passports: Passport[] = [];

  pipeDiameter: number | null = null;
  showDiameterDialog: boolean = false;
  pipeDiameterInput: number | null = null;
  editMode: boolean = false;
  private dragState: any = null;
  private _dragActive = false;
  private tempLine: TempLine | null = null;
  @ViewChild('diameterInput') diameterInputRef?: ElementRef<HTMLInputElement>;
  private shouldFocusDiameterInput = false;
  private isMapReady = false;
  showObjectTypeDialog: boolean = false;
  objectTypeDialogPosition: DialogPosition = { x: 0, y: 0 };

  objectTypeDialogPoint: Point | null = null;
  private id_scheme: number | null = null;

  private tempLineLayer: d3.Selection<
    SVGLineElement,
    unknown,
    null,
    undefined
  > | null = null;

  showStartObjectMenu = false;
  startMenuPosition = { x: 0, y: 0 };
  pendingPipeStartPoint: Point | null = null;
  finishClickEvent: MouseEvent | null = null;

  startObjectTypes = [
    { id: 'well', label: 'Скважина' },
    { id: 'user', label: 'Потребитель' },
    { id: 'capture', label: 'Каптаж' },
    { id: 'pump', label: 'Насос' },
    { id: 'reservoir', label: 'Резервуар' },
    { id: 'tower', label: 'Башня' },
  ];

  constructor(
    private objectService: ObjectService,
    private dataSchemeService: DataSchemeService,
    private router: Router
  ) {
    this.subscription = this.objectService.getState().subscribe((state) => {
      this.state = state as any;
      if (this.isMapReady) {
        this.redrawAll();
      }
    });
  }

  ngOnInit() {
    this.id_scheme = history.state.id_scheme;
    if (this.id_scheme) {
      this.loadSchemeById(this.id_scheme);
    }

    window.addEventListener('keydown', this.handleKeyDown);
  }

  ngAfterViewInit() {
    this.map = createMap('map');
    addGoogleLayer(this.map);
    ({ svg: this.svg, g: this.g } = createSvgLayer(this.map));

    this.initMiddleMousePan();
    this.initMapClickHandlers();

    updateSvgTransform(this.map, this.svg);
    updateObjectPositions(this.map, this.g);

    this.isMapReady = true;
    this.redrawAll();
  }

  ngAfterViewChecked() {
    if (
      this.showDiameterDialog &&
      this.shouldFocusDiameterInput &&
      this.diameterInputRef
    ) {
      this.diameterInputRef.nativeElement.focus();
      this.shouldFocusDiameterInput = false;
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.map) {
      this.map.off('click');
      this.map.off('moveend zoomend');
    }
    window.removeEventListener('mousemove', this.onDragMove);
    window.removeEventListener('mouseup', this.onDragEnd);
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  zoomIn() {
    this.map.zoomIn();
  }

  zoomOut() {
    this.map.zoomOut();
  }

  //Перемешение карты мышкой
  private initMiddleMousePan() {
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
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 1 && isMiddleDragging) {
        isMiddleDragging = false;
        mapContainer.style.cursor = this.selectedTool
          ? 'crosshair'
          : this.editMode
          ? 'pointer'
          : '';
      }
    });
  }

  //Клики по карте
  private initMapClickHandlers() {
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.selectedTool || this.editMode) {
        this.contextMenuVisible = false;
        return;
      }
      const point: Point = [e.latlng.lng, e.latlng.lat];
      this.handleClickOnMap(e.originalEvent, point);
    });

    this.map.on('moveend zoomend', () => {
      updateSvgTransform(this.map, this.svg);
      updateObjectPositions(this.map, this.g);
    });
  }

  //-----------------------------------
  //-----------------------------------
  //Загрузка схемы
  //-----------------------------------
  //-----------------------------------

  // загружает данные схемы по ID через сервис и передаёт их на обработку.
  loadSchemeById(id_scheme: number) {
    this.dataSchemeService.getSchemeData(id_scheme).subscribe({
      next: (geojson) => this.processSchemeData(geojson),
      error: (err) => console.error('Ошибка загрузки схемы:', err),
    });
  }

  //разбивает полученные данные на объекты, трубы и пользователей, а затем сохраняет состояние.
  private processSchemeData(geojson: any) {
    const features = geojson.features || [];

    const wells = this.extractObjects(features, 'Скважина');
    const users = this.extractObjects(features, 'Потребитель');
    const pipeSegments = this.extractPipeSegments(features);
    const pipes = this.buildPipes(pipeSegments);

    this.pushState({ wells, users, pipes });
  }

  //выбирает из данных объекты нужного типа и формирует для них базовую структуру.
  private extractObjects(features: any[], type: string) {
    return features
      .filter((f) => f.name_object_type === type)
      .map((f) => ({
        id: f.id,
        position: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as [
          number,
          number
        ],
        visible: true,
      }));
  }

  //отбирает только сегменты труб с геометрией LineString.
  private extractPipeSegments(features: any[]) {
    return features.filter(
      (f) => f.name_object_type === 'Труба' && f.geometry.type === 'LineString'
    );
  }

  //создаёт объекты труб с уникальными ID, вершинами, диаметром и видимостью.
  private buildPipes(pipeSegments: any[]) {
    const maxPipeId = pipeSegments.reduce(
      (max, seg) => Math.max(max, seg.id || 0),
      0
    );
    this.objectService['pipeIdCounter'] = maxPipeId + 1;

    return pipeSegments.map((seg, index) => ({
      id: seg.id || this.objectService['pipeIdCounter'] + index,
      name: seg.properties?.Имя || `Труба #${maxPipeId}`,
      vertices: seg.geometry.coordinates as [number, number][],
      diameter: seg.properties?.['Диаметр'] ?? seg.properties?.diameter ?? 0,
      visible: true,
    }));
  }

  private pushState(data: any) {
    this.objectService['state'].next({
      wells: data.wells,
      pipes: data.pipes,
      users: data.users,
      captures: [],
      pumps: [],
      reservoirs: [],
      towers: [],
      deletedObjects: [],
    });
  }

  //-----------------------------------
  //-----------------------------------
  //Включает или отключает инструмент карты и режим рисования труб.
  //-----------------------------------
  //-----------------------------------

  //выбирает инструмент на карте (например, «труба» или «скважина»),
  selectTool(tool: MapTool | null) {
    if (this.selectedTool === tool) {
      this.resetTool();
      return;
    }

    this.editMode = false;
    this.map.dragging.enable();
    this.map.getContainer().style.cursor = '';
    this.redrawAll();

    this.selectedTool = tool;
    this.isDrawingPipe = tool === 'pipe';
    this.currentPipe = [];
    this.tempLine = null;

    this.map.dragging.disable();
    this.map.getContainer().style.cursor = 'crosshair';
  }

  //сбрасывает выбранный инструмент, очищает временные трубы и линии,
  private resetTool() {
    this.selectedTool = null;
    this.isDrawingPipe = false;
    this.currentPipe = [];
    this.tempLine = null;

    this.g.selectAll('circle').attr('fill', 'blue');

    this.redrawAllPipes(this.state.pipes, this.state.users);
    this.map.dragging.enable();
    this.map.getContainer().style.cursor = this.editMode ? 'pointer' : '';
  }

  // обработка клика по карте (добавляем объект или точку трубы)
  handleClickOnMap(event: MouseEvent, point: Point) {
    if (this.selectedTool === 'pipe') {
      if (!this.isDrawingPipe) return;
      this.handlePipeClick(point, event);
      return;
    }

    const addObjectMap: Record<MapTool, (p: Point) => void> = {
      pipe: () => {},
      well: this.objectService.addWell.bind(this.objectService),
      user: this.objectService.addUser.bind(this.objectService),
      capture: this.objectService.addCapture.bind(this.objectService),
      pump: this.objectService.addPump.bind(this.objectService),
      reservoir: this.objectService.addReservoir.bind(this.objectService),
      tower: this.objectService.addTower.bind(this.objectService),
    };

    addObjectMap[this.selectedTool!]?.(point);
  }

  //навешивает обработчики на объект: левый клик для перетаскивания
  // в режиме редактирования, правый клик для открытия контекстного меню.
  private attachObjectHandlers<T extends { position: [number, number] }>(
    element: d3.Selection<any, T, any, any>,
    type: 'well' | 'user' | 'capture' | 'pump' | 'reservoir' | 'tower'
  ) {
    element.on('mousedown', (event: MouseEvent, d: T) => {
      console.log('mousedown', type, d, event.button);
      if (this.editMode && event.button === 0) {
        event.preventDefault();
        event.stopPropagation();

        this.startDragSpecialObject(
          event,
          d,
          type as 'well' | 'user' | 'capture' | 'pump' | 'reservoir' | 'tower'
        );
      } else if (event.button === 2) {
        event.preventDefault();
        this.showContextMenu(event, type, d);
      }
    });
  }

  //создаёт графический элемент объекта на карте с иконкой
  private addObject<T extends { position: [number, number] }>(
    obj: T,
    type: 'well' | 'user' | 'capture' | 'pump' | 'reservoir' | 'tower',
    iconUrl: string,
    size = 36
  ) {
    const r = size / 2;
    const group = this.g.append('g').attr('class', type).datum(obj);

    this.attachObjectHandlers(group, type);

    group
      .append('image')
      .attr('class', `${type}-icon`)
      .attr('xlink:href', iconUrl)
      .attr('x', -r)
      .attr('y', -r)
      .attr('width', size)
      .attr('height', size);

    updateObjectPositions(this.map, this.g);
  }

  //добавляет на карту скважину с иконкой т тд
  addWell(well: Well) {
    this.addObject(well, 'well', 'assets/data/icon/well2.png', 24);
  }

  addUser(user: User) {
    this.addObject(user, 'user', 'assets/data/icon/user.png');
  }

  addCapture(capture: Capture) {
    this.addObject(capture, 'capture', 'assets/data/icon/Каптаж.png');
  }

  addPump(pump: Pump) {
    this.addObject(pump, 'pump', 'assets/data/icon/Насос.png');
  }

  addReservoir(reservoir: Reservoir) {
    this.addObject(
      reservoir,
      'reservoir',
      'assets/data/icon/контр-резервуар.png'
    );
  }

  addTower(tower: Tower) {
    this.addObject(tower, 'tower', 'assets/data/icon/Насос.png');
  }

  // Открывает контекстное меню создания объекта (скважина, потребитель и т.д.)
  // в точке клика и сохраняет координаты для будущего начала трубы.
  showStartObjectCreationMenu(point: Point, event: MouseEvent) {
    this.pendingPipeStartPoint = point;
    this.startMenuPosition = { x: event.clientX, y: event.clientY };
    this.showStartObjectMenu = true;
  }

  //Создаёт выбранный объект и сразу запускает рисование новой трубы из этой точки.
  selectStartObject(type: string) {
    if (!this.pendingPipeStartPoint) return;

    let obj: any;

    switch (type) {
      case 'well':
        obj = this.objectService.addWell(this.pendingPipeStartPoint);
        break;
      case 'user':
        obj = this.objectService.addUser(this.pendingPipeStartPoint);
        break;
      case 'capture':
        obj = this.objectService.addCapture(this.pendingPipeStartPoint);
        break;
      case 'pump':
        obj = this.objectService.addPump(this.pendingPipeStartPoint);
        break;
      case 'reservoir':
        obj = this.objectService.addReservoir(this.pendingPipeStartPoint);
        break;
      case 'tower':
        obj = this.objectService.addTower(this.pendingPipeStartPoint);
        break;
    }

    this.showStartObjectMenu = false;

    if (!this.isDrawingPipe && this.currentPipe.length > 1) {
      this.finalizePipe();
      this.pendingPipeStartPoint = null;
      return;
    }

    this.startPipeFromWell(this.pendingPipeStartPoint);
    this.isDrawingPipe = true;
    this.currentPipe = [this.pendingPipeStartPoint];
    this.drawPipeVertex(this.pendingPipeStartPoint, false);

    this.redrawAllPipes(this.state.pipes, this.state.users);

    this.pendingPipeStartPoint = null;
  }

  // логика рисования трубы: добавляем вершины, открываем диалог для диаметра
  handlePipeClick(point: Point, event?: MouseEvent) {
    if (!this.isDrawingPipe) return;

    const snapDistancePx = 15; // радиус привязки в пикселях на экране

    // объединяем все точки для привязки
    const snapPoints: Point[] = [
      ...this.state.wells.map((w) => w.position),
      ...this.state.users.map((u) => u.position),
      ...this.state.pipes.flatMap((p) => p.vertices),
      ...(this.state.captures || []).map((c) => c.position),
      ...(this.state.pumps || []).map((p) => p.position),
      ...(this.state.reservoirs || []).map((r) => r.position),
      ...(this.state.towers || []).map((t) => t.position),
    ];

    let closestPoint: Point | null = null;
    let minDistance = Infinity;

    for (const snapPoint of snapPoints) {
      const screenPoint = this.map.latLngToLayerPoint(
        L.latLng(point[1], point[0])
      );
      const screenSnap = this.map.latLngToLayerPoint(
        L.latLng(snapPoint[1], snapPoint[0])
      );
      const dx = screenPoint.x - screenSnap.x;
      const dy = screenPoint.y - screenSnap.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < snapDistancePx && dist < minDistance) {
        minDistance = dist;
        closestPoint = snapPoint;
      }
    }

    // если нашли близкую точку, привязываем, иначе создаем новую
    if (closestPoint) {
      point = [...closestPoint] as Point;
    }

    if (this.currentPipe.length === 0) {
      // если рядом НИЧЕГО нет — покажем меню создания объекта
      if (!closestPoint) {
        this.showStartObjectCreationMenu(point, event as MouseEvent);
        return;
      }

      // если есть привязка — старт стандартный
      this.currentPipe.push(point);
      this.drawPipeVertex(point, false);
      return;
    }

    const lastPoint = this.currentPipe[this.currentPipe.length - 1];
    if (this.skipNextSamePointCheck) {
      this.skipNextSamePointCheck = false;
    } else if (this.isSamePoint(point, lastPoint)) {
      if (this.currentPipe.length > 1) {
        this.finishClickEvent = event as MouseEvent;
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

  // завершает рисование трубы и сохраняет её
  finalizePipe() {
    if (this.currentPipe.length > 1 && this.pipeDiameter != null) {
      // ищем ближайший объект к последней точке трубы
      const lastPoint = this.currentPipe[this.currentPipe.length - 1];

      const snapPoints: Point[] = [
        ...this.state.wells.map((w) => w.position),
        ...this.state.users.map((u) => u.position),
        ...this.state.pipes.flatMap((p) => p.vertices),
        ...(this.state.captures || []).map((c) => c.position),
        ...(this.state.pumps || []).map((p) => p.position),
        ...(this.state.reservoirs || []).map((r) => r.position),
        ...(this.state.towers || []).map((t) => t.position),
      ];

      let isNearObject = false;
      for (const sp of snapPoints) {
        if (this.getDistance(lastPoint, sp) < 0.00005) {
          isNearObject = true;
          break;
        }
      }

      // если рядом ничего нет — показываем меню выбора объекта
      if (!isNearObject) {
        this.pendingPipeStartPoint = lastPoint;

        if (this.finishClickEvent) {
          this.startMenuPosition = {
            x: this.finishClickEvent.clientX,
            y: this.finishClickEvent.clientY,
          };
        }

        this.showStartObjectMenu = true;
        this.finishClickEvent = null; // очистили
        return;
      }

      this.objectService.addPipe([...this.currentPipe], this.pipeDiameter);
    }

    this.currentPipe = [];
    this.pipeDiameter = null;
    this.showDiameterDialog = false;
    this.isDrawingPipe = this.selectedTool === 'pipe';
    this.tempLine = null;
    this.redrawAllPipes(this.state.pipes, this.state.users);
  }

  //вычисляет расстояние между двумя точками.
  getDistance(p1: Point, p2: Point) {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  //Если пользователь нажал Escape — отменяет рисование трубы.
  handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.cancelPipeDrawing();
    }
  };

  //отменяет текущее рисование трубы и сбрасывает временные данные.
  cancelPipeDrawing() {
    if (!this.isDrawingPipe) return;

    this.currentPipe = [];
    this.tempLine = null;
    this.showDiameterDialog = false;

    // перерисовываем, чтобы убрать временные линии
    this.redrawAllPipes(this.state.pipes, this.state.users);

    console.log('Pipe drawing cancelled (ESC, only cleared current pipe)');
  }

  handleVertexRightClick(point: Point) {
    if (!this.isDrawingPipe) return;

    const lastIndex = this.currentPipe.length - 1;
    const lastPoint = this.currentPipe[lastIndex];

    if (this.isSamePoint(point, lastPoint) && this.currentPipe.length > 1) {
      this.showObjectTypeDialog = true;
      this.objectTypeDialogPoint = point;
      this.objectTypeDialogPosition = {
        x: window.event ? (window.event as MouseEvent).clientX : 0,
        y: window.event ? (window.event as MouseEvent).clientY : 0,
      };
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
    if (this.editMode) {
      // редактирование: квадраты
      if (this.state.wells.some((w) => this.isSamePoint(w.position, point)))
        return;
      if (
        finalized &&
        this.state.users.some((u) => this.isSamePoint(u.position, point))
      )
        return;

      const size = 12;
      const vertexIndex = this.findPipeVertexIndex(point);
      const pipeId = this.findPipeIdByVertex(point);

      this.g
        .append('rect')
        .attr('class', 'pipe-temp')
        .datum(point)
        .attr('width', size)
        .attr('height', size)
        .attr('fill', finalized ? 'red' : 'white')
        .attr('stroke', 'black')
        .attr('stroke-width', 2)
        .style('cursor', 'grab')
        .on('mousedown', (event: MouseEvent) => {
          if (event.button === 0 && pipeId !== null && vertexIndex !== null) {
            event.preventDefault();
            event.stopPropagation();
            this.startDragPipeVertex(event, pipeId, vertexIndex);
          } else if (event.button === 2) {
            event.preventDefault();
            this.handleVertexRightClick(point);
          }
        });

      return;
    }

    // просмотр: рисуем синие круги, если вершин >= 3
    const verticesAtPoint = this.state.pipes
      .flatMap((pipe) => pipe.vertices)
      .filter((v) => this.isSamePoint(v, point));

    if (verticesAtPoint.length > 2) {
      this.g
        .append('circle')
        .attr('class', 'pipe-circle')
        .datum(point)
        .attr('r', 5) // меньший радиус
        .attr('fill', 'blue') // синий цвет
        .attr('stroke', 'none'); // без обводки
    }
  }

  drawLineSegment(from: Point, to: Point, isDashed: boolean = false) {
    const line = this.g
      .append('line')
      .attr('class', isDashed ? 'pipe-temp-dash' : 'pipe-temp')
      .datum([from, to])
      .attr('stroke', 'blue')
      .attr('stroke-width', 2)
      .attr('pointer-events', 'none');

    if (isDashed) {
      line.attr('stroke-dasharray', '5,5');
    }

    this.g
      .append('line')
      .attr('class', 'pipe-temp-overlay')
      .datum([from, to])
      .attr('stroke', 'transparent')
      .attr('stroke-width', 15)
      .attr('pointer-events', 'all')
      .on('mousedown', (event: MouseEvent, d: [Point, Point]) => {
        const mouse = this.map.mouseEventToLatLng(event);
        const mousePoint: Point = [mouse.lng, mouse.lat];
        const distToFrom = this.isSamePoint(mousePoint, d[0]);
        const distToTo = this.isSamePoint(mousePoint, d[1]);
        if (distToFrom || distToTo) {
          return;
        }
        if (this.editMode && event.button === 0) {
          event.preventDefault();
          event.stopPropagation();
          const pipeId = this.findPipeIdBySegment(d[0], d[1]);
          const fromIndex =
            pipeId !== null ? this.findPipeVertexIndex(d[0], pipeId) : null;
          const toIndex =
            pipeId !== null ? this.findPipeVertexIndex(d[1], pipeId) : null;
          if (pipeId !== null && fromIndex !== null && toIndex !== null) {
            this.startDragPipeSegment(event, pipeId, fromIndex, toIndex);
          }
        } else if (event.button === 2) {
          event.preventDefault();
          const pipeId = this.findPipeIdBySegment(d[0], d[1]);
          const fromIndex =
            pipeId !== null ? this.findPipeVertexIndex(d[0], pipeId) : null;
          const toIndex =
            pipeId !== null ? this.findPipeVertexIndex(d[1], pipeId) : null;
          if (pipeId !== null && fromIndex !== null && toIndex !== null) {
            this.showContextMenu(event, 'pipe-segment', {
              pipeId,
              from: d[0],
              to: d[1],
              fromIndex,
              toIndex,
              id: `${pipeId}_${fromIndex}_${toIndex}`,
            });
          }
        }
      })
      .on('mouseover', (event: MouseEvent) => {
        if (this.editMode && event.currentTarget) {
          d3.select(event.currentTarget as SVGLineElement).attr(
            'stroke',
            'lightgray'
          );
        }
      })
      .on('mouseout', (event: MouseEvent) => {
        if (this.editMode && event.currentTarget) {
          d3.select(event.currentTarget as SVGLineElement).attr(
            'stroke',
            'transparent'
          );
        }
      });
    updateObjectPositions(this.map, this.g);
  }

  private clearTempAndIconsLayer() {
    this.g
      .selectAll(
        '.pipe-temp, .pipe-temp-overlay, .pipe-temp-dash, .user-icon, .capture-icon, .pump-icon, .reservoir-icon, .tower-icon'
      )
      .remove();
  }

  private renderPipes(pipes: Pipe[]) {
    pipes.forEach((pipe) => {
      if (!pipe.visible) return;

      // основные сегменты трубы
      pipe.vertices.forEach((pt, i) => {
        if (i > 0) {
          this.drawLineSegment(pipe.vertices[i - 1], pt, false);
        }
      });
    });
  }

  private renderPipeVertices(pipes: Pipe[]) {
    pipes.forEach((pipe) => {
      if (!pipe.visible) return;

      pipe.vertices.forEach((pt) => {
        this.drawPipeVertex(pt, true);
      });
    });
  }

  private renderCurrentPipe() {
    // обычные сегменты между точками
    for (let i = 1; i < this.currentPipe.length; i++) {
      this.drawLineSegment(this.currentPipe[i - 1], this.currentPipe[i], true);
    }

    // вершины
    for (const pt of this.currentPipe) {
      this.drawPipeVertex(pt, false);
    }
  }

  // перерисовываем все трубы, вершины и пользователей
  // сначала чистим старые, потом рисуем новые
  redrawAllPipes(pipes: Pipe[], users: User[]) {
    this.clearTempAndIconsLayer();

    this.renderPipes(pipes);
    this.renderPipeVertices(pipes);

    this.renderCurrentPipe();

    // рендер всех специальных объектов
    (this.state.captures || []).forEach((obj) =>
      this.renderSpecialObject(
        obj,
        'capture-icon',
        'assets/data/images/Каптаж.png',
        'capture'
      )
    );
    (this.state.pumps || []).forEach((obj) =>
      this.renderSpecialObject(
        obj,
        'pump-icon',
        'assets/data/images/Насос.png',
        'pump'
      )
    );
    (this.state.reservoirs || []).forEach((obj) =>
      this.renderSpecialObject(
        obj,
        'reservoir-icon',
        'assets/data/images/контр-резервуар.png',
        'reservoir'
      )
    );
    (this.state.towers || []).forEach((obj) =>
      this.renderSpecialObject(
        obj,
        'tower-icon',
        'assets/data/images/Водонапорная башня.png',
        'tower'
      )
    );

    (users || []).forEach((user) =>
      this.renderSpecialObject(
        user,
        'user-icon',
        'assets/data/icon/user.png',
        'user'
      )
    );

    updateObjectPositions(this.map, this.g);
  }

  private renderSpecialObject(
    obj: any,
    iconClass: string,
    iconUrl: string,
    type: 'capture' | 'pump' | 'reservoir' | 'tower' | 'user'
  ) {
    if (!obj.visible) return;

    const pixel = this.map.latLngToLayerPoint(
      L.latLng(obj.position[1], obj.position[0])
    );

    this.g
      .append('image')
      .attr('class', iconClass)
      .datum(obj)
      .attr('xlink:href', iconUrl)
      .attr('x', pixel.x - 12)
      .attr('y', pixel.y - 12)
      .attr('width', 24)
      .attr('height', 24)
      .style('cursor', this.editMode ? 'grab' : 'pointer')
      .on('mousedown', (event: MouseEvent, d: any) => {
        if (event.button === 0 && this.editMode) {
          event.preventDefault();
          event.stopPropagation();
          this.startDragSpecialObject(event, d, type);
        } else if (event.button === 2) {
          event.preventDefault();
          this.showContextMenu(event, type, d);
        }
      });
  }

  // показываем контекстное меню (ПКМ) для объекта
  showContextMenu(
    event: MouseEvent,
    type:
      | 'well'
      | 'user'
      | 'pipe'
      | 'pipe-segment'
      | 'capture'
      | 'pump'
      | 'reservoir'
      | 'tower',
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

  // открываем паспорт (карточку) выбранного объекта
  openPassport(
    type:
      | 'well'
      | 'pipe'
      | 'user'
      | 'pipe-segment'
      | 'capture'
      | 'pump'
      | 'reservoir'
      | 'tower'
      | null,
    data: any
  ) {
    if (!type || !data) return;

    let passportId: number | string = data.id;
    if (
      type === 'pipe-segment' &&
      data.pipeId !== undefined &&
      data.fromIndex !== undefined &&
      data.toIndex !== undefined
    ) {
      passportId = `${data.pipeId}_${data.fromIndex}_${data.toIndex}`;
    }

    // Преобразуем passportId в число, если это возможно
    const numericId =
      typeof passportId === 'string' ? parseInt(passportId, 10) : passportId;

    this.passports = this.passports.filter(
      (p) => !(p.type === type && p.id === passportId)
    );
    this.passports.push({ id: numericId, type, data });
    this.contextMenuVisible = false;
    this.contextTarget = null;
  }

  // безопасно переводим значение в число
  convertToNumber(value: any): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    return typeof value === 'string' ? parseInt(value, 10) : value;
  }

  // закрываем паспорт по id
  onPassportClosed(id: number | string) {
    this.passports = this.passports.filter((p) => p.id !== id);
  }

  // удаляем объект (скважина, труба, насос и т.д.)
  onDelete() {
    if (!this.contextTarget) return;
    const { type, data } = this.contextTarget;

    switch (type) {
      case 'well':
        this.objectService.deleteWell(data.id);
        this.passports = this.passports.filter(
          (p) => !(p.type === 'well' && p.data.id === data.id)
        );
        break;

      case 'user':
        this.objectService.deleteUser(data.id);
        this.passports = this.passports.filter(
          (p) => !(p.type === 'user' && p.data.id === data.id)
        );
        break;

      case 'pipe':
      case 'pipe-segment': // теперь сегмент — это отдельная труба, обрабатываем одинаково
        this.objectService.deletePipeSegment(data.pipeId || data.id);
        this.passports = this.passports.filter(
          (p) => !(p.type === 'pipe' && p.data.id === (data.pipeId || data.id))
        );
        break;

      case 'capture':
        this.objectService.deleteCapture(data.id);
        this.passports = this.passports.filter(
          (p) => !(p.type === 'capture' && p.data.id === data.id)
        );
        break;

      case 'pump':
        this.objectService.deletePump(data.id);
        this.passports = this.passports.filter(
          (p) => !(p.type === 'pump' && p.data.id === data.id)
        );
        break;

      case 'reservoir':
        this.objectService.deleteReservoir(data.id);
        this.passports = this.passports.filter(
          (p) => !(p.type === 'reservoir' && p.data.id === data.id)
        );
        break;

      case 'tower':
        this.objectService.deleteTower(data.id);
        this.passports = this.passports.filter(
          (p) => !(p.type === 'tower' && p.data.id === data.id)
        );
        break;
    }

    this.redrawAll();
    this.contextMenuVisible = false;
    this.contextTarget = null;
  }

  // перерисовываем все объекты на карте заново
  redrawAll() {
    this.g.selectAll('*').remove();
    this.state.wells.forEach((w) => w.visible && this.addWell(w));
    this.state.users.forEach((u) => u.visible && this.addUser(u));
    this.state.captures.forEach((c) => c.visible && this.addCapture(c));
    this.state.pumps.forEach((p) => p.visible && this.addPump(p));
    this.state.reservoirs.forEach((r) => r.visible && this.addReservoir(r));
    this.state.towers.forEach((t) => t.visible && this.addTower(t));
    this.redrawAllPipes(this.state.pipes, this.state.users);
  }

  // начинаем рисовать трубу из выбранной скважины
  startPipeFromWell(point: Point) {
    if (this.selectedTool === 'pipe' && !this.isDrawingPipe) {
      this.isDrawingPipe = true;
      this.currentPipe = [point];
      this.drawPipeVertex(point, false);
      this.skipNextSamePointCheck = true;
    }
  }

  // выбираем диаметр трубы и завершаем рисование
  onDiameterSelected(diameter: number) {
    this.pipeDiameter = diameter;
    this.showDiameterDialog = false;
    this.finalizePipe();
    this.pipeDiameterInput = null;
  }

  // переключаем режим редактирования (вкл/выкл)
  toggleEditMode() {
    this.editMode = !this.editMode;
    if (this.editMode) {
      this.selectedTool = null;
      this.isDrawingPipe = false;
      this.currentPipe = [];
      this.tempLine = null;
      this.map.dragging.disable();
      this.map.getContainer().style.cursor = 'pointer';
    } else {
      this.map.dragging.enable();
      this.map.getContainer().style.cursor = '';
    }
    this.redrawAll();
  }

  // начинаем перетаскивание скважины
  startDragWell(event: MouseEvent, well: Well) {
    event.stopPropagation();
    this.map.dragging.disable();
    this.dragState = { type: 'well', id: well.id };
    this._dragActive = true;
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
    if (event.currentTarget) {
      d3.select(event.currentTarget as SVGGElement)
        .select('circle')
        .attr('fill', 'lightblue');
    }
  }

  // начинаем перетаскивание потребителя
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

  // начинаем перетаскивание вершины трубы
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

  // начинаем перетаскивание сегмента трубы (кусок между вершинами)
  startDragPipeSegment(
    event: MouseEvent,
    pipeId: number,
    fromIndex: number,
    toIndex: number
  ) {
    event.stopPropagation();
    this.map.dragging.disable();
    const pipe = this.state.pipes.find((p) => p.id === pipeId);
    if (pipe) {
      this.dragState = {
        type: 'segment',
        pipeId,
        fromIndex,
        toIndex,
        initialCenter: this.calculateSegmentCenter(
          pipe.vertices[fromIndex],
          pipe.vertices[toIndex]
        ),
      };
      this._dragActive = true;
      window.addEventListener('mousemove', this.onDragMove);
      window.addEventListener('mouseup', this.onDragEnd);
      if (event.currentTarget) {
        d3.select(event.currentTarget as SVGLineElement).attr(
          'stroke',
          'lightgray'
        );
      }
    }
  }

  // процесс перетаскивания (для всех типов объектов)
  onDragMove = (event: MouseEvent) => {
    if (!this.dragState || !this._dragActive) return;

    const latlng = this.map.mouseEventToLatLng(event);
    const newPos: Point = [latlng.lng, latlng.lat];

    const bounds = this.map.getBounds();
    if (
      latlng.lat < bounds.getSouth() ||
      latlng.lat > bounds.getNorth() ||
      latlng.lng < bounds.getWest() ||
      latlng.lng > bounds.getEast()
    ) {
      return;
    }

    switch (this.dragState.type) {
      case 'well':
        this.objectService.moveWell(this.dragState.id, newPos);
        break;
      case 'user':
        this.objectService.moveUser(this.dragState.id, newPos);
        break;
      case 'capture':
        this.objectService.moveCapture(this.dragState.id, newPos);
        break;
      case 'pump':
        this.objectService.movePump(this.dragState.id, newPos);
        break;
      case 'reservoir':
        this.objectService.moveReservoir(this.dragState.id, newPos);
        break;
      case 'tower':
        this.objectService.moveTower(this.dragState.id, newPos);
        break;
      case 'vertex':
        const draggedPipe = this.state.pipes.find(
          (p) => p.id === this.dragState.pipeId
        );
        if (!draggedPipe) return;

        const vertexIndex = this.dragState.vertexIndex;
        const draggedVertex = draggedPipe.vertices[vertexIndex];
        if (!draggedVertex) return;

        // новое положение вершины — вызываем функцию, которая двигает все совпадающие вершины
        this.objectService.movePipeVertex(draggedVertex, newPos);
        break;
      case 'segment':
        const pipe = this.state.pipes.find(
          (p) => p.id === this.dragState.pipeId
        );
        if (!pipe) return;

        const { fromIndex, toIndex } = this.dragState;

        // Считаем delta относительно последнего события
        const delta: Point = [
          newPos[0] - this.dragState.initialCenter[0],
          newPos[1] - this.dragState.initialCenter[1],
        ];

        // Собираем все вершины, которые нужно двигать
        const verticesToMove: Set<Point> = new Set();
        verticesToMove.add(pipe.vertices[fromIndex]);
        verticesToMove.add(pipe.vertices[toIndex]);

        this.state.pipes.forEach((p) => {
          p.vertices.forEach((v) => {
            if (
              this.isSamePoint(v, pipe.vertices[fromIndex]) ||
              this.isSamePoint(v, pipe.vertices[toIndex])
            ) {
              verticesToMove.add(v);
            }
          });
        });

        // Применяем delta ко всем вершинам одновременно
        verticesToMove.forEach((v) => {
          v[0] += delta[0];
          v[1] += delta[1];
        });

        // обновляем центр для следующего события движения
        this.dragState.initialCenter = newPos;
        break;
    }
    updateObjectPositions(this.map, this.g);
    this.redrawAllPipes(this.state.pipes, this.state.users);
  };

  // завершаем перетаскивание
  onDragEnd = () => {
    if (this._dragActive) {
      this.g.selectAll('circle').attr('fill', 'blue');
      this.g.selectAll('rect.pipe-temp').attr('fill', (d: Point) => {
        const isFinalized = this.state.pipes.some((p) =>
          p.vertices.some((v) => this.isSamePoint(v, d))
        );
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

  // ищем трубу по вершине
  findPipeIdByVertex(point: Point): number | null {
    for (const pipe of this.state.pipes) {
      const idx = pipe.vertices.findIndex((v) => this.isSamePoint(v, point));
      if (idx !== -1) return pipe.id;
    }
    return null;
  }

  // ищем индекс вершины в трубе
  findPipeVertexIndex(point: Point, pipeId?: number): number | null {
    const pipes = pipeId
      ? this.state.pipes.filter((p) => p.id === pipeId)
      : this.state.pipes;
    for (const pipe of pipes) {
      const idx = pipe.vertices.findIndex((v) => this.isSamePoint(v, point));
      if (idx !== -1) return idx;
    }
    return null;
  }

  // ищем трубу по сегменту (двум точкам)
  findPipeIdBySegment(from: Point, to: Point): number | null {
    for (const pipe of this.state.pipes) {
      for (let i = 1; i < pipe.vertices.length; i++) {
        if (
          (this.isSamePoint(pipe.vertices[i - 1], from) &&
            this.isSamePoint(pipe.vertices[i], to)) ||
          (this.isSamePoint(pipe.vertices[i - 1], to) &&
            this.isSamePoint(pipe.vertices[i], from))
        ) {
          return pipe.id;
        }
      }
    }
    return null;
  }

  // считаем центр сегмента трубы
  calculateSegmentCenter(from: Point, to: Point): Point {
    return [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  }

  // добавляем новый объект (потребитель, насос, резервуар и т.п.)
  onObjectTypeSelected(
    type: 'user' | 'capture' | 'pump' | 'reservoir' | 'tower'
  ) {
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
    if (type === 'user') {
      this.objectService.addUser(point);
    }
    this.showObjectTypeDialog = false;
    this.objectTypeDialogPoint = null;
    this.redrawAllPipes(this.state.pipes, this.state.users);
  }

  // начинаем перетаскивание спец-объекта (насос, резервуар, башня и т.п.)
  startDragSpecialObject(
    event: MouseEvent,
    obj: any,
    type: 'capture' | 'pump' | 'reservoir' | 'tower' | 'user' | 'well'
  ) {
    event.stopPropagation();
    this.map.dragging.disable();
    this.dragState = { type, id: obj.id };
    this._dragActive = true;
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
    if (event.currentTarget) {
      const el = d3.select(event.currentTarget as SVGGElement).select('image'); // выбираем изображение внутри <g>
      el.attr('opacity', 0.7); // или другой стиль для визуальной индикации drag
    }
  }

  // сохраняем все изменения (новые объекты, удалённые, обновлённые) на сервер
  saveAll() {
    if (!this.id_scheme) {
      console.error('id_scheme не определён');
      return;
    }

    // 1) Отправляем удалённые объекты (как есть)
    const deletedObjects = this.objectService
      .getDeletedObjects()
      .map((obj) => ({
        type: obj.type,
        id: typeof obj.id === 'string' ? parseInt(obj.id, 10) : obj.id,
      }));

    if (deletedObjects.length > 0) {
      this.dataSchemeService
        .deleteObjects(deletedObjects, this.id_scheme)
        .subscribe({
          next: (response) => {
            console.log(
              'Удалённые объекты успешно отправлены на сервер:',
              response
            );
            this.objectService.clearDeletedObjects();
          },
          error: (err) => {
            console.error('Ошибка при отправке удалённых объектов:', err);
          },
        });
    } else {
      console.log('Нет объектов для удаления');
    }

    //обновление
    const updatedObjects = this.objectService.getUpdatedObjects();

    if (updatedObjects.length > 0) {
      const features: any[] = [];

      updatedObjects.forEach((obj) => {
        const { type, data } = obj;

        if (type === 'Труба') {
          const name = data._name || `Труба #${data.id}`;
          const diameter = data.diameter || 0;

          const uniqueSegments = new Set<string>();
          const segmentsToSend = data.updatedSegments || [];

          segmentsToSend.forEach(([from, to]: [Point, Point]) => {
            const key = `${from[0]},${from[1]}-${to[0]},${to[1]}`;
            if (uniqueSegments.has(key)) return;
            uniqueSegments.add(key);

            features.push({
              type: 'Feature',
              id: data.id,
              name_object_type: 'Труба',
              geometry: { type: 'LineString', coordinates: [from, to] },
              properties: { Имя: name, Диаметр: diameter, Адрес: '-' },
            });
          });
        } else if (type === 'Скважина') {
          if (!data.position) return;
          features.push({
            type: 'Feature',
            id: data.id,
            name_object_type: 'Скважина',
            geometry: { type: 'Point', coordinates: data.position },
            properties: {
              Имя: `Скважина #${data.id}`,
              Адрес: '-',
              Глубина: 0,
              Диаметр: 0,
            },
          });
        } else {
          if (!data.position) return;

          features.push({
            type: 'Feature',
            id: data.id,
            name_object_type: type,
            geometry: { type: 'Point', coordinates: data.position },
            properties: {
              Имя: `${type} #${data.id}`,
              Адрес: 'улица Куйбышева, 47',
              'Геодезическая отметка': 10.0,
              'Диаметр выходного отверстия': 0.66,
              Категория: '???',
              'Минимальный напор воды': 15.0,
              Напор: 3.0,
              'Относительный расход воды': 8.0,
              'Полный напор': 5.0,
              'Расчетный расход воды в будний день': 70.0,
              'Расчетный расход воды в воскресенье': 100.0,
              'Расчетный расход воды в праздники': 115.0,
              'Расчетный расход воды в субботу': 110.0,
              'Расчётный расход воды': 7.0,
              'Способ задания потребителя': '???',
              'Текущий расход воды': 95.0,
              'Уровень воды': 18.0,
            },
          });
        }
      });

      const payload = { data: { type: 'FeatureCollection', features } };

      this.dataSchemeService.updateObjects(payload).subscribe({
        next: () => this.objectService.clearUpdatedObjects(),
        error: (err) => console.error('Ошибка при обновлении объектов', err),
      });
    }

    const createdObjects = this.objectService.getCreatedObjects();
    if (createdObjects.length === 0) return;
    const features: any[] = [];
    createdObjects.forEach((obj) => {
      const { type, data } = obj;

      if (type === 'Труба') {
        const name = data._name || `Труба #${data.id}`;
        const diameter = data.diameter;

        for (let i = 1; i < data.vertices.length; i++) {
          const segment = [data.vertices[i - 1], data.vertices[i]];
          features.push({
            type: 'Feature',
            name_object_type: 'Труба',
            geometry: { type: 'LineString', coordinates: segment },
            properties: { Имя: name, Диаметр: diameter, Адрес: 'Пушкина' },
          });
        }
      } else if (type === 'Потребитель') {
        if (!data.position) return; // пропускаем пустые объекты
        features.push({
          type: 'Feature',
          name_object_type: 'Потребитель',
          geometry: { type: 'Point', coordinates: data.position },
          properties: {
            Имя: `${type} #${data.id}`,
            Адрес: 'улица Куйбышева, 47',
            'Геодезическая отметка': 10.0,
            'Диаметр выходного отверстия': 0.66,
            Категория: '???',
            'Минимальный напор воды': 15.0,
            Напор: 3.0,
            'Относительный расход воды': 8.0,
            'Полный напор': 5.0,
            'Расчетный расход воды в будний день': 70.0,
            'Расчетный расход воды в воскресенье': 100.0,
            'Расчетный расход воды в праздники': 115.0,
            'Расчетный расход воды в субботу': 110.0,
            'Расчётный расход воды': 7.0,
            'Способ задания потребителя': '???',
            'Текущий расход воды': 95.0,
            'Уровень воды': 18.0,
          },
        });
      } else if (type === 'Скважина') {
        if (!data.position) return;
        features.push({
          type: 'Feature',
          name_object_type: 'Скважина',
          geometry: { type: 'Point', coordinates: data.position },
          properties: {
            Имя: `Скважина #${data.id}`,
            Адрес: '-',
            Глубина: 0,
            Диаметр: 0,
          },
        });
      } else {
        // остальные объекты, например Каптаж, Насос и т.д.
        if (!data.position) return;
        features.push({
          type: 'Feature',
          name_object_type: type,
          geometry: { type: 'Point', coordinates: data.position },
          properties: { Имя: `${type} #${data.id}`, Адрес: '-' },
        });
      }
    });

    const payload = {
      data: {
        type: 'FeatureCollection',
        id_scheme: this.id_scheme,
        features,
      },
    };

    this.dataSchemeService.createObjects(payload).subscribe({
      next: () => this.objectService.clearCreatedObjects(),
      error: (err) => console.error('Ошибка при создании объектов', err),
    });
  }
}
