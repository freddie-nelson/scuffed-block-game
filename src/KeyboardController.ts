type cb = (pressed: boolean) => void;

export default class KeyboardController {
  private keys: { [index: string]: boolean } = {};
  private listeners: { [index: string]: cb[] } = {};

  constructor() {
    document.body.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      this.listeners[e.code]?.forEach((cb) => cb(true));
    });

    document.body.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      this.listeners[e.code]?.forEach((cb) => cb(false));
    });
  }

  isKeyPressed(code: string) {
    return !!this.keys[code];
  }

  addKeyListener(code: string, cb: cb) {
    if (this.listeners[code]) {
      this.listeners[code].push(cb);
    } else {
      this.listeners[code] = [cb];
    }
  }

  removeKeyListener(code: string, cb: cb) {
    if (this.listeners[code]) {
      for (let i = 0; i < this.listeners[code].length; i++) {
        if (cb === this.listeners[code][i]) {
          this.listeners[code].splice(i, 1);
          break;
        }
      }
    }
  }
}
