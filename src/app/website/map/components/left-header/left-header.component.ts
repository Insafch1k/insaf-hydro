import { Component, AfterViewInit, Input, SimpleChanges, OnChanges, OnDestroy } from '@angular/core';
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
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
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
}