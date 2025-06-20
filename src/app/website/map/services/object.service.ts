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

  addPipe(vertices: [number, number][], userConnections: { from: [number, number]; to: [number, number] }[]) {
    const currentState = this.state.value;
    currentState.pipes.push({
      id: this.pipeIdCounter++,
      vertices,
      userConnections,
      visible: true
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
}