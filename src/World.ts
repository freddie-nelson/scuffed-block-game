import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CubeTextureLoader,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Material,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  Texture,
  TextureLoader,
} from "three";

import Engine from "./Engine";
import Player from "./Player";
import Scene from "./Scene";
import Voxel, { faces, Neighbours, VoxelType } from "./Voxel";
import ChunkGenerator, { ChunkGeneratorOptions } from "./ChunkGenerator";
import { GeometryGeneratorOptions } from "./GeometryGenerator";

export type Chunk = Voxel[][][];

export default class World extends Scene {
  seed: number;

  player: Player;

  skybox: Mesh;
  tileTextures: Texture;
  chunkMaterial: MeshLambertMaterial;
  tileSize = 16;
  tileTextureWidth = 48;
  tileTextureHeight = 96;

  worldSize = 512;
  renderDist = 12;
  voxelSize = 1;
  chunkSize = 8;

  chunks: Chunk[][] = [];
  generated: boolean[][] = [];
  lastGeneratedCenter: { x: number; y: number };
  chunkRenderOffset = Math.floor(this.renderDist / 2);
  chunkOffset = Math.floor(this.worldSize / 2);
  renderedMeshes: Mesh<BufferGeometry, MeshLambertMaterial>[] = [];

  chunkGenerator: Worker;
  chunkGeneratorOptions: ChunkGeneratorOptions = {
    chunkOffset: this.chunkOffset,
    chunkSize: this.chunkSize,
    chunkHeight: 80,
    seaLevel: 0,
    cavernLevel: -12,
    cavernBleed: 7,
    bedrock: -30,
    noisePosFactor: 0.01,
    noiseScale: 8,
    noise2Scale: 4,
  };
  chunksQueued = 0;
  canRequestGeneration = true;
  generationLimits: { lowerX: number; iterationsX: number; lowerY: number; iterationsY: number };

  geometryGenerator: Worker;

  noiseCache: { [index: string]: { n: number; n2: number; tOff: number } } = {};

  constructor(id: string) {
    super(id);

    this.seed = 3;

    // setup workers
    this.setupChunkGenerator();
    this.setupGeometryGenerator();
  }

  init() {
    // create skybox
    Engine.renderScene.background = new Color("lightblue");
    const skylight = new HemisphereLight("lightblue", "white", 0.5);
    Engine.renderScene.add(skylight);

    // sun
    this.addLight(0, this.chunkGeneratorOptions.seaLevel + 200, this.worldSize);

    // fog
    Engine.renderScene.fog = new Fog(
      Engine.renderScene.background,
      this.chunkSize,
      (this.renderDist * this.chunkSize) / 2
    );

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
    this.requestGeneration(chunkX, chunkY);
  }

  update(delta: number) {
    if (this.player.getChunk().chunk && Engine.getDelta() < 0.1) this.player.update();

    const { chunkX, chunkY } = this.player.getChunk();
    if (chunkX !== this.lastGeneratedCenter.x || chunkY !== this.lastGeneratedCenter.y) {
      this.requestGeneration(chunkX, chunkY);
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

  requestGeneration(centerX: number, centerY: number) {
    const limits = {
      lowerX: centerX - this.chunkRenderOffset,
      iterationsY: this.renderDist,
      lowerY: centerY - this.chunkRenderOffset,
      iterationsX: this.renderDist,
    };

    this.generationLimits = limits;
    this.canRequestGeneration = false;

    // generate chunk data
    this.forEachChunk(limits, (chunk, x, y) => {
      if (this.generated[y][x]) return;

      this.chunkGenerator.postMessage({ msg: "requestGeneration", data: { x, y } });
      this.chunksQueued++;
      this.generated[y][x] = true;
    });
  }

  getChunkNeighbours(x: number, y: number) {
    return <Neighbours<Chunk>>{
      left: x - 1 >= 0 ? this.chunks[y][x - 1] : undefined,
      right: x + 1 < this.worldSize ? this.chunks[y][x + 1] : undefined,
      back: y - 1 >= 0 ? this.chunks[y - 1][x] : undefined,
      front: y + 1 < this.worldSize ? this.chunks[y + 1][x] : undefined,
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

  requestGeometry(limits: { lowerX: number; iterationsX: number; lowerY: number; iterationsY: number }) {
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

    // let timer = performance.now();
    // let parsedCount = 0;
    this.forEachChunk(limits, (chunk, x, y) => {
      if (noRender[`${x} ${y}`]) return;

      const parsed = this.parseChunk(chunk);
      // parsedCount++;

      this.geometryGenerator.postMessage({ msg: "requestGeometry", data: { chunk: parsed, x, y } }, [
        parsed.buffer,
      ]);
    });
    // console.log(parsedCount);
    // console.log(performance.now() - timer);
  }

  parseChunk(chunk: Chunk) {
    const c = new Uint8Array(this.chunkGeneratorOptions.chunkHeight * this.chunkSize * this.chunkSize);

    for (let y = 0; y < this.chunkGeneratorOptions.chunkHeight; y++) {
      for (let x = 0; x < this.chunkSize; x++) {
        for (let z = 0; z < this.chunkSize; z++) {
          c[x + this.chunkSize * (y + this.chunkGeneratorOptions.chunkHeight * z)] = chunk[y][x][z].id;
        }
      }
    }

    return c;
  }

  generateChunkMesh(
    c: Chunk,
    positions: Float32Array,
    normals: Float32Array,
    uvs: Float32Array,
    indices: number[]
  ) {
    const geometry = new BufferGeometry();
    const positionNumComponents = 3;
    const normalNumComponents = 3;
    const uvNumComponents = 2;

    geometry.setAttribute("position", new BufferAttribute(positions, positionNumComponents));
    geometry.setAttribute("normal", new BufferAttribute(normals, normalNumComponents));
    geometry.setAttribute("uv", new BufferAttribute(uvs, uvNumComponents));
    geometry.setIndex(indices);

    const mesh = new Mesh(geometry, this.chunkMaterial);
    mesh.position.set(c[0][0][0].x, c[0][0][0].y, c[0][0][0].z);
    // mesh.castShadow = true;
    // mesh.receiveShadow = true;

    Engine.renderScene.add(mesh);
    this.renderedMeshes.push(mesh);
  }

  getVoxel(x: number, y: number, z: number, chunkPos?: { x?: number; y?: number }) {
    const chunkX = Math.floor(x / this.chunkSize) + this.chunkOffset; // 1
    const chunkY = Math.floor(z / this.chunkSize) + this.chunkOffset; // 1
    if (
      chunkX < 0 ||
      chunkX >= this.worldSize ||
      chunkY < 0 ||
      chunkY >= this.worldSize ||
      !this.chunks[chunkY][chunkX]
    )
      return;
    const chunk = this.chunks[chunkY][chunkX];

    const relY = y + Math.abs(this.chunkGeneratorOptions.bedrock); // 40
    const relX = x + Math.abs(chunk[0][0][0].x) * Math.sign(x * -1);
    // console.log(chunk[0][0][0].x);
    const relZ = z + Math.abs(chunk[0][0][0].z) * Math.sign(z * -1);
    // console.log(relY, relX, relZ);
    if (
      relY < 0 ||
      relY >= this.chunkGeneratorOptions.chunkHeight ||
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

  private setupChunkGenerator() {
    this.chunkGenerator = new Worker("js/chunk-generator.js");
    this.chunkGenerator.postMessage({
      msg: "createGenerator",
      data: { seed: this.seed, options: this.chunkGeneratorOptions },
    });
    this.chunkGenerator.onmessage = (ev: MessageEvent) => {
      const { msg, data } = ev.data;

      switch (msg) {
        case "chunk":
          const { x, y, c } = data;
          this.chunks[y][x] = c;
          this.chunksQueued--;

          if (this.chunksQueued === 0) {
            // generate chunk meshes
            this.canRequestGeneration = true;
            this.requestGeometry(this.generationLimits);
          }
          break;
      }
    };
  }

  private setupGeometryGenerator() {
    this.geometryGenerator = new Worker("js/geometry-generator.js");
    this.geometryGenerator.postMessage({
      msg: "createGenerator",
      data: <GeometryGeneratorOptions>{
        chunkSize: this.chunkSize,
        chunkHeight: this.chunkGeneratorOptions.chunkHeight,
        bedrock: this.chunkGeneratorOptions.bedrock,
        tileSize: this.tileSize,
        tileTextureWidth: this.tileTextureWidth,
        tileTextureHeight: this.tileTextureHeight,
      },
    });
    this.geometryGenerator.onmessage = (ev: MessageEvent) => {
      const { msg, data } = ev.data;

      switch (msg) {
        case "geometry":
          const { x, y, positions, normals, uvs, indices } = data;
          this.generateChunkMesh(this.chunks[y][x], positions, normals, uvs, indices);
          // this.chunks[y][x] = c;
          // this.chunksQueued--;

          // if (this.chunksQueued === 0) {
          //   // generate chunk meshes
          //   this.canRequestGeneration = true;
          //   this.generateMesh(this.generationLimits);
          // }
          break;
      }
    };
  }
}
