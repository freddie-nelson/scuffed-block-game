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
}

// corners for face geometry
export const corners: { [index: string]: number[][] } = {
  left: [
    [0, 1, 0],
    [0, 0, 0],
    [0, 1, 1],
    [0, 0, 1],
  ],
  right: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
    [1, 0, 0],
  ],
  bottom: [
    [1, 0, 1],
    [0, 0, 1],
    [1, 0, 0],
    [0, 0, 0],
  ],
  top: [
    [0, 1, 1],
    [1, 1, 1],
    [0, 1, 0],
    [1, 1, 0],
  ],
  back: [
    [1, 0, 0],
    [0, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ],
  front: [
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ],
};

// dir for face geometry
export const dir: { [index: string]: number[] } = {
  left: [0, 0, -1],
  right: [0, 0, 1],
  bottom: [0, -1, 0],
  top: [0, 1, 0],
  back: [-1, 0, 0],
  front: [1, 0, 0],
};

export enum VoxelType {
  AIR,
  GRASS,
  DIRT,
  STONE,
  WOOD,
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
}
