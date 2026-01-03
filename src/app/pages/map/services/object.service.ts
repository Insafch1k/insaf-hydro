import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Well,
  Pipe,
  User,
  Capture,
  Pump,
  Reservoir,
  Tower,
  ObjectState,
  Point,
} from '../map/map-types';

@Injectable({
  providedIn: 'root',
})
export class ObjectService {
  private state = new BehaviorSubject<ObjectState>({
    wells: [],
    pipes: [],
    users: [],
    captures: [],
    pumps: [],
    reservoirs: [],
    towers: [],
    deletedObjects: [],
  });

  private wellIdCounter = 1;
  private pipeIdCounter = 1;
  private userIdCounter = 1;
  private captureIdCounter = 1;
  private pumpIdCounter = 1;
  private reservoirIdCounter = 1;
  private towerIdCounter = 1;
  private createdObjects: { type: string; data: any }[] = [];

  getCreatedObjects() {
    return this.createdObjects;
  }

  clearCreatedObjects() {
    this.createdObjects = [];
  }

  getState(): Observable<ObjectState> {
    return this.state.asObservable();
  }

  addPipe(
    vertices: [number, number][],
    diameter: number,
    name: string = `Труба #${this.pipeIdCounter}`
  ) {
    const newSegments: Pipe[] = [];

    for (let i = 1; i < vertices.length; i++) {
      const segment = [vertices[i - 1], vertices[i]];

      const newPipe: Pipe = {
        id: this.pipeIdCounter++,
        vertices: segment,
        visible: true,
        diameter,
        type: 'pipe-segment',
        properties: {
          Имя: name,
          Диаметр: diameter,
          Адрес: '-',
        },
      };

      newSegments.push(newPipe);

      this.createdObjects.push({
        type: 'Труба',
        data: newPipe,
      });
    }

    this.state.next({
      ...this.state.value,
      pipes: [...this.state.value.pipes, ...newSegments],
    });
  }

  addWell(position: [number, number]) {
    const currentState = this.state.value;

    const newWell: Well = {
      id: this.wellIdCounter++,
      position,
      visible: true,
      type: 'well',
      properties: this.getPropertiesByType('Скважина', this.wellIdCounter),
    };

    currentState.wells.push(newWell);
    this.createdObjects.push({ type: 'Скважина', data: newWell });
    this.state.next(currentState);
  }

  addUser(position: [number, number]) {
    const currentState = this.state.value;

    const newUser: User = {
      id: this.userIdCounter++,
      position,
      visible: true,
      type: 'user',
      properties: this.getPropertiesByType('Потребитель', this.userIdCounter),
    };

    currentState.users.push(newUser);
    this.createdObjects.push({ type: 'Потребитель', data: newUser });
    this.state.next(currentState);
  }

  addCapture(position: [number, number]) {
    const currentState = this.state.value;

    const newCapture: Capture = {
      id: this.captureIdCounter++,
      position,
      visible: true,
      type: 'capture',
      properties: this.getPropertiesByType('Каптаж', this.captureIdCounter),
    };

    currentState.captures.push(newCapture);
    this.createdObjects.push({ type: 'Каптаж', data: newCapture });
    this.state.next(currentState);
  }

  addPump(position: [number, number]) {
    const currentState = this.state.value;

    const newPump: Pump = {
      id: this.pumpIdCounter++,
      position,
      visible: true,
      type: 'pump',
      properties: this.getPropertiesByType('Насос', this.pumpIdCounter),
    };

    currentState.pumps.push(newPump);
    this.createdObjects.push({ type: 'Насос', data: newPump });
    this.state.next(currentState);
  }

  addReservoir(position: [number, number]) {
    const currentState = this.state.value;

    const newReservoir: Reservoir = {
      id: this.reservoirIdCounter++,
      position,
      visible: true,
      type: 'reservoir',
      properties: this.getPropertiesByType(
        'Контр-резервуар',
        this.reservoirIdCounter
      ),
    };

    currentState.reservoirs.push(newReservoir);
    this.createdObjects.push({ type: 'Контр-резервуар', data: newReservoir });
    this.state.next(currentState);
  }

  addTower(position: [number, number]) {
    const currentState = this.state.value;

    const newTower: Tower = {
      id: this.towerIdCounter++,
      position,
      visible: true,
      type: 'tower',
      properties: this.getPropertiesByType(
        'Водонапорная башня',
        this.towerIdCounter
      ),
    };

    currentState.towers.push(newTower);
    this.createdObjects.push({ type: 'Водонапорная башня', data: newTower });
    this.state.next(currentState);
  }

  private getPropertiesByType(type: string, id: number) {
    switch (type) {
      case 'Скважина':
        return { Имя: `Скважина #${id}`, Адрес: '-', Глубина: 0, Диаметр: 0 };
      case 'Труба':
        return { Имя: `Труба #${id}`, Диаметр: 0.5, Адрес: '-' };
      case 'Потребитель':
        return {
          Адрес: '-',
          'Геодезическая отметка': 0.0,
          'Диаметр выходного отверстия': 0.0,
          Имя: '-',
          Категория: '-',
          'Минимальный напор воды': 0.0,
          Напор: 0.0,
          'Относительный расход воды': 0.0,
          'Полный напор': 0.0,
          'Расчетный расход воды в будний день': 0.0,
          'Расчетный расход воды в воскресенье': 0.0,
          'Расчетный расход воды в праздники': 0.0,
          'Расчетный расход воды в субботу': 0.0,
          'Расчётный расход воды': 0.0,
          'Способ задания потребителя': '-',
          'Текущий расход воды': 0.0,
          'Уровень воды': 0.0,
        };
      case 'Каптаж':
        return {
          Имя: `Каптаж #${id}`,
          Адрес: '-',
          Производительность: 0,
          'Бренд насоса': '-',
          'Глубина скважины': 0,
          'Диаметр скважины': 0,
        };
      case 'Насос':
        return {
          Адрес: '-',
          'Геодезическая отметка': 0,
          Имя: '-',
          Источники: '-',
          Марка: '-',
          'Напор на входе': 0,
          'Напор на выходе': 0,
          'Номинальный напор после насоса': 0,
          'Номинальный напор развиваемый насосом': 0,
          'Полный напор на входе': 0,
          'Полный напор на выходе': 0,
          'Путь пройденный от источника': 0,
          'Текущий расход воды': 0,
        };
      case 'Контр-резервуар':
        return {
          Адрес: '-',
          'Высота воды': 0,
          'Геодезическая отметка': 0,
          Имя: `Насос #${id}`,
          Напор: 0,
          'Полный напор': 0,
          'Расход воды л/с': 0,
          'Расход воды м3/ч': 0,
        };
      case 'Водонапорная башня':
        return {
          Адрес: '-',
          'Высота воды': 0,
          'Геодезическая отметка': 0,
          Имя: '-',
          Напор: 0,
          'Полный напор': 0,
          'Расход воды л/с': 0,
          'Расход воды м3/ч': 0,
        };
      default:
        return { Имя: `${type} #${id}`, Адрес: '-' };
    }
  }

  deleteWell(id: number) {
    const currentState = this.state.value;
    currentState.wells = currentState.wells.filter((well) => well.id !== id);
    currentState.deletedObjects.push({ type: 'Скважина', id });
    this.state.next(currentState);
  }

  deletePipe(id: number) {
    const currentState = this.state.value;
    currentState.pipes = currentState.pipes.filter((pipe) => pipe.id !== id);
    currentState.deletedObjects.push({ type: 'Труба', id });
    this.state.next(currentState);
  }

  deleteUser(id: number) {
    const currentState = this.state.value;
    currentState.users = currentState.users.filter((user) => user.id !== id);
    currentState.deletedObjects.push({ type: 'Потребитель', id });
    this.state.next(currentState);
  }

  deleteCapture(id: number) {
    const currentState = this.state.value;
    currentState.captures = currentState.captures.filter((o) => o.id !== id);
    currentState.deletedObjects.push({ type: 'Каптаж', id });
    this.state.next(currentState);
  }

  deletePump(id: number) {
    const currentState = this.state.value;
    currentState.pumps = currentState.pumps.filter((o) => o.id !== id);
    currentState.deletedObjects.push({ type: 'Насос', id });
    this.state.next(currentState);
  }

  deleteReservoir(id: number) {
    const currentState = this.state.value;
    currentState.reservoirs = currentState.reservoirs.filter(
      (o) => o.id !== id
    );
    currentState.deletedObjects.push({ type: 'Контр-резервуар', id });
    this.state.next(currentState);
  }

  deleteTower(id: number) {
    const currentState = this.state.value;
    currentState.towers = currentState.towers.filter((o) => o.id !== id);
    currentState.deletedObjects.push({ type: 'Водонапорная башня', id });
    this.state.next(currentState);
  }

  deletePipeSegment(pipeId: number) {
    const currentState = this.state.value;
    const pipe = currentState.pipes.find((p) => p.id === pipeId);
    if (!pipe) return;

    this.state.next({
      ...currentState,
      pipes: currentState.pipes.filter((p) => p.id !== pipeId),
      deletedObjects: [
        ...currentState.deletedObjects,
        { type: 'Труба', id: pipeId },
      ],
    });
  }

  toggleWellVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const well = currentState.wells.find((w) => w.id === id);
    if (well) {
      well.visible = visible;
      this.state.next(currentState);
    }
  }

  togglePipeVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const pipe = currentState.pipes.find((p) => p.id === id);
    if (pipe) {
      pipe.visible = visible;
      this.state.next(currentState);
    }
  }

  toggleUserVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const user = currentState.users.find((u) => u.id === id);
    if (user) {
      user.visible = visible;
      this.state.next(currentState);
    }
  }

  toggleCaptureVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const obj = currentState.captures.find((o) => o.id === id);
    if (obj) {
      obj.visible = visible;
      this.state.next(currentState);
    }
  }

  togglePumpVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const obj = currentState.pumps.find((o) => o.id === id);
    if (obj) {
      obj.visible = visible;
      this.state.next(currentState);
    }
  }

  toggleReservoirVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const obj = currentState.reservoirs.find((o) => o.id === id);
    if (obj) {
      obj.visible = visible;
      this.state.next(currentState);
    }
  }

  toggleTowerVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const obj = currentState.towers.find((o) => o.id === id);
    if (obj) {
      obj.visible = visible;
      this.state.next(currentState);
    }
  }

  toggleGroupVisibility(type: 'wells' | 'pipes' | 'users', visible: boolean) {
    const currentState = this.state.value;
    if (type === 'wells') {
      currentState.wells.forEach((well) => (well.visible = visible));
    } else if (type === 'pipes') {
      currentState.pipes.forEach((pipe) => (pipe.visible = visible));
    } else if (type === 'users') {
      currentState.users.forEach((user) => (user.visible = visible));
    }
    this.state.next(currentState);
  }

  private updatedObjects: any[] = [];

  getUpdatedObjects() {
    return this.updatedObjects;
  }

  clearUpdatedObjects() {
    this.updatedObjects = [];
  }

  markUpdated(type: string, obj: any) {
    console.log('markUpdated вызван для', type, obj.id);
    const isNew = this.createdObjects.some((o) => o.data.id === obj.id);
    if (isNew) return;

    const index = this.updatedObjects.findIndex((o) => o.data.id === obj.id);
    const actualProperties = { ...obj.properties };

    if (index >= 0) {
      // ОБЯЗАТЕЛЬНО обновляем специфичные поля для труб и точек
      if (type === 'Труба') {
        // Клонируем массив вершин, чтобы разорвать связь со старыми данными
        this.updatedObjects[index].data.vertices = JSON.parse(
          JSON.stringify(obj.vertices)
        );
      } else {
        this.updatedObjects[index].data.position = [...obj.position];
      }
      this.updatedObjects[index].data.properties = actualProperties;
    } else {
      // При первом добавлении делаем глубокую копию данных
      this.updatedObjects.push({
        type,
        data: JSON.parse(
          JSON.stringify({ ...obj, properties: actualProperties })
        ),
      });
    }
  }

  moveWell(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const well = currentState.wells.find((w) => w.id === id);
    if (well) {
      const oldPosition = well.position;
      currentState.pipes.forEach((pipe) => {
        pipe.vertices.forEach((v, i) => {
          if (this.isSamePoint(v, oldPosition)) {
            pipe.vertices[i] = newPosition;
          }
        });
      });
      well.position = newPosition;
      this.state.next(currentState);
      this.markUpdated('Скважина', well);
    }
  }

  moveUser(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const user = currentState.users.find((u) => u.id === id);
    if (user) {
      const oldPosition = user.position;
      currentState.pipes.forEach((pipe) => {
        pipe.vertices.forEach((v, i) => {
          if (this.isSamePoint(v, oldPosition)) {
            pipe.vertices[i] = newPosition;
          }
        });
      });
      user.position = newPosition;
      this.state.next(currentState);
      this.markUpdated('Потребитель', user);
    }
  }

  getAllConnectedVertices(pipes: Pipe[], targetPos: [number, number]) {
    const result: { pipe: Pipe; vertexIndexes: number[] }[] = [];

    pipes.forEach((pipe) => {
      const indexes = pipe.vertices
        .map((v, i) => (this.isSamePoint(v, targetPos) ? i : -1))
        .filter((i) => i !== -1);

      if (indexes.length > 0) {
        result.push({ pipe, vertexIndexes: indexes });
      }
    });

    return result;
  }

  movePipeVertex(oldPos: Point, newPos: Point) {
    const state = this.state.value;

    // Находим все сегменты, где используется эта вершина
    const affectedSegments = state.pipes.filter((pipe) =>
      pipe.vertices.some((v) => this.isSamePoint(v, oldPos))
    );

    affectedSegments.forEach((pipe) => {
      // Проверяем, какая вершина в сегменте совпадает
      pipe.vertices = pipe.vertices.map((v) =>
        this.isSamePoint(v, oldPos) ? [...newPos] : v
      );

      console.log('markUpdated для трубы:', pipe.id);
      // Помечаем сегмент как обновленный
      this.markUpdated('Труба', pipe);
    });

    this.state.next(state);
  }

  movePipeSegment(
    pipeId: number,
    fromIndex: number,
    toIndex: number,
    delta: [number, number]
  ) {
    const currentState = this.state.value;
    const pipe = currentState.pipes.find((p) => p.id === pipeId);
    if (!pipe || !pipe.vertices[fromIndex] || !pipe.vertices[toIndex]) return;
    for (let i = fromIndex; i <= toIndex; i++) {
      const oldPos = pipe.vertices[i];
      pipe.vertices[i] = [oldPos[0] + delta[0], oldPos[1] + delta[1]];
      currentState.wells.forEach((well) => {
        if (this.isSamePoint(well.position, oldPos)) {
          well.position = [...pipe.vertices[i]];
        }
      });
      currentState.users.forEach((user) => {
        if (this.isSamePoint(user.position, oldPos)) {
          user.position = [...pipe.vertices[i]];
        }
      });
    }
    this.markUpdated('Труба', pipe);
    this.state.next(currentState);
  }

  moveCapture(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const obj = currentState.captures.find((o) => o.id === id);
    if (obj) {
      obj.position = newPosition;
      this.state.next(currentState);
      this.markUpdated('Каптаж', obj);
    }
  }

  movePump(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const obj = currentState.pumps.find((o) => o.id === id);
    if (obj) {
      obj.position = newPosition;
      this.state.next(currentState);
      this.markUpdated('Насос', obj);
    }
  }

  moveReservoir(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const obj = currentState.reservoirs.find((o) => o.id === id);
    if (obj) {
      obj.position = newPosition;
      this.state.next(currentState);
      this.markUpdated('Контр-резервуар', obj);
    }
  }

  moveTower(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const obj = currentState.towers.find((o) => o.id === id);
    if (obj) {
      obj.position = newPosition;
      this.state.next(currentState);
      this.markUpdated('Водонапорная башня', obj);
    }
  }

  getDeletedObjects(): { type: string; id: number | string }[] {
    return this.state.value.deletedObjects;
  }

  clearDeletedObjects() {
    const currentState = this.state.value;
    currentState.deletedObjects = [];
    this.state.next(currentState);
  }

  private isSamePoint(a: [number, number], b: [number, number]): boolean {
    const distance = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
    return distance < 0.0001;
  }
}
