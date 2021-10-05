import { Object3D } from "three";

export default abstract class Scene {
  id: string;
  collidables: Object3D[];
  objects: Object3D[];

  constructor(id: string, objects: Object3D[] = [], collidables: Object3D[] = []) {
    this.id = id;
    this.objects = objects;
    this.collidables = collidables;
  }

  abstract init(): void;
  abstract update(delta: number): void;
}
