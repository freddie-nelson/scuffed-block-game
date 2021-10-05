import {
  Camera,
  Clock,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Renderer,
  Scene as TScene,
  WebGLRenderer,
} from "three";
import Controller from "./Controller";

import Scene from "./scenes/Scene";
import World from "./scenes/World";

export default class Engine {
  static element: HTMLCanvasElement;
  static currScene: Scene;
  static renderScene = new TScene();
  static renderer: Renderer = new WebGLRenderer();
  static camera: Camera;
  static clock = new Clock(false);
  static controller = new Controller();

  constructor(element: HTMLCanvasElement) {
    Engine.element = element;

    Engine.renderer.setSize(window.innerWidth, window.innerHeight);
    element.replaceWith(Engine.renderer.domElement);
  }

  static start() {
    Engine.currScene = new World("world");
    Engine.setupPerspectiveCam();

    const geometry = new PlaneGeometry(100, 100);
    const material = new MeshBasicMaterial({ color: 0x00ff00, side: DoubleSide });
    const plane = new Mesh(geometry, material);
    plane.rotation.x = 90;
    Engine.renderScene.add(plane);

    Engine.camera.position.z = 50;

    Engine.clock.start();
    Engine.render();
  }

  static render() {
    const delta = Engine.clock.getDelta();
    requestAnimationFrame(() => Engine.render());

    Engine.renderer.render(Engine.renderScene, Engine.camera);
  }

  static setupPerspectiveCam() {
    Engine.camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  }
}
