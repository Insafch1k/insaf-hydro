import {
  Component,
  AfterViewInit,
  Input,
  SimpleChanges,
  OnChanges,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import {
  Well,
  Pipe,
  User,
  Capture,
  Pump,
  Reservoir,
  Tower,
} from '../../map/map-types';
import { ObjectService } from '../../services/object.service';

// Это Angular-компонент LeftHeaderComponent, который работает с картой Leaflet.
// Он отображает список объектов (скважины, трубы, пользователи, насосы и т. д.),
// позволяет включать/выключать их видимость, открывать «паспорта» объектов (детальную инфу), а также «перелетать» к объектам на карте.
// Также он создаёт дополнительную маленькую карту-навигатор, синхронизированную с основной картой.

@Component({
  selector: 'app-left-header',
  templateUrl: './left-header.component.html',
  styleUrls: ['./left-header.component.scss'],
})
export class LeftHeaderComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() mainMap!: L.Map; // Основная карта, передаётся извне
  private navigatorMap!: L.Map; // Мини-карта навигатор
  private isInitialized = false;

  wells: Well[] = [];
  pipes: Pipe[] = [];
  users: User[] = [];
  captures: Capture[] = [];
  pumps: Pump[] = [];
  reservoirs: Reservoir[] = [];
  towers: Tower[] = [];

  // Состояния меню (открыто/закрыто)
  isObjectTypesOpen = false;
  isWellsOpen = false;
  isPipesOpen = false;
  isUsersOpen = false;
  isCapturesOpen = false;
  isPumpsOpen = false;
  isReservoirsOpen = false;
  isTowersOpen = false;
  private subscription: Subscription;
  pipeSegments: any[] = [];

  @Output() openPassportRequested = new EventEmitter<{
    type:
      | 'well'
      | 'user'
      | 'pipe-segment'
      | 'capture'
      | 'pump'
      | 'reservoir'
      | 'tower';
    data: any;
  }>(); // Событие для открытия паспорта объекта

  segmentVisibility: Map<string, boolean> = new Map();

  constructor(private objectService: ObjectService) {
    this.subscription = this.objectService.getState().subscribe((state) => {
      this.wells = state.wells;
      this.pipes = state.pipes;
      this.users = state.users;
      this.captures = state.captures;
      this.pumps = state.pumps;
      this.reservoirs = state.reservoirs;
      this.towers = state.towers;

      this.updatePipeSegmentsList();
    });
  }

  updatePipeSegmentsList() {
    const all: any[] = [];
    this.pipes.forEach((pipe) => {
      const segments = this.getPipeSegments(pipe);
      all.push(...segments);
    });
    this.pipeSegments = all;
  }

  getPipeSegments(pipe: Pipe) {
    const segments = [];
    if (!pipe.vertices) return []; // Защита

    for (let i = 1; i < pipe.vertices.length; i++) {
      const id = `${pipe.id}_${i - 1}_${i}`;
      segments.push({
        pipeId: pipe.id,
        from: pipe.vertices[i - 1],
        to: pipe.vertices[i],
        fromIndex: i - 1,
        toIndex: i,
        id,
        // Состояние берем из Map, если его там нет - из самой трубы
        visible: this.segmentVisibility.has(id)
          ? this.segmentVisibility.get(id)
          : pipe.visible ?? true,
        name: pipe.properties?.Имя || `Труба #${pipe.id}`,
        diameter: pipe.diameter,
      });
    }
    return segments;
  }

  togglePipeSegmentVisibility(pipeId: number, segmentId: string, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.segmentVisibility.set(segmentId, visible);

    // Чтобы UI обновился мгновенно, перегенерируем список
    this.updatePipeSegmentsList();

    const pipe = this.pipes.find((p) => p.id === pipeId);
    if (pipe) {
      const allSegments = this.getPipeSegments(pipe);
      const hasVisibleSegment = allSegments.some(
        (s) => this.segmentVisibility.get(s.id) !== false
      );
      this.objectService.togglePipeVisibility(pipeId, hasVisibleSegment);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Если появилась основная карта, инициализируем мини-карту
    if (changes['mainMap'] && this.mainMap && !this.isInitialized) {
      this.initializeNavigator();
    }
  }

  ngAfterViewInit() {
    if (this.mainMap) {
      this.initializeNavigator();
    } else {
      console.warn('ngAfterViewInit: mainMap ещё не доступен');
    }
    // Глобально отменяем дефолтное контекстное меню браузера
    document.addEventListener('contextmenu', this.preventContextMenu, true);
  }

  ngOnDestroy() {
    // Отписываемся и убираем обработчики при удалении компонента
    this.subscription.unsubscribe();
    document.removeEventListener('contextmenu', this.preventContextMenu, true);
  }

  private initializeNavigator() {
    // Создание мини-карты и синхронизация с основной
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.navigatorMap = L.map('navigator-map', {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
      attributionControl: false,
    }).setView([55.81773887844533, 49.12457564650256], 10);

    L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(this.navigatorMap);

    if (this.mainMap) {
      this.mainMap.on('move', () => {
        const center = this.mainMap.getCenter();
        this.navigatorMap.panTo(center, { animate: true, duration: 0.1 });
      });
      this.mainMap.on('zoomend', () => {
        const zoom = this.mainMap.getZoom() - 3;
        this.navigatorMap.setZoom(zoom, { animate: true });
      });
      const initialCenter = this.mainMap.getCenter();
      const initialZoom = this.mainMap.getZoom() - 3;
      this.navigatorMap.setView(initialCenter, initialZoom);
    } else {
      console.error('mainMap не передан');
    }
  }

  getAllPipeSegments(): any[] {
    const allSegments: any[] = [];

    this.pipes.forEach((pipe) => {
      const segments = this.getPipeSegments(pipe);
      allSegments.push(...segments);
    });

    return allSegments;
  }

  // --- Методы для открытия/закрытия меню ---
  toggleObjectTypes() {
    this.isObjectTypesOpen = !this.isObjectTypesOpen;
  }

  toggleWells() {
    this.isWellsOpen = !this.isWellsOpen;
  }

  togglePipes() {
    this.isPipesOpen = !this.isPipesOpen;
  }

  toggleUsers() {
    this.isUsersOpen = !this.isUsersOpen;
  }

  toggleCaptures() {
    this.isCapturesOpen = !this.isCapturesOpen;
  }

  togglePumps() {
    this.isPumpsOpen = !this.isPumpsOpen;
  }

  toggleReservoirs() {
    this.isReservoirsOpen = !this.isReservoirsOpen;
  }

  toggleTowers() {
    this.isTowersOpen = !this.isTowersOpen;
  }

  // --- Методы для включения/выключения объектов на карте ---
  toggleWellVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.toggleWellVisibility(id, visible);
  }

  togglePipeVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    const pipe = this.pipes.find((p) => p.id === id);
    if (!pipe) return;

    const segments = this.getPipeSegments(pipe);
    segments.forEach((segment) => {
      this.segmentVisibility.set(segment.id, visible);
    });

    this.objectService.togglePipeVisibility(id, visible);
  }

  toggleUserVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.toggleUserVisibility(id, visible);
  }

  toggleGroupVisibility(
    type:
      | 'wells'
      | 'pipes'
      | 'users'
      | 'captures'
      | 'pumps'
      | 'reservoirs'
      | 'towers',
    event: Event
  ) {
    const visible = (event.target as HTMLInputElement).checked;

    switch (type) {
      case 'pipes':
        // Для труб обновляем все сегменты
        this.pipes.forEach((pipe) => {
          this.objectService.togglePipeVisibility(pipe.id, visible);

          // Также обновляем состояние сегментов локально
          const segments = this.getPipeSegments(pipe);
          segments.forEach((segment) => {
            this.segmentVisibility.set(segment.id, visible);
          });
        });
        break;
      case 'wells':
      case 'users':
        this.objectService.toggleGroupVisibility(type, visible);
        break;
      case 'captures':
        this.captures.forEach((capture) => {
          this.objectService.toggleCaptureVisibility(capture.id, visible);
        });
        break;
      case 'pumps':
        this.pumps.forEach((pump) => {
          this.objectService.togglePumpVisibility(pump.id, visible);
        });
        break;
      case 'reservoirs':
        this.reservoirs.forEach((reservoir) => {
          this.objectService.toggleReservoirVisibility(reservoir.id, visible);
        });
        break;
      case 'towers':
        this.towers.forEach((tower) => {
          this.objectService.toggleTowerVisibility(tower.id, visible);
        });
        break;
    }
  }

  // --- Методы для открытия паспортов объектов ---
  onOpenWellPassport(well: Well) {
    this.openPassportRequested.emit({ type: 'well', data: well });
  }

  // onOpenPipePassport(pipe: Pipe) {
  //   this.openPassportRequested.emit({ type: 'pipe', data: pipe });
  // }

  onOpenUserPassport(user: User) {
    this.openPassportRequested.emit({ type: 'user', data: user });
  }

  onOpenPipeSegmentPassport(segment: any) {
    console.log('Открыть паспорт отрезка:', segment);
    this.openPassportRequested.emit({ type: 'pipe-segment', data: segment });
  }

  // --- Методы для перелётов на объект ---
  onFlyToWell(well: Well) {
    if (this.mainMap && well.position) {
      this.mainMap.flyTo(
        [well.position[1], well.position[0]],
        Math.max(this.mainMap.getZoom(), 17),
        { animate: true }
      );
    }
  }

  onFlyToPipe(pipe: Pipe) {
    if (this.mainMap && pipe.vertices && pipe.vertices.length > 0) {
      const latlngs = pipe.vertices.map((v) => [v[1], v[0]]);
      const bounds = L.latLngBounds(latlngs as [number, number][]);
      this.mainMap.flyToBounds(bounds, { animate: true, maxZoom: 17 });
    }
  }

  onFlyToPipeSegment(segment: any) {
    console.log('Попытка flyTo к сегменту:', segment); // ЧТО ПРИХОДИТ?
    if (this.mainMap && segment.from && segment.to) {
      const bounds = L.latLngBounds([
        [segment.from[1], segment.from[0]],
        [segment.to[1], segment.to[0]],
      ]);
      console.log('Bounds созданы:', bounds);
      this.mainMap.flyToBounds(bounds, { animate: true, maxZoom: 18 });
    } else {
      console.error('Ошибка: отсутствуют координаты или карта', {
        map: !!this.mainMap,
        from: segment?.from,
        to: segment?.to,
      });
    }
  }

  onFlyToUser(user: User) {
    if (this.mainMap && user.position) {
      this.mainMap.flyTo(
        [user.position[1], user.position[0]],
        Math.max(this.mainMap.getZoom(), 17),
        { animate: true }
      );
    }
  }

  onOpenCapturePassport(obj: Capture) {
    this.openPassportRequested.emit({ type: 'capture', data: obj });
  }

  onOpenPumpPassport(obj: Pump) {
    this.openPassportRequested.emit({ type: 'pump', data: obj });
  }

  onOpenReservoirPassport(obj: Reservoir) {
    this.openPassportRequested.emit({ type: 'reservoir', data: obj });
  }

  onOpenTowerPassport(obj: Tower) {
    this.openPassportRequested.emit({ type: 'tower', data: obj });
  }

  onFlyToCapture(obj: Capture) {
    if (this.mainMap && obj.position) {
      this.mainMap.flyTo(
        [obj.position[1], obj.position[0]],
        Math.max(this.mainMap.getZoom(), 17),
        { animate: true }
      );
    }
  }

  onFlyToPump(obj: Pump) {
    if (this.mainMap && obj.position) {
      this.mainMap.flyTo(
        [obj.position[1], obj.position[0]],
        Math.max(this.mainMap.getZoom(), 17),
        { animate: true }
      );
    }
  }

  onFlyToReservoir(obj: Reservoir) {
    if (this.mainMap && obj.position) {
      this.mainMap.flyTo(
        [obj.position[1], obj.position[0]],
        Math.max(this.mainMap.getZoom(), 17),
        { animate: true }
      );
    }
  }

  onFlyToTower(obj: Tower) {
    if (this.mainMap && obj.position) {
      this.mainMap.flyTo(
        [obj.position[1], obj.position[0]],
        Math.max(this.mainMap.getZoom(), 17),
        { animate: true }
      );
    }
  }

  // --- Методы для переключения видимости других объектов ---
  toggleCaptureVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.toggleCaptureVisibility(id, visible);
  }

  togglePumpVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.togglePumpVisibility(id, visible);
  }

  toggleReservoirVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.toggleReservoirVisibility(id, visible);
  }

  toggleTowerVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.toggleTowerVisibility(id, visible);
  }

  private preventContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
}
