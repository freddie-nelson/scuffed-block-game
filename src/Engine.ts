import { Clock, PCFSoftShadowMap, PerspectiveCamera, Scene as TScene, WebGLRenderer } from "three";

import sr from "seedrandom";
const seedrandom: sr = require("seedrandom");

import KeyboardController from "./KeyboardController";
import MouseController from "./MouseController";

import Scene from "./Scene";
import World from "./World";

export default class Engine {
  static element: HTMLCanvasElement;
  static currScene: Scene;
  static readonly renderScene = new TScene();
  static readonly renderer: WebGLRenderer = new WebGLRenderer({
    antialias: true,
  });
  static camera: PerspectiveCamera;
  static readonly clock = new Clock(false);
  private static delta = 30;
  static readonly mouseController = new MouseController();
  static readonly keyController = new KeyboardController();
  static random: ReturnType<sr.Callback>;

  constructor(element: HTMLCanvasElement) {
    Engine.renderer.setSize(window.innerWidth, window.innerHeight);
    element.replaceWith(Engine.renderer.domElement);
    Engine.element = Engine.renderer.domElement;
    Engine.element.style.width = "";
    Engine.element.style.height = "";

    // init random number generator
    Engine.random = seedrandom();

    // shadows
    // Engine.renderer.shadowMap.enabled = true;
    // Engine.renderer.shadowMap.type = PCFSoftShadowMap;
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

    if (this.resizeRendererToDisplaySize()) {
      const canvas = this.renderer.domElement;
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
      this.camera.updateProjectionMatrix();
    }

    Engine.renderer.render(Engine.renderScene, Engine.camera);
    Engine.currScene.update(this.delta);
  }

  private static resizeRendererToDisplaySize() {
    const canvas = this.element;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      this.renderer.setSize(width, height, false);
    }
    return needResize;
  }

  static setupPerspectiveCam() {
    Engine.camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    Engine.mouseController.refresh();
    Engine.renderScene.add(Engine.camera);
  }

  static getDelta(): number {
    return this.delta;
  }
}
