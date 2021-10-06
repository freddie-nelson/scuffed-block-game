import { Camera, Clock, PerspectiveCamera, Renderer, Scene as TScene, WebGLRenderer } from "three";
import KeyboardController from "./KeyboardController";
import MouseController from "./MouseController";

import Scene from "./scenes/Scene";
import World from "./scenes/World";

export default class Engine {
  static element: HTMLCanvasElement;
  static currScene: Scene;
  static readonly renderScene = new TScene();
  static readonly renderer: Renderer = new WebGLRenderer();
  static camera: Camera;
  static readonly clock = new Clock(false);
  private static delta = 30;
  static readonly mouseController = new MouseController();
  static readonly keyController = new KeyboardController();

  constructor(element: HTMLCanvasElement) {
    Engine.renderer.setSize(window.innerWidth, window.innerHeight);
    element.replaceWith(Engine.renderer.domElement);
    Engine.element = Engine.renderer.domElement;
  }

  static start() {
    Engine.currScene = new World("world");
    Engine.setupPerspectiveCam();

    Engine.currScene.init();
    Engine.clock.start();
    Engine.render();
  }

  static render() {
    this.delta = Engine.clock.getDelta();
    requestAnimationFrame(() => Engine.render());

    Engine.renderer.render(Engine.renderScene, Engine.camera);

    Engine.currScene.update(this.delta);
  }

  static setupPerspectiveCam() {
    Engine.camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 30000);
    Engine.mouseController.refresh();
    Engine.renderScene.add(Engine.camera);
  }

  static getDelta(): number {
    return this.delta;
  }
}
