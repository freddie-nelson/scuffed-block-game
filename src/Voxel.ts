import Engine from "./Engine";
import World, { Chunk } from "./scenes/World";

export interface Neighbours<T> {
  [index: string]: T;
  left?: T;
  right?: T;
  bottom?: T;
  top?: T;
  front?: T;
  back?: T;
  fl?: T;
  fr?: T;
  bl?: T;
  br?: T;
}

export interface Face {
  uvCol: number;
  dir: number[];
  corners: { pos: number[]; uv: number[] }[];
}

// face geometry
export const faces: { [index: string]: Face } = {
  left: {
    uvCol: 1,
    dir: [0, 0, -1],
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  right: {
    uvCol: 1,
    dir: [0, 0, 1],
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  bottom: {
    uvCol: 2,
    dir: [0, -1, 0],
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  top: {
    uvCol: 0,
    dir: [0, 1, 0],
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  back: {
    uvCol: 1,
    dir: [-1, 0, 0],
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  front: {
    uvCol: 1,
    dir: [1, 0, 0],
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
};

export enum VoxelType {
  AIR,
  GRASS,
  DIRT,
  LOG,
  WOOD,
  STONE,
  LEAVES,
}

export default class Voxel {
  id = VoxelType.AIR;
  x: number;
  y: number;
  z: number;

  constructor(id: VoxelType, x: number, y: number, z: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.z = z;
  }

  getNeighbours(chunk: Chunk, cNeighbours: Neighbours<Chunk>) {
    const cHeight = chunk.length;
    const chunkSize = chunk[0].length;

    const y = this.y + Math.abs((Engine.currScene as World).bedrock);
    const x = this.x + Math.abs(chunk[0][0][0].x) * Math.sign(this.x * -1);
    const z = this.z + Math.abs(chunk[0][0][0].z) * Math.sign(this.z * -1);

    const neighbours: Neighbours<Voxel> = {
      back: z - 1 >= 0 ? chunk[y][x][z - 1] : cNeighbours.back ? cNeighbours.back[y][x][chunkSize - 1] : null,
      front: z + 1 < chunkSize ? chunk[y][x][z + 1] : cNeighbours.front ? cNeighbours.front[y][x][0] : null,
      left: x - 1 >= 0 ? chunk[y][x - 1][z] : cNeighbours.left ? cNeighbours.left[y][chunkSize - 1][z] : null,
      right: x + 1 < chunkSize ? chunk[y][x + 1][z] : cNeighbours.right ? cNeighbours.right[y][0][z] : null,
      top: y + 1 < cHeight ? chunk[y + 1][x][z] : cNeighbours.top ? cNeighbours.top[0][x][z] : null,
      bottom:
        y - 1 >= 0 ? chunk[y - 1][x][z] : cNeighbours.bottom ? cNeighbours.bottom[cHeight - 1][x][z] : null,
    };

    // console.log(this.x, this.y, this.z);
    // console.log(neighbours);

    return neighbours;
  }

  getChunk() {
    const world = <World>Engine.currScene;
    const chunkX = Math.floor(this.x / world.chunkSize + world.chunkOffset);
    const chunkY = Math.floor(this.z / world.chunkSize + world.chunkOffset);

    return {
      chunk: world.chunks[chunkY][chunkX],
      chunkX,
      chunkY,
    };
  }
}
