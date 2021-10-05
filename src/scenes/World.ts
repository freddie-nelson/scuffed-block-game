import { Object3D } from "three";
import Engine from "../Engine";
import Player from "../Player";
import Scene from "./Scene";

export default class World extends Scene {
  player: Player = new Player();

  constructor(id: string) {
    super(id, []);
  }
}
