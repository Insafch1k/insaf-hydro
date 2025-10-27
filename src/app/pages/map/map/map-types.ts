export type Point = [number, number];

export interface Well {
  id: number;
  position: Point;
  visible: boolean;
}

export interface User {
  id: number;
  position: Point;
  visible: boolean;
}

export interface Pipe {
  id: number;
  vertices: Point[];
  userConnections: { from: Point; to: Point }[];
  visible: boolean;
  diameter: number;
}

export interface MapState {
  wells: Well[];
  pipes: Pipe[];
  users: User[];
  captures: any[];
  pumps: any[];
  reservoirs: any[];
  towers: any[];
  deletedObjects: { type: string; id: number | string }[];
}

export type ContextTargetType =
  | 'well'
  | 'user'
  | 'pipe'
  | 'pipe-segment'
  | 'capture'
  | 'pump'
  | 'reservoir'
  | 'tower';

export interface ContextTarget {
  type: ContextTargetType;
  data: any;
}

export interface Passport {
  id: number | string;
  type: ContextTargetType;
  data: any;
}

export interface DragState {
  type:
    | 'well'
    | 'user'
    | 'vertex'
    | 'segment'
    | 'capture'
    | 'pump'
    | 'reservoir'
    | 'tower';
  id?: number;
  pipeId?: number;
  vertexIndex?: number;
  fromIndex?: number;
  toIndex?: number;
  initialCenter?: Point;
}
