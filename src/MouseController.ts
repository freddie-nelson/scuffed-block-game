import Engine from "./Engine";

import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";

interface Listener {
  type: keyof HTMLElementEventMap;
  cb: (e?: Event | MouseEvent | KeyboardEvent) => void;
}

export default class MouseController {
  controls: PointerLockControls;
  private using = "pointerlock";
  private listeners: Listener[] = [];

  constructor() {}

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

  clearListeners() {
    this.listeners.forEach((l) => Engine.element.removeEventListener(l.type, l.cb));
  }
}
