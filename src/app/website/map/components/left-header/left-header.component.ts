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
  ObjectService,
  Well,
  Pipe,
  User,
  Capture,
  Pump,
  Reservoir,
  Tower,
} from '../../services/object.service';

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
  private subscription: Subscription;

  @Output() openPassportRequested = new EventEmitter<{
    type:
      | 'well'
      | 'pipe'
      | 'user'
      | 'pipe-segment'
      | 'capture'
      | 'pump'
      | 'reservoir'
      | 'tower';
    data: any;
  }>(); // Событие для открытия паспорта объекта

  openPipeIds: Set<number> = new Set();
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
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // Если появилась основная карта, инициализируем мини-карту
    if (changes['mainMap'] && this.mainMap && !this.isInitialized) {
      console.log('ngOnChanges: mainMap получен:', this.mainMap);
      this.initializeNavigator();
    }
  }

  ngAfterViewInit() {
    if (this.mainMap) {
      console.log('ngAfterViewInit: mainMap доступен:', this.mainMap);
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

    console.log('Инициализация navigatorMap');
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
      console.log('Привязка событий move и zoomend');
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
      console.log('Начальная синхронизация:', initialCenter, initialZoom);
      this.navigatorMap.setView(initialCenter, initialZoom);
    } else {
      console.error('mainMap не передан');
    }
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

  // --- Методы для включения/выключения объектов на карте ---
  toggleWellVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.toggleWellVisibility(id, visible);
  }

  togglePipeVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.togglePipeVisibility(id, visible);
  }

  toggleUserVisibility(id: number, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.toggleUserVisibility(id, visible);
  }

  toggleGroupVisibility(type: 'wells' | 'pipes' | 'users', event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.objectService.toggleGroupVisibility(type, visible);
  }

  // --- Работа с трубами и сегментами ---
  togglePipeSegments(pipeId: number) {
    if (this.openPipeIds.has(pipeId)) {
      this.openPipeIds.delete(pipeId);
    } else {
      this.openPipeIds.add(pipeId);
    }
  }

  getPipeSegments(pipe: Pipe) {
    const segments = [];
    for (let i = 1; i < pipe.vertices.length; i++) {
      const id = `${pipe.id}_${i - 1}_${i}`;
      segments.push({
        pipeId: pipe.id,
        from: pipe.vertices[i - 1],
        to: pipe.vertices[i],
        fromIndex: i - 1,
        toIndex: i,
        id,
        visible: this.segmentVisibility.get(id) ?? true,
      });
    }
    return segments;
  }

  toggleSegmentVisibility(segment: any, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.segmentVisibility.set(segment.id, checked);
    // Здесь можно добавить вызов сервиса для обновления видимости на карте, если нужно
  }

  // --- Методы для открытия паспортов объектов ---
  onOpenWellPassport(well: Well) {
    this.openPassportRequested.emit({ type: 'well', data: well });
  }

  onOpenPipePassport(pipe: Pipe) {
    this.openPassportRequested.emit({ type: 'pipe', data: pipe });
  }

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
    if (this.mainMap && segment.from && segment.to) {
      const bounds = L.latLngBounds([
        [segment.from[1], segment.from[0]],
        [segment.to[1], segment.to[0]],
      ]);
      this.mainMap.flyToBounds(bounds, { animate: true, maxZoom: 18 });
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
