import Engine from "./Engine";

import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";

interface Listener {
  type: keyof HTMLElementEventMap;
  cb: (e?: Event | MouseEvent | KeyboardEvent) => void;
}

export default class MouseController {
  controls: PointerLockControls;
  mouse = {
    isPressed: false,
    button: 0,
  };
  private using = "pointerlock";
  private listeners: Listener[] = [];

  constructor() {
    this.registerListener("mousedown", (e: MouseEvent) => {
      this.mouse.isPressed = true;
      this.mouse.button = e.button;
    });
    this.registerListener("mouseup", (e: MouseEvent) => {
      this.mouse.isPressed = false;
      this.mouse.button = e.button;
    });
  }

  refresh() {
    switch (this.using) {
      case "pointerlock":
        this.usePointerLockControls();
        break;
    }
  }

  usePointerLockControls() {
    this.reset();

    this.using = "pointerlock";
    this.controls = new PointerLockControls(Engine.camera, Engine.element);
    Engine.renderScene.add(this.controls.getObject());

    this.registerListener("click", () => {
      if (!this.controls.isLocked) this.controls.lock();
    });
  }

  reset() {
    if (this.controls) {
      Engine.renderScene.remove(this.controls.getObject());
      this.clearListeners();
    }
  }

  registerListener(type: Listener["type"], cb: Listener["cb"]) {
    Engine.element.addEventListener(type, cb);
    this.listeners.push({
      type,
      cb,
    });
  }

  removeListener(type: Listener["type"], cb: Listener["cb"]) {
    Engine.element.removeEventListener(type, cb);
    const i = this.listeners.findIndex((l) => l.type === type && l.cb === cb);
    if (i !== -1) this.listeners.splice(i, 1);
  }

  clearListeners() {
    this.listeners.forEach((l) => Engine.element.removeEventListener(l.type, l.cb));
  }
}
