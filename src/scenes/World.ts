import Engine from "../Engine";
import Player from "../Player";
import Scene from "./Scene";
import Voxel from "../Voxel";
import { makeNoise2D } from "fast-simplex-noise";
import { BackSide, BoxGeometry, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial } from "three";
const noise = makeNoise2D();

type Chunk = Voxel[][][];

export default class World extends Scene {
  player: Player = new Player();
  skybox: Mesh;
  chunks: Chunk[] = [];
  chunkSize = 10;
  chunkHeight = 50;
  bedrock = -30;

  constructor(id: string) {
    super(id);
  }

  init() {
    // create skybox
    const skyboxGeo = new BoxGeometry(10000, 10000, 10000);
    const skyboxMat = new MeshBasicMaterial({ color: 0x87CEEB, side: BackSide }) 
    this.skybox = new Mesh(skyboxGeo, skyboxMat);
    Engine.renderScene.add(this.skybox);

    const skylight = new HemisphereLight(0x87CEEB, 0x5b8726, 1);
    Engine.renderScene.add(skylight);

    const dirLight = new DirectionalLight( 0xffffff, 1 );
    dirLight.position.set(100, this.bedrock + this.chunkHeight * 2, 100);
    dirLight.target.position.set(0, this.bedrock + this.chunkHeight, 0);
    // dirLight.shadowCameraVisible = true;

    Engine.renderScene.add(dirLight);
    Engine.renderScene.add(dirLight.target);
    
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 512;  
    dirLight.shadow.mapSize.height = 512; 
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500 

    const d = this.chunkHeight * 2;
    dirLight.shadow.camera.left = - d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = - d;
    Engine.renderScene.add(dirLight.shadow.camera);

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
          let height = Math.round(y - noise(x, z) * 100);
          if (height < this.bedrock) height = this.bedrock;
          else if (height >= this.bedrock + this.chunkHeight) height = this.bedrock + this.chunkHeight - 1;

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
