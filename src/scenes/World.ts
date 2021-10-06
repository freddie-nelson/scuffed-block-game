import Engine from "../Engine";
import Player from "../Player";
import Scene from "./Scene";
import Voxel, { corners, dir, Neighbours } from "../Voxel";
import { makeNoise2D } from "fast-simplex-noise";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CubeTextureLoader,
  DirectionalLight,
  DoubleSide,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
} from "three";
const noise = makeNoise2D();

export type Chunk = Voxel[][][];

export default class World extends Scene {
  player: Player;
  skybox: Mesh;
  chunks: Chunk[][] = [];
  chunkSize = 10;
  chunkHeight = 140;
  bedrock = -40;
  seaLevel = 0;
  voxelSize = 1;
  worldSize = 3;
  chunkOffset = Math.floor(this.worldSize / 2);

  constructor(id: string) {
    super(id);
  }

  init() {
    // create skybox
    // const loader = new CubeTextureLoader();
    // const texture = loader.load([
    //   "assets/skybox/day_px.png",
    //   "assets/skybox/day_nx.png",
    //   "assets/skybox/day_py.png",
    //   "assets/skybox/day_ny.png",
    //   "assets/skybox/day_pz.png",
    //   "assets/skybox/day_nz.png",
    // ]);
    // Engine.renderScene.background = texture;
    Engine.renderScene.background = new Color("lightblue");

    const skylight = new HemisphereLight("lightblue", "blue", 1);
    Engine.renderScene.add(skylight);

    this.addLight(-1, 2, 4);
    this.addLight(1, -1, -2);

    this.player = new Player(0, 0, 0);
    this.player.init();
    this.generate();
  }

  private addLight(x: number, y: number, z: number) {
    const dirLight = new DirectionalLight(0xffffff, 1);
    dirLight.position.set(x, y, z);
    Engine.renderScene.add(dirLight);
  }

  generate() {
    let chunksGenerated = 0;

    // generate chunk data
    for (let y = 0; y < this.worldSize; y++) {
      const row: Chunk[] = [];
      for (let x = 0; x < this.worldSize; x++) {
        const c = this.generateChunk(
          (x - this.chunkOffset) * this.chunkSize,
          (y - this.chunkOffset) * this.chunkSize
        );
        row.push(c);
        chunksGenerated++;
      }

      this.chunks.push(row);
    }

    console.log("chunks generated: " + chunksGenerated);

    // generate chunk meshes
    for (let y = 0; y < this.worldSize; y++) {
      for (let x = 0; x < this.worldSize; x++) {
        const c = this.chunks[y][x];
        const n = this.getChunkNeighbours(x, y);

        const { positions, normals, indices } = this.generateChunkGeometry(c, n);
        const geometry = new BufferGeometry();
        const material = new MeshLambertMaterial({ color: "green", side: DoubleSide });

        const positionNumComponents = 3;
        const normalNumComponents = 3;
        geometry.setAttribute(
          "position",
          new BufferAttribute(new Float32Array(positions), positionNumComponents)
        );
        geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), normalNumComponents));
        geometry.setIndex(indices);
        const mesh = new Mesh(geometry, material);
        mesh.position.set(c[0][0][0].x, c[0][0][0].y, c[0][0][0].z);
        Engine.renderScene.add(mesh);
        this.collidables.push(mesh);
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
          let id = 1;
          if (y > this.seaLevel) id = 0;
          // let height = Math.round(y - noise(x, z) * 5);
          // if (height < this.bedrock) height = this.bedrock;
          // else if (height >= this.bedrock + this.chunkHeight) height = this.bedrock + this.chunkHeight - 1;

          const voxel = new Voxel(id, x, y, z);
          col.push(voxel);
        }

        slice.push(col);
      }

      chunk.push(slice);
    }

    return chunk;
  }

  generateChunkGeometry(chunk: Chunk, neighbours: Neighbours<Chunk>) {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y < chunk.length; y++) {
      for (let x = 0; x < chunk[y].length; x++) {
        const slice = chunk[y][x];

        for (let z = 0; z < slice.length; z++) {
          const { position, normal, index } = this.generateVoxelGeometry(
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
        }
      }
    }

    return {
      positions,
      normals,
      indices,
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
    if (voxel.id === 0)
      return {
        position: [],
        normal: [],
        index: [],
      }; // empty

    const neighbours = voxel.getNeighbours(chunk, cNeighbours);

    const position: number[] = [];
    const normal: number[] = [];
    const index: number[] = [];

    Object.keys(neighbours).forEach((k) => {
      const n = neighbours[k];
      if (!n || n.id === 0) {
        const ndx = (posLength + position.length) / 3;

        for (const pos of corners[k]) {
          position.push(pos[0] + x, pos[1] + y, pos[2] + z);
          normal.push(...dir[k]);
        }

        index.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
      }
    });

    return {
      position,
      normal,
      index,
    };
  }

  getVoxel(x: number, y: number, z: number) {
    const chunkX = Math.floor(x / this.chunkSize) + this.chunkOffset;
    const chunkY = Math.floor(z / this.chunkSize) + this.chunkOffset;
    if (chunkX < 0 || chunkX >= this.worldSize || chunkY < 0 || chunkX >= this.worldSize) return;
    const chunk = this.chunks[chunkY][chunkX];

    const relY = y + Math.abs(this.bedrock);
    const relX = x + Math.abs(chunk[0][0][0].x) * Math.sign(x * -1);
    const relZ = z + Math.abs(chunk[0][0][0].z) * Math.sign(z * -1);
    console.log(relY, relX, relZ);
    if (
      relY < 0 ||
      relY >= this.chunkHeight ||
      relX < 0 ||
      relX >= this.worldSize ||
      relZ < 0 ||
      relZ >= this.worldSize
    )
      return;

    return chunk[relY][relX][relZ];
  }

  update(delta: number) {
    this.player.update();
  }
}
