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

export interface ObjectState {
  wells: Well[];
  pipes: Pipe[];
  users: User[];
  captures: Capture[];
  pumps: Pump[];
  reservoirs: Reservoir[];
  towers: Tower[];
  deletedObjects: { type: string; id: number | string }[];
}

export type Point = [number, number];

export type MapObjectType =
  | 'well'
  | 'user'
  | 'pipe'
  | 'pipe-segment'
  | 'capture'
  | 'pump'
  | 'reservoir'
  | 'tower';

// Структура контекстного меню
export interface ContextTarget {
  type: MapObjectType;
  data: any;
}

// Соединение пользователя с трубой
export interface PipeConnection {
  from: Point;
  to: Point;
}

// Временная линия при рисовании трубы
export interface TempLine {
  from: Point;
  to: Point;
}

// Паспорт объекта (для боковых панелей, модалок и пр.)
export interface Passport {
  id: number | string;
  type: MapObjectType;
  data: any;
}

// Структура состояния карты (wells, pipes, users, deletedObjects и т.д.)
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

// Позиция диалогового окна (выбор типа объекта)
export interface DialogPosition {
  x: number;
  y: number;
}
