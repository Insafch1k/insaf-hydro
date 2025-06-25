import { Component, AfterViewInit, Input, SimpleChanges, OnChanges, OnDestroy, Output, EventEmitter } from '@angular/core';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { ObjectService, Well, Pipe, User } from '../../services/object.service';

@Component({
  selector: 'app-left-header',
  templateUrl: './left-header.component.html',
  styleUrls: ['./left-header.component.scss']
})
export class LeftHeaderComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() mainMap!: L.Map;
  private navigatorMap!: L.Map;
  private isInitialized = false;
  wells: Well[] = [];
  pipes: Pipe[] = [];
  users: User[] = [];
  isObjectTypesOpen = false;
  isWellsOpen = false;
  isPipesOpen = false;
  isUsersOpen = false;
  private subscription: Subscription;
  @Output() openPassportRequested = new EventEmitter<{ type: 'well' | 'pipe' | 'user' | 'pipe-segment', data: any }>();
  openPipeIds: Set<number> = new Set();
  segmentVisibility: Map<string, boolean> = new Map();

  constructor(private objectService: ObjectService) {
    this.subscription = this.objectService.getState().subscribe(state => {
      this.wells = state.wells;
      this.pipes = state.pipes;
      this.users = state.users;
    });
  }

  ngOnChanges(changes: SimpleChanges) {
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
    this.subscription.unsubscribe();
    document.removeEventListener('contextmenu', this.preventContextMenu, true);
  }

  private initializeNavigator() {
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
      attributionControl: false
    }).setView([55.81773887844533, 49.12457564650256], 10);

    L.tileLayer(
      'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }
    ).addTo(this.navigatorMap);

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
        visible: this.segmentVisibility.get(id) ?? true
      });
    }
    return segments;
  }

  toggleSegmentVisibility(segment: any, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.segmentVisibility.set(segment.id, checked);
    // Здесь можно добавить вызов сервиса для обновления видимости на карте, если нужно
  }

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

  private preventContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
}