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
    { id: 'reservoir', label: 'Контр-резервуар' },
    { id: 'tower', label: 'Водонапорная башня' },
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
    const captures = this.extractObjects(features, 'Каптаж');
    const pumps = this.extractObjects(features, 'Насос');
    const reservoirs = this.extractObjects(features, 'Контр-резервуар');
    const towers = this.extractObjects(features, 'Водонапорная башня');

    const pipeSegments = this.extractPipeSegments(features);
    const pipes = this.buildPipes(pipeSegments);

    this.pushState({
      wells,
      users,
      captures,
      pumps,
      reservoirs,
      towers,
      pipes,
    });
  }

  //выбирает из данных объекты нужного типа и формирует для них базовую структуру.
  private extractObjects(features: any[], type: string) {
    const objects = features
      .filter((f) => f.name_object_type === type)
      .map((f) => {
        return {
          id: f.id,
          position: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as [
            number,
            number
          ],
          visible: true,
          properties: { ...f.properties },
        };
      });
    return objects;
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
      properties: { ...seg.properties },
    }));
  }

  private pushState(data: any) {
    const newState = {
      wells: data.wells.map((w: any) => ({
        ...w,
        properties: w.properties,
      })),
      pipes: data.pipes.map((p: any) => ({
        ...p,
        properties: p.properties || {
          Имя: `Труба #${p.id}`,
          Диаметр: 0,
          Адрес: '-',
        },
      })),
      users: data.users.map((u: any) => ({
        ...u,
        properties: u.properties,
      })),
      captures: data.captures,
      pumps: data.pumps,
      reservoirs: data.reservoirs.map((r: any) => ({
        ...r,
        properties: r.properties,
      })),
      towers: data.towers.map((t: any) => ({
        ...t,
        properties: t.properties,
      })),
      deletedObjects: [],
    };
    this.objectService['state'].next(newState);
    console.log('[pushState] data to push:', data);
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
    console.log(this.state);

    addObjectMap[this.selectedTool!]?.(point);
  }

  //навешивает обработчики на объект: левый клик для перетаскивания
  // в режиме редактирования, правый клик для открытия контекстного меню.
  private attachObjectHandlers<T extends { position: [number, number] }>(
    element: d3.Selection<any, T, any, any>,
    type: 'well' | 'user' | 'capture' | 'pump' | 'reservoir' | 'tower'
  ) {
    element.on('mousedown', (event: MouseEvent, d: T) => {
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

  addTower(tower: Tower, isNew = false) {
    this.addObject(tower, 'tower', 'assets/data/icon/Насос.png');
  }

  //-----------------------------------
  //-----------------------------------
  //Создание трубы
  //-----------------------------------
  //-----------------------------------

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

    this.startPipeFromPoint(this.pendingPipeStartPoint);
    this.isDrawingPipe = true;
    this.currentPipe = [this.pendingPipeStartPoint];
    this.drawPipeVertex(this.pendingPipeStartPoint, false);

    this.redrawAllPipes(this.state.pipes, this.state.users);

    this.pendingPipeStartPoint = null;
  }

  // включаем временную линию, вызываем при старте рисования трубы
  private enableTempPipeLine() {
    if (!this.map) return;

    this.map.on('mousemove', this.onMouseMoveTempPipe);
  }

  // отключаем временную линию, вызываем после завершения трубы
  private disableTempPipeLine() {
    if (!this.map) return;

    this.map.off('mousemove', this.onMouseMoveTempPipe);
  }

  // функция для движения мыши
  private onMouseMoveTempPipe = (e: L.LeafletMouseEvent) => {
    if (!this.isDrawingPipe || this.currentPipe.length === 0) {
      this.tempLine = null;
      this.g.selectAll('.pipe-temp-line').remove();
      return;
    }

    let point: Point = [e.latlng.lng, e.latlng.lat];
    const snapped = this.getSnappedPoint(point, 15);
    if (snapped) point = snapped;

    const last = this.currentPipe.at(-1)!;
    this.tempLine = { from: last, to: point };

    this.drawTempLine();
  };

  private drawTempLine() {
    if (!this.tempLine || !this.g) return;

    // сначала убираем старую временную линию
    this.g.selectAll('.pipe-temp-line').remove();

    const fromScreen = this.toScreen(this.tempLine.from);
    const toScreen = this.toScreen(this.tempLine.to);

    this.g
      .append('line')
      .attr('class', 'pipe-temp-line')
      .attr('x1', fromScreen.x)
      .attr('y1', fromScreen.y)
      .attr('x2', toScreen.x)
      .attr('y2', toScreen.y)
      .attr('stroke', 'blue')
      .attr('stroke-width', 2)
      .attr('pointer-events', 'none')
      .attr('stroke-dasharray', '5,5');
  }

  // начинаем рисовать трубу из выбранного объекта или вершины
  startPipeFromPoint(point: Point) {
    if (this.selectedTool !== 'pipe') return;

    this.isDrawingPipe = true;
    this.currentPipe = [point];
    this.drawPipeVertex(point, false);
    this.skipNextSamePointCheck = true;

    this.enableTempPipeLine();
  }

  //обрабатывает клик при рисовании трубы
  // Обрабатывает клик при рисовании трубы
  handlePipeClick(point: Point, event?: MouseEvent) {
    const snapped = this.getSnappedPoint(point, 15);
    const target = snapped || point;

    // Если труба ещё не начата — начинаем её
    if (!this.isDrawingPipe || this.currentPipe.length === 0) {
      // Если нет рядом существующего объекта, показываем меню создания
      if (!snapped) {
        this.showStartObjectCreationMenu(point, event as MouseEvent);
        return;
      }

      // Иначе начинаем трубу с существующей точки
      this.isDrawingPipe = true;
      this.currentPipe = [target];
      this.skipNextSamePointCheck = true;

      this.drawPipeVertex(target, false);
      this.enableTempPipeLine();
      this.redrawAllPipes(this.state.pipes, this.state.users);
      return;
    }

    // Проверка на повтор последней точки
    const last = this.currentPipe.at(-1)!;
    if (!this.skipNextSamePointCheck && this.isSamePoint(target, last)) {
      if (this.currentPipe.length > 1) {
        this.finishClickEvent = event as MouseEvent;
        this.openDiameterDialog();
      }
      return;
    }

    this.skipNextSamePointCheck = false;
    this.addVertex(target);
  }

  //ищет ближайшую существующую точку для привязки клика
  private getSnappedPoint(point: Point, radiusPx: number): Point | null {
    const snapPoints = [
      ...this.state.wells.map((w) => w.position),
      ...this.state.users.map((u) => u.position),
      ...this.state.pipes.flatMap((p) => p.vertices),
      ...(this.state.captures || []).map((c) => c.position),
      ...(this.state.pumps || []).map((p) => p.position),
      ...(this.state.reservoirs || []).map((r) => r.position),
      ...(this.state.towers || []).map((t) => t.position),
    ];

    const screenPoint = this.toScreen(point);

    for (const sp of snapPoints) {
      if (this.screenDistance(screenPoint, this.toScreen(sp)) <= radiusPx) {
        return sp;
      }
    }

    return null;
  }

  //преобразует координаты карты в координаты экрана.
  private toScreen(p: Point) {
    return this.map.latLngToLayerPoint(L.latLng(p[1], p[0]));
  }

  //считает расстояние между двумя точками на экране.
  private screenDistance(a: any, b: any) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  //добавляет точку в текущую трубу и перерисовывает карту.
  private addVertex(point: Point) {
    this.currentPipe.push(point);
    this.drawPipeVertex(point, false);
    this.redrawAllPipes(this.state.pipes, this.state.users);
  }

  //открывает диалог ввода диаметра трубы и останавливает текущую отрисовку.
  private openDiameterDialog() {
    this.showDiameterDialog = true;
    this.pipeDiameterInput = null;
    this.isDrawingPipe = false;
    this.tempLine = null;
    this.shouldFocusDiameterInput = true;
  }

  finalizePipe() {
    if (this.currentPipe.length <= 1 || this.pipeDiameter == null) {
      this.resetPipeDrawing();
      return;
    }

    const lastPoint = this.currentPipe.at(-1)!;

    // проверяем, есть ли рядом объект в радиусе 15px
    if (!this.isNearAnyObjectPx(lastPoint, 15)) {
      this.pendingPipeStartPoint = lastPoint;

      if (this.finishClickEvent) {
        this.startMenuPosition = {
          x: this.finishClickEvent.clientX,
          y: this.finishClickEvent.clientY,
        };
      }

      this.showStartObjectMenu = true;
      this.finishClickEvent = null;
      return;
    }

    // сохраняем трубу
    this.objectService.addPipe([...this.currentPipe], this.pipeDiameter);

    this.resetPipeDrawing();
  }

  // сбрасывает текущее рисование трубы и перерисовывает карту
  private resetPipeDrawing() {
    this.currentPipe = [];
    this.pipeDiameter = null;
    this.showDiameterDialog = false;
    this.isDrawingPipe = this.selectedTool === 'pipe';
    this.tempLine = null;
    this.redrawAllPipes(this.state.pipes, this.state.users);

    this.disableTempPipeLine();
  }

  // проверяет, есть ли рядом какой-либо объект на экране в пикселях
  private isNearAnyObjectPx(point: Point, radiusPx: number): boolean {
    const allPoints: Point[] = [
      ...this.state.wells.map((w) => w.position),
      ...this.state.users.map((u) => u.position),
      ...this.state.pipes.flatMap((p) => p.vertices),
      ...(this.state.captures || []).map((c) => c.position),
      ...(this.state.pumps || []).map((p) => p.position),
      ...(this.state.reservoirs || []).map((r) => r.position),
      ...(this.state.towers || []).map((t) => t.position),
    ];

    const screenLast = this.toScreen(point);

    return allPoints.some((p) => {
      const screenP = this.toScreen(p);
      return this.screenDistance(screenLast, screenP) < radiusPx;
    });
  }

  //Если пользователь нажал Escape — отменяет рисование трубы.
  handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.cancelPipeDrawing();
    }
  };

  //отменяет текущее рисование трубы и сбрасывает временные данные.
  cancelPipeDrawing() {
    this.disableTempPipeLine();

    this.isDrawingPipe = false;
    this.currentPipe = [];
    this.tempLine = null;
    this.pipeDiameter = null;
    this.showDiameterDialog = false;
    this.showStartObjectMenu = false;

    if (this.g) {
      this.g.selectAll('.pipe-temp-line, .pipe-temp-dash').remove();
    }

    this.resetPipeDrawing();

    this.redrawAllPipes(this.state.pipes, this.state.users);
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
    const screenFrom = this.toScreen(from);
    const screenTo = this.toScreen(to);

    const line = this.g
      .append('line')
      .attr('class', isDashed ? 'pipe-temp-dash' : 'pipe-temp')
      .datum([from, to])
      .attr('x1', screenFrom.x)
      .attr('y1', screenFrom.y)
      .attr('x2', screenTo.x)
      .attr('y2', screenTo.y)
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

    if (this.tempLine) {
      this.drawLineSegment(this.tempLine.from, this.tempLine.to, true);
    }

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
      | 'user'
      | 'pipe-segment'
      | 'capture'
      | 'pump'
      | 'reservoir'
      | 'tower'
      | null,
    data: any
  ) {
    console.log(this.objectService['state'].getValue());
    if (!type || !data) return;

    // Берём актуальный объект из state
    const state = this.objectService['state'].getValue();
    let objData: any = null;

    switch (type) {
      case 'well':
        objData = state.wells.find((w: any) => w.id === data.id);
        break;
      case 'user':
        objData = state.users.find((u: any) => u.id === data.id);
        break;
      case 'capture':
        objData = state.captures.find((c: any) => c.id === data.id);
        break;
      case 'pump':
        objData = state.pumps.find((p: any) => p.id === data.id);
        break;
      case 'reservoir':
        objData = state.reservoirs.find((r: any) => r.id === data.id);
        break;
      case 'tower':
        objData = state.towers.find((t: any) => t.id === data.id);
        break;
      case 'pipe-segment':
        objData = state.pipes.find((p: any) => p.id === data.pipeId);
        break;
    }

    if (!objData) {
      console.warn('Object not found in state:', type, data.id);
      return;
    }

    const passportId = `${type}_${data.id}`;
    this.passports = this.passports.filter(
      (p) => !(p.type === type && p.id === passportId)
    );

    console.log('openPassport called with (from state):', type, objData);

    this.passports.push({
      id: passportId,
      type,
      data: objData, // <-- актуальные свойства с бэка
    });

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
      case 'pipe-segment': // теперь сегмент — это отдельная труба, обрабатываем одинаково
        this.objectService.deletePipeSegment(data.pipeId || data.id);
        this.passports = this.passports.filter(
          (p) => !(p.data.id === (data.pipeId || data.id))
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

    // при redraw передаём isNew = false
    this.state.wells.forEach((w) => w.visible && this.addWell(w));
    this.state.users.forEach((u) => u.visible && this.addUser(u));
    this.state.captures.forEach((c) => c.visible && this.addCapture(c));
    this.state.pumps.forEach((p) => p.visible && this.addPump(p));
    this.state.reservoirs.forEach((r) => r.visible && this.addReservoir(r));
    this.state.towers.forEach((t) => t.visible && this.addTower(t, false));

    this.redrawAllPipes(this.state.pipes, this.state.users);
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
      case 'user':
      case 'capture':
      case 'pump':
      case 'reservoir':
      case 'tower': {
        // весь код для спец-объектов
        const objType = this.dragState.type;
        const objId = this.dragState.id;

        switch (objType) {
          case 'well':
            this.objectService.moveWell(objId, newPos);
            break;
          case 'user':
            this.objectService.moveUser(objId, newPos);
            break;
          case 'capture':
            this.objectService.moveCapture(objId, newPos);
            break;
          case 'pump':
            this.objectService.movePump(objId, newPos);
            break;
          case 'reservoir':
            this.objectService.moveReservoir(objId, newPos);
            break;
          case 'tower':
            this.objectService.moveTower(objId, newPos);
            break;
        }

        // смещение delta
        const delta: Point = [
          newPos[0] - this.dragState.initialPos[0],
          newPos[1] - this.dragState.initialPos[1],
        ];

        // перемещаем вершины труб под объектом
        this.state.pipes.forEach((pipe) => {
          pipe.vertices.forEach((v, idx) => {
            if (this.isSamePoint(v, this.dragState.initialPos)) {
              const oldPos: Point = [...v];
              pipe.vertices[idx] = [v[0] + delta[0], v[1] + delta[1]];
              this.objectService.movePipeVertex(oldPos, pipe.vertices[idx]);
            }
          });
        });

        // обновляем начальную позицию
        this.dragState.initialPos = [...newPos];
        break;
      }
      case 'vertex': {
        const draggedPipe = this.state.pipes.find(
          (p) => p.id === this.dragState.pipeId
        );
        if (!draggedPipe) return;

        const vertexIndex = this.dragState.vertexIndex;
        const oldPos: Point = [...draggedPipe.vertices[vertexIndex]] as Point;
        draggedPipe.vertices[vertexIndex] = [...newPos];

        // обновляем через сервис
        this.objectService.movePipeVertex(oldPos, newPos);
        break;
      }
      case 'segment':
        const pipe = this.state.pipes.find(
          (p) => p.id === this.dragState.pipeId
        );
        if (!pipe) return;

        const { fromIndex, toIndex } = this.dragState;

        const oldCenter = this.dragState.initialCenter;
        const delta: Point = [
          newPos[0] - oldCenter[0],
          newPos[1] - oldCenter[1],
        ];

        // собираем все вершины сегмента
        const verticesToMove: Point[] = [];
        for (let i = fromIndex; i <= toIndex; i++) {
          verticesToMove.push([...pipe.vertices[i]]);
        }

        // перемещаем вершины сегмента и уведомляем сервис
        verticesToMove.forEach((oldPos, idx) => {
          const vertexIndex = fromIndex + idx;
          pipe.vertices[vertexIndex] = [
            pipe.vertices[vertexIndex][0] + delta[0],
            pipe.vertices[vertexIndex][1] + delta[1],
          ];
          this.objectService.movePipeVertex(oldPos, pipe.vertices[vertexIndex]);
        });

        // обновляем центр для следующего события
        this.dragState.initialCenter = [...newPos];
        break;
    }

    requestAnimationFrame(() => {
      updateObjectPositions(this.map, this.g);
    });
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

    // задаём dragState с начальной позицией
    this.dragState = {
      type,
      id: obj.id,
      initialPos: [...obj.position], // ключ для смещения труб
    };

    this._dragActive = true;
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);

    if (event.currentTarget) {
      const el = d3.select(event.currentTarget as SVGGElement).select('image');
      el.attr('opacity', 0.7);
    }
  }

  findVertexUnderPoint(point: Point, maxDistancePx = 20) {
    let result = null;
    let minDist = Infinity;

    for (const pipe of this.state.pipes) {
      pipe.vertices.forEach((v: Point, index: number) => {
        const p = this.map.latLngToContainerPoint([v[1], v[0]]);
        const mouse = this.map.latLngToContainerPoint([point[1], point[0]]);

        const dist = p.distanceTo(mouse);
        if (dist < maxDistancePx && dist < minDist) {
          minDist = dist;
          result = { pipeId: pipe.id, vertexIndex: index };
        }
      });
    }

    return result; // либо null
  }

  saveAll() {
    if (!this.id_scheme) {
      console.error('id_scheme не определён');
      return;
    }

    this.sendDeletedObjects();
    this.sendUpdatedObjects();
    this.sendCreatedObjects();
  }

  //Удалённые объекты
  private sendDeletedObjects() {
    const deletedObjects = this.objectService
      .getDeletedObjects()
      .map((obj) => ({
        type: obj.type,
        id: typeof obj.id === 'string' ? parseInt(obj.id, 10) : obj.id,
      }));

    if (!deletedObjects.length) {
      console.log('Нет объектов для удаления');
      return;
    }

    this.dataSchemeService
      .deleteObjects(deletedObjects, this.id_scheme!)
      .subscribe({
        next: (res) => {
          console.log('Удалённые объекты успешно отправлены на сервер:', res);
          this.objectService.clearDeletedObjects();
        },
        error: (err) =>
          console.error('Ошибка при отправке удалённых объектов:', err),
      });
  }

  // -------------------- Обновлённые объекты --------------------
  private sendUpdatedObjects() {
    const updatedObjects = this.objectService.getUpdatedObjects();
    console.log('Обновлённые объекты перед отправкой:', updatedObjects);
    if (!updatedObjects.length) return;

    const features: any[] = [];
    updatedObjects.forEach((obj) => this.pushObjectFeatures(features, obj));

    if (!features.length) return;

    const payload = { data: { type: 'FeatureCollection', features } };
    this.dataSchemeService.updateObjects(payload).subscribe({
      next: () => this.objectService.clearUpdatedObjects(),
      error: (err) => console.error('Ошибка при обновлении объектов', err),
    });
  }

  // -------------------- Созданные объекты --------------------
  private sendCreatedObjects() {
    const createdObjects = this.objectService.getCreatedObjects();
    if (!createdObjects.length) return;

    const features: any[] = [];
    createdObjects.forEach((obj) =>
      this.pushObjectFeatures(features, obj, true)
    );

    if (!features.length) return;

    const payload = {
      data: { type: 'FeatureCollection', id_scheme: this.id_scheme, features },
    };
    this.dataSchemeService.createObjects(payload).subscribe({
      next: () => this.objectService.clearCreatedObjects(),
      error: (err) => console.error('Ошибка при создании объектов', err),
    });
  }

  // -------------------- Сегменты трубы --------------------
  private getSegmentsFromVertices(vertices: Point[]): [Point, Point][] {
    const segments: [Point, Point][] = [];
    for (let i = 1; i < vertices.length; i++) {
      segments.push([vertices[i - 1], vertices[i]]);
    }
    return segments;
  }

  // -------------------- Генерация Feature --------------------
  private pushObjectFeatures(features: any[], obj: any, isNew = false) {
    const { type, data } = obj;

    if (type === 'Труба') {
      let segments = data.updatedSegments;

      if (!segments || segments.length === 0) {
        segments = this.getSegmentsFromVertices(data.vertices);
      }

      const uniqueSegments = new Set<string>();

      segments.forEach(([from, to]: [Point, Point]) => {
        const key = `${from[0]},${from[1]}-${to[0]},${to[1]}`;
        if (uniqueSegments.has(key)) return;
        uniqueSegments.add(key);

        features.push(
          this.buildFeature(
            data.id,
            'Труба',
            { type: 'LineString', coordinates: [from, to] },
            { ...data.properties }
          )
        );
      });
    } else {
      if (!data.position) return;

      const geometry = { type: 'Point', coordinates: data.position };
      const properties = data.properties;
      features.push(this.buildFeature(data.id, type, geometry, properties));
    }
  }

  // -------------------- Общая генерация Feature --------------------
  private buildFeature(
    id: number,
    name_object_type: string,
    geometry: any,
    properties: any
  ) {
    return { type: 'Feature', id, name_object_type, geometry, properties };
  }

  // -------------------- Свойства по типу --------------------
}
