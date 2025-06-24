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

interface ObjectState {
  wells: Well[];
  pipes: Pipe[];
  users: User[];
}

@Injectable({
  providedIn: 'root'
})
export class ObjectService {
  private state = new BehaviorSubject<ObjectState>({
    wells: [],
    pipes: [],
    users: []
  });

  private wellIdCounter = 1;
  private pipeIdCounter = 1;
  private userIdCounter = 1;

  getState(): Observable<ObjectState> {
    return this.state.asObservable();
  }

  addWell(position: [number, number]) {
    const currentState = this.state.value;
    currentState.wells.push({
      id: this.wellIdCounter++,
      position,
      visible: true
    });
    this.state.next(currentState);
  }

  addPipe(vertices: [number, number][], userConnections: { from: [number, number]; to: [number, number] }[], diameter: number) {
    const currentState = this.state.value;
    currentState.pipes.push({
      id: this.pipeIdCounter++,
      vertices,
      userConnections,
      visible: true,
      diameter
    });
    this.state.next(currentState);
  }

  addUser(position: [number, number]) {
    const currentState = this.state.value;
    currentState.users.push({
      id: this.userIdCounter++,
      position,
      visible: true
    });
    this.state.next(currentState);
  }

  deleteWell(id: number) {
    const currentState = this.state.value;
    currentState.wells = currentState.wells.filter(well => well.id !== id);
    this.state.next(currentState);
  }

  deletePipe(id: number) {
    const currentState = this.state.value;
    currentState.pipes = currentState.pipes.filter(pipe => pipe.id !== id);
    this.state.next(currentState);
  }

  deleteUser(id: number) {
    const currentState = this.state.value;
    currentState.users = currentState.users.filter(user => user.id !== id);
    this.state.next(currentState);
  }

  toggleWellVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const well = currentState.wells.find(w => w.id === id);
    if (well) {
      well.visible = visible;
      this.state.next(currentState);
    }
  }

  togglePipeVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const pipe = currentState.pipes.find(p => p.id === id);
    if (pipe) {
      pipe.visible = visible;
      this.state.next(currentState);
    }
  }

  toggleUserVisibility(id: number, visible: boolean) {
    const currentState = this.state.value;
    const user = currentState.users.find(u => u.id === id);
    if (user) {
      user.visible = visible;
      this.state.next(currentState);
    }
  }

  toggleGroupVisibility(type: 'wells' | 'pipes' | 'users', visible: boolean) {
    const currentState = this.state.value;
    if (type === 'wells') {
      currentState.wells.forEach(well => (well.visible = visible));
    } else if (type === 'pipes') {
      currentState.pipes.forEach(pipe => (pipe.visible = visible));
    } else if (type === 'users') {
      currentState.users.forEach(user => (user.visible = visible));
    }
    this.state.next(currentState);
  }

  moveWell(id: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const well = currentState.wells.find(w => w.id === id);
    if (well) {
      const oldPosition = well.position;
      // Перемещаем связанные вершины труб
      currentState.pipes.forEach(pipe => {
        pipe.vertices.forEach((v, i) => {
          if (v[0] === oldPosition[0] && v[1] === oldPosition[1]) {
            pipe.vertices[i] = newPosition;
          }
        });
        pipe.userConnections.forEach(conn => {
          if (conn.from[0] === oldPosition[0] && conn.from[1] === oldPosition[1]) {
            conn.from = newPosition;
          }
          if (conn.to[0] === oldPosition[0] && conn.to[1] === oldPosition[1]) {
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
    const user = currentState.users.find(u => u.id === id);
    if (user) {
      const oldPosition = user.position;
      // Перемещаем связанные userConnections и вершины труб
      currentState.pipes.forEach(pipe => {
        pipe.userConnections.forEach(conn => {
          if (conn.to[0] === oldPosition[0] && conn.to[1] === oldPosition[1]) {
            conn.to = newPosition;
          }
        });
        pipe.vertices.forEach((v, i) => {
          if (v[0] === oldPosition[0] && v[1] === oldPosition[1]) {
            pipe.vertices[i] = newPosition;
          }
        });
      });
      user.position = newPosition;
      this.state.next(currentState);
    }
  }

  movePipeVertex(pipeId: number, vertexIndex: number, newPosition: [number, number]) {
    const currentState = this.state.value;
    const pipe = currentState.pipes.find(p => p.id === pipeId);
    if (pipe && pipe.vertices[vertexIndex]) {
      pipe.vertices[vertexIndex] = newPosition;
      // Перемещаем userConnections если совпадает
      pipe.userConnections.forEach(conn => {
        if (conn.from[0] === pipe.vertices[vertexIndex][0] && conn.from[1] === pipe.vertices[vertexIndex][1]) {
          conn.from = newPosition;
        }
        if (conn.to[0] === pipe.vertices[vertexIndex][0] && conn.to[1] === pipe.vertices[vertexIndex][1]) {
          conn.to = newPosition;
        }
      });
      this.state.next(currentState);
    }
  }

  movePipeSegment(pipeId: number, fromIndex: number, toIndex: number, delta: [number, number]) {
    const currentState = this.state.value;
    const pipe = currentState.pipes.find(p => p.id === pipeId);
    if (pipe && pipe.vertices[fromIndex] && pipe.vertices[toIndex]) {
      const oldFrom = pipe.vertices[fromIndex];
      const oldTo = pipe.vertices[toIndex];
      pipe.vertices[fromIndex] = [oldFrom[0] + delta[0], oldFrom[1] + delta[1]];
      pipe.vertices[toIndex] = [oldTo[0] + delta[0], oldTo[1] + delta[1]];
      // Перемещаем userConnections если совпадает
      pipe.userConnections.forEach(conn => {
        if ((conn.from[0] === oldFrom[0] && conn.from[1] === oldFrom[1]) ||
            (conn.from[0] === oldTo[0] && conn.from[1] === oldTo[1])) {
          conn.from = [conn.from[0] + delta[0], conn.from[1] + delta[1]];
        }
        if ((conn.to[0] === oldFrom[0] && conn.to[1] === oldFrom[1]) ||
            (conn.to[0] === oldTo[0] && conn.to[1] === oldTo[1])) {
          conn.to = [conn.to[0] + delta[0], conn.to[1] + delta[1]];
        }
      });
      // Если в одной из вершин есть скважина или потребитель — двигаем и их
      currentState.wells.forEach(well => {
        if ((well.position[0] === oldFrom[0] && well.position[1] === oldFrom[1])) {
          well.position = [well.position[0] + delta[0], well.position[1] + delta[1]];
        }
        if ((well.position[0] === oldTo[0] && well.position[1] === oldTo[1])) {
          well.position = [well.position[0] + delta[0], well.position[1] + delta[1]];
        }
      });
      currentState.users.forEach(user => {
        if ((user.position[0] === oldFrom[0] && user.position[1] === oldFrom[1])) {
          user.position = [user.position[0] + delta[0], user.position[1] + delta[1]];
        }
        if ((user.position[0] === oldTo[0] && user.position[1] === oldTo[1])) {
          user.position = [user.position[0] + delta[0], user.position[1] + delta[1]];
        }
      });
      this.state.next(currentState);
    }
  }
}