import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CubeTextureLoader,
  DirectionalLight,
  HemisphereLight,
  Material,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  Texture,
  TextureLoader,
} from "three";

import { makeNoise2D } from "fast-simplex-noise";

import sr from "seedrandom";
const seedrandom: sr = require("seedrandom");

import Engine from "../Engine";
import Player from "../Player";
import Scene from "./Scene";
import Voxel, { faces, Neighbours, VoxelType } from "../Voxel";

export type Chunk = Voxel[][][];

export default class World extends Scene {
  seed: number;
  random: ReturnType<sr.Callback>;

  player: Player;

  skybox: Mesh;
  tileTextures: Texture;
  chunkMaterial: MeshLambertMaterial;
  tileSize = 16;
  tileTextureWidth = 48;
  tileTextureHeight = 96;

  worldSize = 512;
  renderDist = 8;
  voxelSize = 1;
  chunkSize = 8;

  chunks: Chunk[][] = [];
  generated: boolean[][] = [];
  lastGeneratedCenter: { x: number; y: number };
  chunkRenderOffset = Math.floor(this.renderDist / 2);
  chunkOffset = Math.floor(this.worldSize / 2);
  renderedMeshes: Mesh<BufferGeometry, MeshLambertMaterial>[] = [];

  chunkHeight = 80;
  seaLevel = 0;
  cavernLevel = -12;
  cavernBleed = 7;
  bedrock = -30;

  noise: ReturnType<typeof makeNoise2D>;
  noise2: ReturnType<typeof makeNoise2D>;
  noisePosFactor = 0.01;
  noiseScale = 8;
  noise2Scale = 4;

  noiseCache: { [index: string]: { n: number; n2: number; tOff: number } } = {};

  constructor(id: string) {
    super(id);

    this.seed = 3;

    this.random = seedrandom(String(this.seed));
    this.noise = makeNoise2D(this.random);
    this.noise2 = makeNoise2D(this.random);
  }

  init() {
    // create skybox
    Engine.renderScene.background = new Color("lightblue");
    const skylight = new HemisphereLight("lightblue", "white", 0.5);
    Engine.renderScene.add(skylight);

    this.addLight(0, this.chunkHeight, this.worldSize);

    this.player = new Player(0, 0, 0);
    this.player.init();

    // load tile textures
    const loader = new TextureLoader();
    this.tileTextures = loader.load("assets/textures/tilesheet.png");
    this.tileTextures.magFilter = NearestFilter;
    this.tileTextures.minFilter = NearestFilter;

    this.chunkMaterial = new MeshLambertMaterial({
      map: this.tileTextures,
    });

    this.initChunks();
    const { chunkX, chunkY } = this.player.getChunk();
    this.lastGeneratedCenter = { x: chunkX, y: chunkY };
    this.generate(chunkX, chunkY);
  }

  update(delta: number) {
    this.player.update();

    const { chunkX, chunkY } = this.player.getChunk();
    if (chunkX !== this.lastGeneratedCenter.x || chunkY !== this.lastGeneratedCenter.y) {
      this.generate(chunkX, chunkY);
      this.lastGeneratedCenter = { x: chunkX, y: chunkY };
    }
  }

  private addLight(x: number, y: number, z: number) {
    const dirLight = new DirectionalLight(0xffffff, 0.8);

    dirLight.position.set(x, y, z);
    dirLight.target.position.set(0, 0, 0);
    Engine.renderScene.add(dirLight);
  }

  initChunks() {
    for (let y = 0; y < this.worldSize; y++) {
      this.chunks.push(new Array(this.worldSize));
      this.generated.push(new Array(this.worldSize));
    }
  }

  generate(centerX: number, centerY: number) {
    const limits = {
      lowerX: centerX - this.chunkRenderOffset,
      iterationsY: this.renderDist,
      lowerY: centerY - this.chunkRenderOffset,
      iterationsX: this.renderDist,
    };

    // generate chunk data
    let timer = performance.now();
    let chunksGenerated = 0;
    console.log("Generating chunks...");
    this.forEachChunk(limits, (chunk, x, y) => {
      if (this.generated[y][x]) return;

      const chunkX = (x - this.chunkOffset) * this.chunkSize;
      const chunkZ = (y - this.chunkOffset) * this.chunkSize;

      this.fillNoiseCache(chunkX, chunkZ);

      const c = this.generateChunk(chunkX, chunkZ);

      this.generateTrees(c, x, y);

      this.chunks[y][x] = c;
      this.generated[y][x] = true;
      chunksGenerated++;
    });
    console.log(`Generated ${chunksGenerated} chunks in ${performance.now() - timer}ms.`);

    // generate chunk meshes
    timer = performance.now();
    console.log("Creating mesh...");
    this.generateMesh(limits);
    console.log(`Finished creating mesh in ${performance.now() - timer}ms.`);
  }

  fillNoiseCache(startX: number, startZ: number) {
    this.noiseCache = {};

    for (let x = startX; x < startX + this.chunkSize; x++) {
      for (let z = startZ; z < startZ + this.chunkSize; z++) {
        this.noiseCache[`${x} ${z}`] = this.getTerrainNoise(x, z);
      }
    }
  }

  getChunkNeighbours(x: number, y: number) {
    return <Neighbours<Chunk>>{
      left: x - 1 >= 0 ? this.chunks[y][x - 1] : undefined,
      right: x + 1 < this.worldSize ? this.chunks[y][x + 1] : undefined,
      back: y - 1 >= 0 ? this.chunks[y - 1][x] : undefined,
      front: y + 1 < this.worldSize ? this.chunks[y + 1][x] : undefined,
    };
  }

  generateChunk(chunkX: number, chunkZ: number) {
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

    // trunks pass
    this.forEachVoxel(chunk, (vox, relX, relY, relZ) => {
      // TODO properly fix mesh generation for trees on chunk borders
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
          const chunkNeighbours = this.getChunkNeighbours(chunkX, chunkY);
          const neighbours = vox.getNeighbours(chunk, chunkNeighbours);

          // side leaves
          Object.keys(neighbours).forEach((k) => {
            if (!neighbours[k] || k === "top" || k === "bottom") return;

            neighbours[k].id = VoxelType.LEAVES;
            const { chunk: c, chunkX: cX, chunkY: cY } = neighbours[k].getChunk();
            let nextNeighbours;
            if (cX !== chunkX || cY !== chunkY) {
              nextNeighbours = neighbours[k].getNeighbours(c, this.getChunkNeighbours(cX, cY));
            } else {
              nextNeighbours = neighbours[k].getNeighbours(chunk, chunkNeighbours);
            }

            // if (nextNeighbours[k]) nextNeighbours[k].id = VoxelType.LEAVES;

            // fill in gaps
            if (k === "left" || k === "right") {
              if (nextNeighbours.front) nextNeighbours.front.id = VoxelType.LEAVES;
              if (nextNeighbours.back) nextNeighbours.back.id = VoxelType.LEAVES;
            }
          });

          // top
          if (neighbours.top && neighbours.top.id === VoxelType.AIR) {
            neighbours.top.id = VoxelType.LEAVES;

            const topNeighbours = neighbours.top.getNeighbours(chunk, chunkNeighbours);
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

  forEachChunk(
    limits: { lowerX: number; iterationsX: number; lowerY: number; iterationsY: number },
    chunkCb: (chunk?: Chunk, x?: number, y?: number) => void,
    rowCb?: (row?: Chunk[], y?: number) => void
  ) {
    for (let y = limits.lowerY; y < limits.lowerY + limits.iterationsY; y++) {
      if (y >= this.chunks.length) break;
      else if (y < 0) continue;

      const row = this.chunks[y];
      if (rowCb) rowCb(row, y);
      for (let x = limits.lowerX; x < limits.lowerX + limits.iterationsX; x++) {
        if (x >= row.length) break;
        else if (x < 0) continue;

        chunkCb(row[x], x, y);
      }
    }
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

  generateMesh(limits: { lowerX: number; iterationsX: number; lowerY: number; iterationsY: number }) {
    const noRender: { [index: string]: boolean } = {};

    // clear old uneeded meshes
    for (let i = this.renderedMeshes.length - 1; i >= 0; i--) {
      const mesh = this.renderedMeshes[i];
      const x = mesh.position.x / this.chunkSize + this.chunkOffset;
      const y = mesh.position.z / this.chunkSize + this.chunkOffset;

      if (
        x < limits.lowerX ||
        x >= limits.lowerX + limits.iterationsX ||
        y < limits.lowerY ||
        y >= limits.lowerY + limits.iterationsY
      ) {
        Engine.renderScene.remove(mesh);

        mesh.geometry.dispose();
        mesh.geometry = null;

        mesh.material.dispose();
        // mesh.material = null;

        // console.log(`Remove mesh at (${x}, ${y}).`);
        this.renderedMeshes.splice(i, 1);
      } else {
        noRender[`${x} ${y}`] = true;
      }
    }

    this.forEachChunk(limits, (chunk, x, y) => {
      if (noRender[`${x} ${y}`]) return;

      const c = this.chunks[y][x];
      const n = this.getChunkNeighbours(x, y);

      const { positions, normals, indices, uvs } = this.generateChunkGeometry(c, n);
      const geometry = new BufferGeometry();

      const positionNumComponents = 3;
      const normalNumComponents = 3;
      const uvNumComponents = 2;
      geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(positions), positionNumComponents)
      );
      geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), normalNumComponents));
      geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), uvNumComponents));
      geometry.setIndex(indices);
      const mesh = new Mesh(geometry, this.chunkMaterial);
      mesh.position.set(c[0][0][0].x, c[0][0][0].y, c[0][0][0].z);
      // mesh.castShadow = true;
      // mesh.receiveShadow = true;

      Engine.renderScene.add(mesh);
      this.renderedMeshes.push(mesh);
    });
  }

  generateChunkGeometry(chunk: Chunk, neighbours: Neighbours<Chunk>) {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    for (let y = 0; y < chunk.length; y++) {
      for (let x = 0; x < chunk[y].length; x++) {
        const slice = chunk[y][x];

        for (let z = 0; z < slice.length; z++) {
          const { position, normal, index, uv } = this.generateVoxelGeometry(
            x,
            y,
            z,
            positions.length,
            chunk,
            neighbours
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
    x: number,
    y: number,
    z: number,
    posLength: number,
    chunk: Chunk,
    cNeighbours: Neighbours<Chunk>
  ) {
    const voxel = chunk[y][x][z];
    if (voxel.id === VoxelType.AIR)
      return {
        position: [],
        normal: [],
        index: [],
        uv: [],
      }; // empty

    const neighbours = voxel.getNeighbours(chunk, cNeighbours);

    const position: number[] = [];
    const normal: number[] = [];
    const index: number[] = [];
    const uv: number[] = [];

    Object.keys(neighbours).forEach((k) => {
      const n = neighbours[k];
      if (!n || n.id === 0) {
        const ndx = (posLength + position.length) / 3;

        for (const corner of faces[k].corners) {
          position.push(corner.pos[0] + x, corner.pos[1] + y, corner.pos[2] + z);
          normal.push(...faces[k].dir);

          uv.push(
            ((faces[k].uvCol + corner.uv[0]) * this.tileSize) / this.tileTextureWidth,
            1 - ((voxel.id - corner.uv[1]) * this.tileSize) / this.tileTextureHeight
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

  getVoxel(x: number, y: number, z: number, chunkPos?: { x?: number; y?: number }) {
    const chunkX = Math.floor(x / this.chunkSize) + this.chunkOffset; // 1
    const chunkY = Math.floor(z / this.chunkSize) + this.chunkOffset; // 1
    if (chunkX < 0 || chunkX >= this.worldSize || chunkY < 0 || chunkY >= this.worldSize) return;
    const chunk = this.chunks[chunkY][chunkX];

    const relY = y + Math.abs(this.bedrock); // 40
    const relX = x + Math.abs(chunk[0][0][0].x) * Math.sign(x * -1);
    // console.log(chunk[0][0][0].x);
    const relZ = z + Math.abs(chunk[0][0][0].z) * Math.sign(z * -1);
    // console.log(relY, relX, relZ);
    if (
      relY < 0 ||
      relY >= this.chunkHeight ||
      relX < 0 ||
      relX >= this.chunkSize ||
      relZ < 0 ||
      relZ >= this.chunkSize
    )
      return;

    if (chunkPos) {
      chunkPos.x = chunkX;
      chunkPos.y = chunkY;
    }

    return chunk[relY][relX][relZ];
  }
}
