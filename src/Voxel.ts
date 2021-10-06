import { BoxBufferGeometry, Mesh, MeshBasicMaterial } from "three";

const size = 1;
const geometry = new BoxBufferGeometry(size, size, size);
const material = new MeshBasicMaterial({ color: 0x00ff00 });
const mesh = new Mesh(geometry, material);

export default class Voxel {
  id = 0;
  x: number;
  y: number;
  z: number;
  mesh: Mesh;

  constructor(id: number, x: number, y: number, z: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.z = z;
    this.mesh = mesh.clone();
    this.mesh.position.x = x;
    this.mesh.position.y = y;
    this.mesh.position.z = z;
  }
}