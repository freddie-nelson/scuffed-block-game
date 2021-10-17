import { faces, Neighbours, VoxelType } from "./Voxel";

export interface GeometryGeneratorOptions {
  chunkSize: number;
  chunkHeight: number;
  bedrock: number;
  tileSize: number;
  tileTextureWidth: number;
  tileTextureHeight: number;
}

export default class GeometryGenerator {
  chunkSize: number;
  chunkHeight: number;
  bedrock: number;
  tileSize: number;
  tileTextureWidth: number;
  tileTextureHeight: number;

  constructor(options: GeometryGeneratorOptions) {
    this.chunkSize = options.chunkSize;
    this.chunkHeight = options.chunkHeight;
    this.bedrock = options.bedrock;
    this.tileSize = options.tileSize;
    this.tileTextureWidth = options.tileTextureWidth;
    this.tileTextureHeight = options.tileTextureHeight;
  }

  convertGeoToTypedArrs(geo: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }) {
    return {
      positions: new Float32Array(geo.positions),
      normals: new Float32Array(geo.normals),
      uvs: new Float32Array(geo.uvs),
      indices: geo.indices,
    };
  }

  generateChunkGeometry(chunk: Uint8Array) {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    for (let y = 0; y < this.chunkHeight; y++) {
      for (let x = 0; x < this.chunkSize; x++) {
        for (let z = 0; z < this.chunkSize; z++) {
          const id = chunk[x + this.chunkSize * (y + this.chunkHeight * z)];
          const { position, normal, index, uv } = this.generateVoxelGeometry(
            id,
            x,
            y,
            z,
            this.getVoxelNeighbours(chunk, x, y, z),
            positions.length
          );

          positions.push(...position);
          normals.push(...normal);
          indices.push(...index);
          uvs.push(...uv);
        }
      }
    }

    return {
      positions,
      normals,
      indices,
      uvs,
    };
  }

  generateVoxelGeometry(
    id: VoxelType,
    x: number,
    y: number,
    z: number,
    neighbours: Neighbours<number>,
    posLength: number
  ) {
    if (id === VoxelType.AIR)
      return {
        position: [],
        normal: [],
        index: [],
        uv: [],
      }; // empty

    const position: number[] = [];
    const normal: number[] = [];
    const index: number[] = [];
    const uv: number[] = [];

    Object.keys(neighbours).forEach((k) => {
      const n = neighbours[k];
      if (!n || n === 0) {
        const ndx = (posLength + position.length) / 3;

        for (const corner of faces[k].corners) {
          position.push(corner.pos[0] + x, corner.pos[1] + y, corner.pos[2] + z);
          normal.push(...faces[k].dir);

          uv.push(
            ((faces[k].uvCol + corner.uv[0]) * this.tileSize) / this.tileTextureWidth,
            1 - ((id - corner.uv[1]) * this.tileSize) / this.tileTextureHeight
          );
        }

        index.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
      }
    });

    return {
      position,
      normal,
      index,
      uv,
    };
  }

  private getVoxelNeighbours(chunk: Uint8Array, x: number, y: number, z: number) {
    const neighbours: Neighbours<number> = {
      back: z - 1 >= 0 ? chunk[this.from3Dto1D(x, y, z - 1)] : null,
      front: z + 1 < this.chunkSize ? chunk[this.from3Dto1D(x, y, z + 1)] : null,
      left: x - 1 >= 0 ? chunk[this.from3Dto1D(x - 1, y, z)] : null,
      right: x + 1 < this.chunkSize ? chunk[this.from3Dto1D(x + 1, y, z)] : null,
      top: y + 1 < this.chunkHeight ? chunk[this.from3Dto1D(x, y + 1, z)] : null,
      bottom: y - 1 >= 0 ? chunk[this.from3Dto1D(x, y - 1, z)] : null,
    };

    return neighbours;
  }

  private from3Dto1D(x: number, y: number, z: number) {
    return x + this.chunkSize * (y + this.chunkHeight * z);
  }
}
