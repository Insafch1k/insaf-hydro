import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Well {
  id: number;
  position: [number, number];
  visible: boolean;
}

export interface Pipe {
  id: number;
  vertices: [number, number][];
  userConnections: { from: [number, number]; to: [number, number] }[];
  visible: boolean;
  diameter: number;
}

export interface User {
  id: number;
  position: [number, number];
  visible: boolean;
}

export interface Capture {
  id: number;
  position: [number, number];
  visible: boolean;
  type: 'capture';
}

export interface Pump {
  id: number;
  position: [number, number];
  visible: boolean;
  type: 'pump';
}

export interface Reservoir {
  id: number;
  position: [number, number];
  visible: boolean;
  type: 'reservoir';
}

export interface Tower {
  id: number;
  position: [number, number];
  visible: boolean;
  type: 'tower';
}

interface ObjectState {
  wells: Well[];
  pipes: Pipe[];
  users: User[];
  captures: Capture[];
  pumps: Pump[];
  reservoirs: Reservoir[];
  towers: Tower[];
  deletedObjects: { type: string; id: number | string }[];
}

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

  addWell(position: [number, number]) {
    const currentState = this.state.value;
    const newWell = {
      id: this.wellIdCounter++,
      position,
      visible: true,
    };
    currentState.wells.push(newWell);
    this.createdObjects.push({ type: 'Скважина', data: newWell });
    this.state.next(currentState);
  }
  addPipe(
    vertices: [number, number][],
    userConnections: { from: [number, number]; to: [number, number] }[],
    diameter: number,
    name: string = `Труба #${this.pipeIdCounter}`
  ) {
    for (let i = 1; i < vertices.length; i++) {
      const segment = [vertices[i - 1], vertices[i]];

      const newPipe = {
        id: this.pipeIdCounter++,
        vertices: segment,
        userConnections:
          userConnections.length > 0
            ? [userConnections[i - 1] || userConnections[0]]
            : [],
        visible: true,
        diameter,
      };

      this.createdObjects.push({
        type: 'Труба',
        data: { ...newPipe, _name: name },
      });
    }

    this.state.next({
      ...this.state.value,
      pipes: [
        ...this.state.value.pipes,
        ...this.createdObjects
          .filter((obj) => obj.type === 'Труба')
          .map((obj) => {
            const { _name, ...pipeData } = obj.data;
            return pipeData as Pipe;
          }),
      ],
    });
  }

  addUser(position: [number, number]) {
    const currentState = this.state.value;
    const newUser = {
      id: this.userIdCounter++,
      position,
      visible: true,
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
    };
    currentState.towers.push(newTower);
    this.createdObjects.push({ type: 'Водонапорная башня', data: newTower });
    this.state.next(currentState);
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

  deletePipeSegment(pipeId: number, fromIndex: number, toIndex: number) {
    const currentState = this.state.value;
    const pipe = currentState.pipes.find((p) => p.id === pipeId);
    if (!pipe) {
      console.error('Труба не найдена:', pipeId);
      return;
    }

    // Проверяем, что сегмент существует (fromIndex и toIndex должны быть соседними)
    if (
      fromIndex + 1 !== toIndex ||
      fromIndex < 0 ||
      toIndex >= pipe.vertices.length
    ) {
      console.error('Недопустимые индексы сегмента:', {
        pipeId,
        fromIndex,
        toIndex,
      });
      return;
    }

    const newPipes: Pipe[] = [];
    // Разделяем трубу на две части, если сегмент не на краю
    if (fromIndex > 0) {
      const leftVertices = pipe.vertices.slice(0, fromIndex + 1);
      if (leftVertices.length >= 2) {
        newPipes.push({
          id: this.pipeIdCounter++,
          vertices: leftVertices,
          userConnections: pipe.userConnections.filter((conn) =>
            leftVertices.some(
              (v) =>
                this.isSamePoint(v, conn.from) || this.isSamePoint(v, conn.to)
            )
          ),
          visible: true,
          diameter: pipe.diameter,
        });
      }
    }
    if (toIndex < pipe.vertices.length - 1) {
      const rightVertices = pipe.vertices.slice(toIndex);
      if (rightVertices.length >= 2) {
        newPipes.push({
          id: this.pipeIdCounter++,
          vertices: rightVertices,
          userConnections: pipe.userConnections.filter((conn) =>
            rightVertices.some(
              (v) =>
                this.isSamePoint(v, conn.from) || this.isSamePoint(v, conn.to)
            )
          ),
          visible: true,
          diameter: pipe.diameter,
        });
      }
    }

    // Удаляем оригинальную трубу и добавляем новые
    this.state.next({
      ...currentState,
      pipes: [
        ...currentState.pipes.filter((p) => p.id !== pipeId),
        ...newPipes,
      ],
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
        pipe.userConnections.forEach((conn) => {
          if (this.isSamePoint(conn.from, oldPosition)) {
            conn.from = newPosition;
          }
          if (this.isSamePoint(conn.to, oldPosition)) {
            conn.to = newPosition;
          }
        });
      });
      well.position = newPosition;
      this.state.next(currentState);
    }
  }

  moveUser(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const user = currentState.users.find((u) => u.id === id);
    if (user) {
      const oldPosition = user.position;
      currentState.pipes.forEach((pipe) => {
        pipe.userConnections.forEach((conn) => {
          if (this.isSamePoint(conn.to, oldPosition)) {
            conn.to = newPosition;
          }
        });
        pipe.vertices.forEach((v, i) => {
          if (this.isSamePoint(v, oldPosition)) {
            pipe.vertices[i] = newPosition;
          }
        });
      });
      user.position = newPosition;
      this.state.next(currentState);
    }
  }

  movePipeVertex(
    pipeId: number,
    vertexIndex: number,
    newPosition: [number, number]
  ) {
    const currentState = this.state.value;
    const pipe = currentState.pipes.find((p) => p.id === pipeId);
    if (pipe && pipe.vertices[vertexIndex]) {
      const oldPosition = pipe.vertices[vertexIndex];
      pipe.vertices[vertexIndex] = newPosition;
      pipe.userConnections.forEach((conn) => {
        if (this.isSamePoint(conn.from, oldPosition)) {
          conn.from = newPosition;
        }
        if (this.isSamePoint(conn.to, oldPosition)) {
          conn.to = newPosition;
        }
      });
      this.state.next(currentState);
    }
  }

  movePipeSegment(
    pipeId: number,
    fromIndex: number,
    toIndex: number,
    delta: [number, number]
  ) {
    const currentState = this.state.value;
    const pipe = currentState.pipes.find((p) => p.id === pipeId);
    if (pipe && pipe.vertices[fromIndex] && pipe.vertices[toIndex]) {
      const oldFrom = pipe.vertices[fromIndex];
      const oldTo = pipe.vertices[toIndex];
      pipe.vertices[fromIndex] = [oldFrom[0] + delta[0], oldFrom[1] + delta[1]];
      pipe.vertices[toIndex] = [oldTo[0] + delta[0], oldTo[1] + delta[1]];
      pipe.userConnections.forEach((conn) => {
        if (
          this.isSamePoint(conn.from, oldFrom) ||
          this.isSamePoint(conn.from, oldTo)
        ) {
          conn.from = [conn.from[0] + delta[0], conn.from[1] + delta[1]];
        }
        if (
          this.isSamePoint(conn.to, oldFrom) ||
          this.isSamePoint(conn.to, oldTo)
        ) {
          conn.to = [conn.to[0] + delta[0], conn.to[1] + delta[1]];
        }
      });
      currentState.wells.forEach((well) => {
        if (
          this.isSamePoint(well.position, oldFrom) ||
          this.isSamePoint(well.position, oldTo)
        ) {
          well.position = [
            well.position[0] + delta[0],
            well.position[1] + delta[1],
          ];
        }
      });
      currentState.users.forEach((user) => {
        if (
          this.isSamePoint(user.position, oldFrom) ||
          this.isSamePoint(user.position, oldTo)
        ) {
          user.position = [
            user.position[0] + delta[0],
            user.position[1] + delta[1],
          ];
        }
      });
      this.state.next(currentState);
    }
  }

  moveCapture(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const obj = currentState.captures.find((o) => o.id === id);
    if (obj) {
      obj.position = newPosition;
      this.state.next(currentState);
    }
  }

  movePump(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const obj = currentState.pumps.find((o) => o.id === id);
    if (obj) {
      obj.position = newPosition;
      this.state.next(currentState);
    }
  }

  moveReservoir(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const obj = currentState.reservoirs.find((o) => o.id === id);
    if (obj) {
      obj.position = newPosition;
      this.state.next(currentState);
    }
  }

  moveTower(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const obj = currentState.towers.find((o) => o.id === id);
    if (obj) {
      obj.position = newPosition;
      this.state.next(currentState);
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
