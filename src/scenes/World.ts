import { DoubleSide, Mesh, MeshBasicMaterial, Object3D, PlaneBufferGeometry } from "three";
import Engine from "../Engine";
import Player from "../Player";
import Scene from "./Scene";

export default class World extends Scene {
  player: Player = new Player();

  constructor(id: string) {
    super(id);
  }

  init() {
    const geometry = new PlaneBufferGeometry(10, 10);
    const material = new MeshBasicMaterial({ color: 0x00ff00, side: DoubleSide });
    const plane = new Mesh(geometry, material);
    plane.rotateX(-Math.PI / 2);
    plane.position.y = 0;

    this.collidables.push(plane);
    Engine.renderScene.add(plane);

    this.player.init();
  }

  update(delta: number) {
    this.player.update();
  }
}
