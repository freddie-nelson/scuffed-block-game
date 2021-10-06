import { BoxBufferGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import Engine from "./Engine";

export default class Player {
  height = 2;
  width = 1;
  acceleration = 80;
  friction = 80;
  jumpForce = 6;
  weight = 12;
  velocity = new Vector3(0, 0, 0);
  maxVelocity = new Vector3(10, 150, 10);
  cameraPos = new Vector3(this.width / 2 - 0.01, this.width / 2, 0);
  object: Mesh;
  noClip = true;

  constructor(x: number, y: number, z: number) {
    const geometry = new BoxBufferGeometry(this.width, this.height, this.width);
    const material = new MeshBasicMaterial({ color: 0x0000ff });
    this.object = new Mesh(geometry, material);
    this.object.position.set(x, y + this.height / 2, z);
  }

  init() {
    Engine.renderScene.add(this.object);
    this.object.add(Engine.camera);
    Engine.camera.position.copy(this.cameraPos);
  }

  update() {
    const keyController = Engine.keyController;
    const delta = Engine.getDelta();

    // player movement
    let movedX = false;
    let movedZ = false;

    const isOnGround = this.isOnGround();
    const acceleration = this.acceleration * (isOnGround ? 1 : 0.3);

    if (keyController.isKeyPressed("KeyA")) {
      movedX = true;
      this.velocity.x -= acceleration * delta;
      if (Math.abs(this.velocity.x) > this.maxVelocity.x)
        this.velocity.x = this.maxVelocity.x * Math.sign(this.velocity.x);
    }
    if (keyController.isKeyPressed("KeyD")) {
      movedX = true;
      this.velocity.x += acceleration * delta;
      if (Math.abs(this.velocity.x) > this.maxVelocity.x)
        this.velocity.x = this.maxVelocity.x * Math.sign(this.velocity.x);
    }
    if (keyController.isKeyPressed("KeyW")) {
      movedZ = true;
      this.velocity.z += acceleration * delta;
      if (Math.abs(this.velocity.z) > this.maxVelocity.z)
        this.velocity.z = this.maxVelocity.z * Math.sign(this.velocity.z);
    }
    if (keyController.isKeyPressed("KeyS")) {
      movedZ = true;
      this.velocity.z -= acceleration * delta;
      if (Math.abs(this.velocity.z) > this.maxVelocity.z)
        this.velocity.z = this.maxVelocity.z * Math.sign(this.velocity.z);
    }

    // apply friction
    const sign = {
      x: Math.sign(this.velocity.x),
      y: Math.sign(this.velocity.y),
      z: Math.sign(this.velocity.z),
    };

    if (!movedX) {
      this.velocity.x -= sign.x * this.friction * delta;
      if (Math.sign(this.velocity.x) !== sign.x) this.velocity.x = 0;
    }
    if (!movedZ) {
      this.velocity.z -= sign.z * this.friction * delta;
      if (Math.sign(this.velocity.z) !== sign.z) this.velocity.z = 0;
    }

    Engine.mouseController.controls.moveForward(this.velocity.z * delta);
    Engine.mouseController.controls.moveRight(this.velocity.x * delta);

    // jump
    let jumped = false;

    if (isOnGround && !this.noClip) {
      this.velocity.y = 0;

      if (keyController.isKeyPressed("Space")) {
        this.velocity.y = this.jumpForce;
        jumped = true;
      }
    } else if (this.noClip) {
      if (keyController.isKeyPressed("Space")) {
        this.velocity.y = this.jumpForce;
      } else if (keyController.isKeyPressed("ShiftLeft")) {
        this.velocity.y = -this.jumpForce;
      } else {
        this.velocity.y = 0;
      }
    } else {
      this.velocity.y -= this.weight * delta;
      if (Math.abs(this.velocity.y) > this.maxVelocity.y)
        this.velocity.y = this.maxVelocity.y * Math.sign(this.velocity.y);
    }

    this.object.position.y += this.velocity.y * delta;

    // sync player and camera position
    this.object.position.add(Engine.camera.position.clone().sub(this.cameraPos));
    Engine.camera.position.copy(this.cameraPos);
  }

  isOnGround(): boolean {
    const raycaster = new Raycaster(this.object.position, new Vector3(0, -1, 0), 0, this.height / 2 + 0.001);
    const intersections = raycaster.intersectObjects(Engine.currScene.collidables);
    return intersections.length > 0;
  }
}
