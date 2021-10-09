import { makeNoise2D } from "fast-simplex-noise";
import sr from "seedrandom";
const seedrandom: sr = require("seedrandom");

import { Chunk } from "./World";
import Voxel, { VoxelType } from "../../Voxel";

export interface ChunkGeneratorOptions {
  chunkSize: number;
  chunkOffset: number;
  chunkHeight: number;
  seaLevel: number;
  cavernLevel: number;
  cavernBleed: number;
  bedrock: number;
  noisePosFactor: number;
  noiseScale: number;
  noise2Scale: number;
}

export default class ChunkGenerator {
  random: ReturnType<sr.Callback>;
  noise: ReturnType<typeof makeNoise2D>;
  noise2: ReturnType<typeof makeNoise2D>;

  chunkSize = 8;
  chunkOffset = 0;
  chunkHeight = 80;
  seaLevel = 0;
  cavernLevel = -12;
  cavernBleed = 7;
  bedrock = -30;

  noisePosFactor = 0.01;
  noiseScale = 8;
  noise2Scale = 4;
  noiseCache: { [index: string]: { n: number; n2: number; tOff: number } } = {};

  constructor(seed: number, options: ChunkGeneratorOptions) {
    this.random = seedrandom(String(seed));
    this.noise = makeNoise2D(this.random);
    this.noise2 = makeNoise2D(this.random);

    // assign world gen options
    this.chunkSize = options.chunkSize;
    this.chunkOffset = options.chunkOffset;
    this.chunkHeight = options.chunkHeight;
    this.seaLevel = options.seaLevel;
    this.cavernLevel = options.cavernLevel;
    this.cavernBleed = options.cavernBleed;
    this.bedrock = options.bedrock;
    this.noisePosFactor = options.noisePosFactor;
    this.noiseScale = options.noiseScale;
    this.noise2Scale = options.noise2Scale;
  }

  fillNoiseCache(startX: number, startZ: number) {
    this.noiseCache = {};

    for (let x = startX; x < startX + this.chunkSize; x++) {
      for (let z = startZ; z < startZ + this.chunkSize; z++) {
        this.noiseCache[`${x} ${z}`] = this.getTerrainNoise(x, z);
      }
    }
  }

  generateChunk(x: number, y: number): Chunk {
    const chunkX = (x - this.chunkOffset) * this.chunkSize;
    const chunkZ = (y - this.chunkOffset) * this.chunkSize;

    this.fillNoiseCache(chunkX, chunkZ);

    const c = this.generateLayers(chunkX, chunkZ);
    this.generateTrees(c, x, y);

    return c;
  }

  generateLayers(chunkX: number, chunkZ: number) {
    const chunk: Chunk = [];

    for (let y = this.bedrock; y < this.bedrock + this.chunkHeight; y++) {
      const slice: Voxel[][] = [];
      for (let x = chunkX; x < chunkX + this.chunkSize; x++) {
        const col: Voxel[] = [];
        for (let z = chunkZ; z < chunkZ + this.chunkSize; z++) {
          const { tOff } = this.noiseCache[`${x} ${z}`];

          // world cake layers
          let id = VoxelType.DIRT;
          if (y === this.seaLevel + tOff) id = VoxelType.GRASS;
          else if (y > this.seaLevel + tOff) id = VoxelType.AIR;

          // bleed cavern layer into dirt
          if (y < this.cavernLevel + Math.floor(this.random() * this.cavernBleed) && id !== VoxelType.AIR)
            id = VoxelType.STONE;

          const voxel = new Voxel(id, x, y, z);
          col.push(voxel);
        }

        slice.push(col);
      }

      chunk.push(slice);
    }

    return chunk;
  }

  generateTrees(chunk: Chunk, chunkX: number, chunkY: number) {
    const treeHeight = 5;
    const treeHeightDiff = -1;
    const treeScaleChance = 0.2;
    const treeUpperRange = -this.noiseScale / 6;
    const treeLowerRange = -this.noiseScale / 1.3;

    // NOTE: trees are always place 1 away from chunk borders

    // trunks pass
    this.forEachVoxel(chunk, (vox, relX, relY, relZ) => {
      const { tOff } = this.noiseCache[`${vox.x} ${vox.z}`];
      if (
        vox.y < this.seaLevel + tOff + 1 ||
        vox.y > this.seaLevel + tOff + treeHeight + (this.random() < treeScaleChance ? treeHeightDiff : 0) ||
        relX === 0 ||
        relX === this.chunkSize - 1 ||
        relZ === 0 ||
        relZ === this.chunkSize - 1
      )
        return;

      if (
        tOff > treeLowerRange &&
        tOff < treeUpperRange &&
        vox.y === this.seaLevel + tOff + 1 &&
        chunk[relY - 1][relX][relZ].id === VoxelType.GRASS &&
        this.random() < 0.018
      ) {
        vox.id = VoxelType.LOG;
      } else if (vox.id === VoxelType.AIR && chunk[relY - 1][relX][relZ].id === VoxelType.LOG) {
        vox.id = VoxelType.LOG;
      }
    });

    // leaves pass
    this.forEachVoxel(chunk, (vox, relX, relY, relZ) => {
      const { tOff } = this.noiseCache[`${vox.x} ${vox.z}`];
      if (vox.y < this.cavernLevel || vox.y > this.seaLevel + tOff + treeHeight) return;

      if (vox.id === VoxelType.LOG) {
        let logsBelow = 0;
        let y = relY - 1;
        while (chunk[y][relX][relZ].id === VoxelType.LOG) {
          logsBelow++;
          y--;
        }

        // place leaves around top of tree
        if (logsBelow >= 2) {
          const neighbours = vox.getNeighbours(chunk, {});

          // side leaves
          Object.keys(neighbours).forEach((k) => {
            if (!neighbours[k] || k === "top" || k === "bottom") return;

            neighbours[k].id = VoxelType.LEAVES;

            // fill in gaps
            const nextNeighbours = neighbours[k].getNeighbours(chunk, {});
            if (k === "left" || k === "right") {
              if (nextNeighbours.front) nextNeighbours.front.id = VoxelType.LEAVES;
              if (nextNeighbours.back) nextNeighbours.back.id = VoxelType.LEAVES;
            }
          });

          // top
          if (neighbours.top && neighbours.top.id === VoxelType.AIR) {
            neighbours.top.id = VoxelType.LEAVES;

            const topNeighbours = neighbours.top.getNeighbours(chunk, {});
            if (topNeighbours.left) topNeighbours.left.id = VoxelType.LEAVES;
            if (topNeighbours.right) topNeighbours.right.id = VoxelType.LEAVES;
            if (topNeighbours.front) topNeighbours.front.id = VoxelType.LEAVES;
            if (topNeighbours.back) topNeighbours.back.id = VoxelType.LEAVES;
          }
        }
      }
    });
  }

  getTerrainNoise(x: number, z: number) {
    const n = Math.floor(this.noise(x * this.noisePosFactor, z * this.noisePosFactor) * this.noiseScale);
    const n2 = Math.floor(this.noise2(x * this.noisePosFactor, z * this.noisePosFactor) * this.noise2Scale);
    const tOff = n - n2;

    return {
      n,
      n2,
      tOff,
    };
  }

  forEachVoxel(chunk: Chunk, voxCb: (voxel?: Voxel, x?: number, y?: number, z?: number) => void | boolean) {
    for (let y = 0; y < chunk.length; y++) {
      for (let x = 0; x < this.chunkSize; x++) {
        for (let z = 0; z < this.chunkSize; z++) {
          const vox = chunk[y][x][z];
          voxCb(vox, x, y, z);
        }
      }
    }
  }
}
