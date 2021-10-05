import { Object3D } from "three";

export default class Scene {
  id: string;
  private objects: Object3D[];

  constructor(id: string, objects: Object3D[] = []) {
    this.id = id;
    this.objects = objects;
  }
}
