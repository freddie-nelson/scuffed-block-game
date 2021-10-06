import { DoubleSide, Mesh, MeshBasicMaterial, PlaneBufferGeometry } from "three";
import Engine from "../Engine";
import Player from "../Player";
import Scene from "./Scene";
import Voxel from "../Voxel";
import { Perlin } from "../utils/Noise";
import { notStrictEqual } from "assert";

type Chunk = Voxel[][][];

export default class World extends Scene {
  player: Player = new Player();
  chunks: Chunk[] = [];
  chunkSize = 10;
  chunkHeight = 100;
  bedrock = -60;

  constructor(id: string) {
    super(id);
  }

  init() {
    this.player.init();
    this.generate();
  }

  generate() {
    for (let x = -1; x < 1; x++) {
      for (let z = -1; z < 1; z++) {
        this.chunks.push(this.generateChunk(x * this.chunkSize, z * this.chunkSize))      
      }      
    }
  }

  generateChunk(chunkX: number, chunkZ: number) {
    const chunk: Chunk = [];

    for (let y = this.bedrock; y < this.bedrock + this.chunkHeight; y++) {
      const slice: Voxel[][] = [];
      for (let x = chunkX; x < chunkX + this.chunkSize; x++) {
        const col: Voxel[] = [];
        for (let z = chunkZ; z < chunkZ + this.chunkSize; z++) {
          let height = y - Math.floor(Perlin.get(x, z) * 10);
          if (height < this.bedrock) height = this.bedrock;
          else if (height > this.bedrock + this.chunkHeight) height = this.bedrock + this.chunkHeight - 1;

          const voxel = new Voxel(0, x, height, z);
          Engine.renderScene.add(voxel.mesh);
          this.collidables.push(voxel.mesh);
          col.push(voxel);   
        }

        slice.push(col);
      }

      chunk.push(slice);
    }

    return chunk;
  }

  // renderChunks() {
  //   for (let i = 0; i < this.chunks.length; i++) {
  //     const chunk = this.chunks[i];

  //     for (let j = 0; j < chunk.length; j++) {
        
  //       for (let k = 0; k < chunk[j].length; k++) {
  //         const slice = chunk[j][k];
          
  //         for (let l = 0; l < slice.length; l++) {
  //           const element = slice[l];
                        
  //         }
  //       }
        
  //     }
      
  //   }
  // }

  update(delta: number) {
    this.player.update();
  }
}
