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
  chunkHeight = 50;
  bedrock = -30;
  voxelSize = 1;
  worldSize = 10;

  constructor(id: string) {
    super(id);
  }

  init() {
    // create skybox
    const loader = new CubeTextureLoader();
    const texture = loader.load([
      "assets/skybox/day_px.png",
      "assets/skybox/day_nx.png",
      "assets/skybox/day_py.png",
      "assets/skybox/day_ny.png",
      "assets/skybox/day_pz.png",
      "assets/skybox/day_nz.png",
    ]);
    Engine.renderScene.background = texture;

    const skylight = new HemisphereLight("lightblue", "blue", 1);
    Engine.renderScene.add(skylight);

    this.addLight(-1, 2, 4);
    this.addLight(1, -1, -2);

    this.player = new Player(0, this.bedrock + this.chunkHeight, 0);
    this.player.init();
    this.generate();
  }

  private addLight(x: number, y: number, z: number) {
    const dirLight = new DirectionalLight(0xffffff, 1);
    dirLight.position.set(x, y, z);
    Engine.renderScene.add(dirLight);
  }

  generate() {
    const worldOffset = Math.floor(this.worldSize / 2);
    let chunksGenerated = 0;

    // generate chunk data
    for (let y = 0; y < this.worldSize; y++) {
      const row: Chunk[] = [];
      for (let x = 0; x < this.worldSize; x++) {
        const c = this.generateChunk((x - worldOffset) * this.chunkSize, (y - worldOffset) * this.chunkSize);
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

        const { positions, normals, indices } = this.generateChunkMesh(c, n);
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
          // let height = Math.round(y - noise(x, z) * 5);
          // if (height < this.bedrock) height = this.bedrock;
          // else if (height >= this.bedrock + this.chunkHeight) height = this.bedrock + this.chunkHeight - 1;

          const voxel = new Voxel(1, x, y, z);
          col.push(voxel);
        }

        slice.push(col);
      }

      chunk.push(slice);
    }

    return chunk;
  }

  generateChunkMesh(chunk: Chunk, neighbours: Neighbours<Chunk>) {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y < chunk.length; y++) {
      for (let x = 0; x < chunk[y].length; x++) {
        const slice = chunk[y][x];

        for (let z = 0; z < slice.length; z++) {
          const voxel = slice[z];
          const voxNeighbours = voxel.getNeighbours(chunk, neighbours);

          Object.keys(voxNeighbours).forEach((k) => {
            const n = voxNeighbours[k];
            if (!n || n.id === 0) {
              const ndx = positions.length / 3;

              for (const pos of corners[k]) {
                positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
                normals.push(...dir[k]);
              }

              indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
            }
          });
        }
      }
    }

    return {
      positions,
      normals,
      indices,
    };
  }

  update(delta: number) {
    this.player.update();
  }
}
