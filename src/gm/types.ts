// Formato de public/classic/game.json (lo genera tools/gmd/extract.mjs).

export interface ActionData {
  lib: number;
  id: number;
  kind: number;
  question: boolean;
  execType: number;
  fn?: string;
  code?: string;
  argKinds: number[];
  args: string[];
  appliesTo: number;
  relative?: boolean;
  not?: boolean;
}

export interface EventData {
  type: number;
  num: number;
  actions: ActionData[];
}

export interface ObjectData {
  id: number;
  name: string;
  sprite: string | null;
  solid: boolean;
  visible: boolean;
  depth: number;
  persistent: boolean;
  parent: string | null;
  mask: string | null;
  events: EventData[];
}

export interface SpriteData {
  file: string;
  id: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  frames: number;
  /** [izquierda, arriba, derecha, abajo] en píxeles del sprite. */
  bbox: [number, number, number, number];
  precise: boolean;
}

export interface RoomData {
  name: string;
  caption: string;
  width: number;
  height: number;
  speed: number;
  persistent: boolean;
  color: number;
  drawColor: boolean;
  creationCode: string;
  backgrounds: { visible: boolean; foreground: boolean; background: string | null; x: number; y: number; tileH: boolean; tileV: boolean; hspeed: number; vspeed: number; stretch: boolean }[];
  viewsEnabled: boolean;
  views: { visible: boolean; x: number; y: number; w: number; h: number; portX: number; portY: number; hborder: number; vborder: number; hspeed: number; vspeed: number; follow: number }[];
  instances: { x: number; y: number; object: string | null; id: number; code: string; locked: boolean }[];
  tiles: { x: number; y: number; background: string | null; tx: number; ty: number; w: number; h: number; depth: number; id: number }[];
}

export interface GameData {
  resources: {
    sprites: (string | null)[];
    sounds: (string | null)[];
    backgrounds: (string | null)[];
    scripts: (string | null)[];
    objects: (string | null)[];
    rooms: (string | null)[];
  };
  sprites: Record<string, SpriteData>;
  backgrounds: Record<string, { id: number; w: number; h: number; hasImage: boolean }>;
  sounds: Record<string, { id: number; kind: number; file: string | null }>;
  objects: (ObjectData | null)[];
  scripts: { id: number; name: string; code: string }[];
  rooms: RoomData[];
  /** Índices de room en el orden del árbol de recursos. */
  roomOrder: number[];
  helpRtf: string;
}
